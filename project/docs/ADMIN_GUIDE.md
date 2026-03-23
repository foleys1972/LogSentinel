# LogSentinel Enterprise - Administrator Guide

## System Administration Overview

LogSentinel Enterprise provides comprehensive administrative capabilities through the System Administration panel. This guide covers all administrative functions and best practices for managing the system.

## Accessing Administration Panel

1. Click the **Settings** button (gear icon) in the bottom-right corner
2. The System Administration panel opens with four main tabs:
   - **Sites**: Manage monitoring locations
   - **Error Codes**: Define error code library
   - **Assets**: Manage device inventory
   - **Criticality Rules**: Configure alert escalation

## Site Management

### Adding New Sites

#### Basic Information
- **Site Name**: Descriptive identifier (e.g., "Production Data Center")
- **Location**: Human-readable location (e.g., "New York, NY")
- **Latitude/Longitude**: Precise coordinates for map positioning

#### Monitoring Configuration
**Folder Path**: The critical setting for actual monitoring
- Must be a real, accessible file system path
- Examples of valid paths:
  - Linux: `/var/log/nginx`, `/opt/myapp/logs`, `/home/user/application/logs`
  - Windows: `C:\Logs\MyApplication`, `D:\Applications\Logs`
- Invalid paths (will not monitor): paths containing "example", "demo", or empty paths

**File Patterns**: Define what files to monitor
- `*.log`: All log files
- `*.evtx`: Windows event logs
- `*.txt`: Text files
- `app*.log`: Files starting with "app"
- `error*.log`: Error-specific logs
- Multiple patterns: Separate with commas

**Advanced Options**:
- **Recursive Monitoring**: Include subdirectories
- **Real-time Tail**: Live monitoring of new entries
- **Max File Size**: Limit file size (prevents monitoring huge files)
- **Log Rotation Handling**: Detect and handle rotated logs

### Site Health Management

#### Health Score Calculation
Health scores (0-100%) are calculated based on:
- **Error Rate**: Percentage of critical/high severity logs
- **Unacknowledged Alerts**: Number of unresolved issues
- **ML Anomalies**: AI-detected unusual patterns
- **Time Window**: 24-hour rolling window

#### Status Indicators
- **Green (80-100%)**: Healthy operation
- **Amber (50-79%)**: Warning state, needs attention
- **Red (0-49%)**: Critical state, immediate action required

#### Health Recovery
- Acknowledging alerts improves health scores
- Resolving underlying issues automatically improves health
- Health scores update every 30 seconds

### Site Configuration Best Practices

#### Path Selection
1. **Use Specific Paths**: Point to actual log directories
2. **Avoid Root Directories**: Don't monitor entire filesystems
3. **Consider Performance**: Large directories may impact performance
4. **Test Accessibility**: Ensure the system can read the specified paths

#### Pattern Optimization
1. **Be Specific**: Use targeted patterns to reduce noise
2. **Avoid Wildcards**: `*.*` can monitor too many files
3. **Test Patterns**: Verify patterns match intended files
4. **Regular Review**: Periodically review and update patterns

#### Monitoring Scope
1. **Start Small**: Begin with critical applications
2. **Gradual Expansion**: Add more sites as system stabilizes
3. **Resource Monitoring**: Watch system resource usage
4. **Performance Tuning**: Adjust based on system performance

## Error Code Management

### Purpose and Benefits
Error codes provide:
- **Standardized Error Identification**: Consistent error naming
- **Automatic Log Enrichment**: Enhanced log entries with resolution info
- **Faster Troubleshooting**: Immediate access to resolution steps
- **Knowledge Management**: Centralized error documentation

### Creating Error Codes

#### Required Fields
- **Error Code**: Unique identifier (e.g., "DB_001", "AUTH_TIMEOUT")
- **Description**: Clear explanation of the error
- **Resolution**: Step-by-step troubleshooting guide
- **Category**: Group related errors (Database, Authentication, Network)
- **Severity**: Impact level (Low, Medium, High, Critical)

#### Optional Features
- **Auto-resolve**: Automatically clear when conditions improve
- **Related Documentation**: Links to detailed guides

