/** Shared helpers for talking to the Express backend (port 3000). */

export function getOfflineAuthConfig() {
  return {
    authRequired: false,
    requireAcknowledgment: true,
    acknowledgmentSeverities: ['critical', 'high'] as string[],
  };
}

export function isBackendProxyError(status: number): boolean {
  return status === 0 || status >= 500;
}

export async function fetchBackendHealth(): Promise<boolean> {
  try {
    const res = await fetch('/api/health', { credentials: 'include' });
    return res.ok;
  } catch {
    return false;
  }
}

export function backendUnavailableMessage(): string {
  return 'Backend not running on port 3000. From the project folder run: npm run dev:full';
}
