/**
 * SNMP trap sender for LogSentinel.
 * Forwards alerts/issues to an SNMP trap receiver based on criticality.
 * Requires: npm install net-snmp
 */

let snmp;
try {
  snmp = require('net-snmp');
} catch (e) {
  snmp = null;
}

const DEFAULT_PORT = 162;
// Enterprise OID for custom traps (1.3.6.1.4.1 - enterprises, then .99999.logsentinel)
const ENTERPRISE_OID = '1.3.6.1.4.1.99999.1';

function sendTrap(config, payload, callback) {
  if (!snmp) {
    const err = new Error('net-snmp not installed. Run: npm install net-snmp');
    if (callback) callback(err);
    return Promise.reject(err);
  }

  const { host, port = DEFAULT_PORT, community = 'public' } = config;
  if (!host || !host.trim()) {
    const err = new Error('SNMP trap host is required');
    if (callback) callback(err);
    return Promise.reject(err);
  }

  return new Promise((resolve, reject) => {
    try {
      const opts = { trapPort: port || DEFAULT_PORT };
      const session = snmp.createSession(host, community, opts);
      const oid = payload.oid || ENTERPRISE_OID;
      const severity = payload.severity || 'unknown';
      const message = payload.message || payload.description || payload.title || 'Alert';
      const source = payload.source || payload.siteName || 'LogSentinel';

      // varbinds: severity, message, source, timestamp
      const varbinds = [
        { oid: `${oid}.1`, type: snmp.ObjectType.OctetString, value: severity },
        { oid: `${oid}.2`, type: snmp.ObjectType.OctetString, value: String(message).substring(0, 255) },
        { oid: `${oid}.3`, type: snmp.ObjectType.OctetString, value: String(source).substring(0, 255) },
        { oid: `${oid}.4`, type: snmp.ObjectType.OctetString, value: new Date().toISOString() }
      ];

      if (payload.affectedSites && payload.affectedSites.length) {
        varbinds.push({ oid: `${oid}.5`, type: snmp.ObjectType.OctetString, value: payload.affectedSites.join(', ') });
      }
      if (payload.errorCode) {
        varbinds.push({ oid: `${oid}.6`, type: snmp.ObjectType.OctetString, value: payload.errorCode });
      }

      session.sendTrap(varbinds, (err) => {
        session.close();
        if (err) {
          if (callback) callback(err);
          reject(err);
        } else {
          if (callback) callback(null);
          resolve();
        }
      });
    } catch (e) {
      if (callback) callback(e);
      reject(e);
    }
  });
}

module.exports = { sendTrap };