### Error Code Best Practices

#### Naming Conventions
- Use consistent prefixes (DB_, NET_, AUTH_, SYS_)
- Include severity indicators when appropriate
- Keep codes short but descriptive
- Use sequential numbering (DB_001, DB_002, etc.)

#### Documentation Standards
- Write clear, actionable resolution steps
- Include prerequisites and requirements
- Provide escalation paths for complex issues
- Regular review and updates

#### Import/Export Management
- **CSV Import**: Bulk import error codes
- **CSV Export**: Backup and share error definitions
- **Version Control**: Maintain error code versions
- **Team Collaboration**: Share definitions across teams

## Asset Management

### Asset Tracking Purpose
Assets provide:
- **Device Correlation**: Link log events to specific devices
- **User Accountability**: Track device assignments
- **Location Mapping**: Physical device locations
- **Inventory Management**: Comprehensive device inventory

### Asset Information Fields

#### Network Identifiers
- **MAC Address**: Unique network identifier
- **IP Address**: Network address (static or DHCP)

#### Device Information
- **Device Name**: Friendly identifier
- **Device Type**: Desktop, Laptop, Server, Printer, etc.
- **Manufacturer**: Dell, HP, Lenovo, etc.
- **Model**: Specific model number
- **Serial Number**: Unique device identifier

#### Location and Assignment
- **Location**: Physical location description
- **Desk Number**: Specific desk or rack location
- **Assigned User**: Current user or responsible person
- **Site ID**: Associated monitoring site

### Asset Management Workflows

#### Device Onboarding
1. **Physical Setup**: Install and configure device
2. **Asset Registration**: Add to LogSentinel database
3. **Network Configuration**: Assign IP/MAC addresses
4. **User Assignment**: Assign to responsible user
5. **Monitoring Setup**: Link to appropriate site

#### Asset Lifecycle Management
1. **Regular Audits**: Verify asset information accuracy
2. **Assignment Updates**: Track user changes
3. **Location Changes**: Update physical locations
4. **Decommissioning**: Remove retired assets

#### Bulk Operations
- **CSV Import**: Import large asset lists
- **CSV Export**: Generate asset reports
- **Bulk Updates**: Mass update asset information
- **Data Validation**: Ensure data consistency

## Criticality Rules Management

### Rule-Based Escalation
Criticality rules provide:
- **Automatic Escalation**: Rules-based alert promotion
- **Condition Evaluation**: Complex condition matching
- **Time-Based Actions**: Escalate based on time delays
- **Multi-Channel Notifications**: Various notification methods

### Rule Configuration

#### Conditions
Define when rules trigger:
- **Error Codes**: Specific error code matches
- **Sources**: Log source applications
- **Keywords**: Message content matching
- **IP Ranges**: Network-based conditions
- **Time Windows**: Temporal condition evaluation

#### Escalation Settings
- **Severity Level**: Target severity for escalation
- **Escalation Time**: Delay before escalation
- **Auto-resolve**: Automatic resolution conditions
- **Notification Channels**: Email, Slack, Teams, SMS

#### Contextual Information
- **Troubleshooting Steps**: Guided resolution process
- **Related Dashboards**: Links to monitoring dashboards
- **Knowledge Base**: Links to documentation
- **Automated Actions**: Scripted response actions

### Rule Management Best Practices

#### Rule Design
1. **Clear Conditions**: Define precise triggering conditions
2. **Appropriate Timing**: Set reasonable escalation delays
3. **Avoid Conflicts**: Ensure rules don't conflict
4. **Regular Testing**: Verify rule effectiveness

#### Notification Management
1. **Channel Selection**: Choose appropriate notification methods
2. **Recipient Lists**: Maintain current contact information
3. **Escalation Paths**: Define clear escalation hierarchies
4. **Feedback Loops**: Monitor rule effectiveness

## System Monitoring and Maintenance

### Performance Monitoring

#### Key Metrics to Watch
- **File Monitoring Statistics**: Files and folders being monitored
- **Log Processing Rate**: Logs processed per hour
- **System Resource Usage**: CPU, memory, disk usage
- **Response Times**: System responsiveness
- **Error Rates**: System error frequency

#### Performance Optimization
1. **Monitor Resource Usage**: Watch system resources
2. **Optimize File Patterns**: Use specific patterns
3. **Limit Monitoring Scope**: Monitor only necessary files
4. **Regular Cleanup**: Remove old data and configurations

### Data Management

#### Storage Considerations
- **Log Retention**: Configure appropriate retention periods
- **Archive Policies**: Implement data archiving
- **Backup Procedures**: Regular system backups
- **Disk Space Monitoring**: Monitor storage usage

#### Data Quality
1. **Regular Audits**: Verify data accuracy
2. **Cleanup Procedures**: Remove obsolete data
3. **Validation Rules**: Implement data validation
4. **Consistency Checks**: Ensure data consistency

### Security and Access Control

#### User Management
- **Authentication**: Secure user authentication
- **Authorization**: Role-based access control
- **Audit Logging**: Track user actions
- **Session Management**: Secure session handling

#### Data Protection
- **Read-Only Access**: Non-invasive monitoring
- **Encryption**: Secure data transmission
- **Privacy Controls**: Configurable privacy settings
- **Compliance**: Meet regulatory requirements

## Troubleshooting Common Issues

### Site Configuration Issues

#### "No Files Monitored" Problem
**Symptoms**: System shows 0 files monitored
**Causes**:
- Invalid folder path
- Incorrect file patterns
- Permission issues
- Demo/example paths used

**Solutions**:
1. Verify folder path exists and is accessible
2. Check file patterns match actual files
3. Ensure proper read permissions
4. Use real file system paths

#### Incorrect File/Folder Counts
**Symptoms**: Monitoring statistics don't match expectations
**Causes**:
- Recursive monitoring enabled/disabled
- File patterns too broad/narrow
- Subfolders not considered
- Pattern matching issues

**Solutions**:
1. Review recursive monitoring setting
2. Adjust file patterns for specificity
3. Check subfolder structure
4. Test patterns against actual files

### Health Score Issues

#### Sites Showing Red Status
**Symptoms**: New sites immediately show critical status
**Causes**:
- No baseline established
- High error rates in logs
- Unacknowledged alerts
- System learning period

**Solutions**:
1. Allow time for baseline establishment
2. Acknowledge existing alerts
3. Review log error rates
4. Monitor health trend over time

#### Health Scores Not Updating
**Symptoms**: Health scores remain static
**Causes**:
- No log activity
- Monitoring not active
- System processing issues
- Configuration problems

**Solutions**:
1. Verify log activity exists
2. Check monitoring configuration
3. Review system status
4. Restart monitoring if needed

### Performance Issues

#### Slow System Response
**Symptoms**: Interface becomes sluggish
**Causes**:
- Too many files monitored
- Large log files
- Insufficient resources
- Network issues

**Solutions**:
1. Reduce monitoring scope
2. Implement file size limits
3. Monitor system resources
4. Optimize network configuration

#### High Resource Usage
**Symptoms**: System consumes excessive resources
**Causes**:
- Monitoring too many files
- Recursive monitoring too deep
- Large file processing
- Memory leaks

**Solutions**:
1. Limit monitoring scope
2. Adjust recursive depth
3. Implement file size limits
4. Regular system restarts

## Best Practices Summary

### Configuration Management
1. **Start Small**: Begin with critical systems
2. **Gradual Expansion**: Add sites incrementally
3. **Regular Reviews**: Periodic configuration audits
4. **Documentation**: Maintain configuration documentation

### Operational Excellence
1. **Monitoring**: Continuous system monitoring
2. **Maintenance**: Regular system maintenance
3. **Updates**: Keep configurations current
4. **Training**: Ensure team knowledge

### Security and Compliance
1. **Access Control**: Implement proper access controls
2. **Audit Trails**: Maintain comprehensive audit logs
3. **Data Protection**: Protect sensitive information
4. **Compliance**: Meet regulatory requirements

This administrator guide provides the foundation for effectively managing LogSentinel Enterprise in production environments.