# LogSentinel Enterprise
## ML-Powered Log Monitoring System

### Overview

LogSentinel Enterprise is a sophisticated, AI-powered log monitoring and analysis platform designed for enterprise environments. It provides real-time log monitoring, machine learning-based anomaly detection, predictive analytics, and intelligent alerting across multiple sites and systems.

### Key Features

- **Real-Time Log Monitoring**: Monitor log files across multiple sites with configurable patterns
- **ML Anomaly Detection**: Advanced machine learning algorithms detect unusual patterns and behaviors
- **Interactive Global Map**: Visualize site health and status on an interactive world map
- **Predictive Analytics**: AI-powered failure prediction and capacity forecasting
- **Smart Alerting**: Intelligent alert management with fatigue prevention
- **Behavioral Learning**: Adaptive system that learns normal patterns and detects deviations
- **Root Cause Analysis**: Automated correlation analysis to identify issue sources
- **Advanced Search**: Powerful regex-based search across logs and anomalies
- **Comprehensive Reporting**: Automated report generation with customizable parameters
- **Asset Management**: Track and correlate log events with physical and virtual assets

### Architecture

LogSentinel Enterprise is built with modern web technologies:
- **Frontend**: React with TypeScript, Tailwind CSS
- **Real-time Updates**: Live data streaming and updates
- **ML Engine**: Built-in anomaly detection algorithms
- **File System Monitoring**: Real-time log file watching and parsing
- **Interactive Mapping**: Leaflet-based geographic visualization
- **Responsive Design**: Works on desktop, tablet, and mobile devices

---

## Quick Start Guide

### 1. Initial Setup

When you first access LogSentinel Enterprise, you'll see the main dashboard with no sites configured. To begin monitoring:

1. Click the **Settings** button (gear icon) in the bottom-right corner
2. This opens the **System Administration** panel
3. Navigate to the **Sites** tab to configure your first monitoring location

### 2. Adding Your First Site

1. In the Sites tab, click **Add Site**
2. Fill in the basic information:
   - **Site Name**: A descriptive name (e.g., "Production Server")
   - **Location**: Geographic location (e.g., "New York, NY")
   - **Latitude/Longitude**: Coordinates for map display

3. Configure monitoring settings:
   - **Folder Path**: The actual path to monitor (e.g., `/var/log/myapp` or `C:\Logs\MyApp`)
   - **File Patterns**: What files to monitor (e.g., `*.log`, `*.evtx`, `*.txt`)
   - **Recursive**: Whether to monitor subfolders
   - **Real-time Tail**: Enable live monitoring of new log entries

4. Click **Save Site**

### 3. Understanding the Dashboard

Once sites are configured, the main dashboard displays:

- **System Metrics**: Overview of total sites, logs, and monitoring status
- **Interactive Map**: Global view of all sites with health indicators
- **Live Log Stream**: Real-time log entries from monitored sites
- **ML Anomalies**: AI-detected unusual patterns
- **Health Trends**: Historical health data and analytics

---

## User Manual

### Main Dashboard Components

#### System Metrics Panel
Located at the top of the dashboard, this panel shows:
- **Total Sites**: Number of configured monitoring locations
- **Active Sites**: Sites currently operational (not in critical status)
- **Total Logs**: Cumulative log entries processed
- **Logs/Hour**: Current log processing rate
- **ML Anomalies**: Number of anomalies detected by AI
- **Avg Response**: Average system response time

#### File System Monitoring Status
Shows detailed monitoring statistics:
- **Files Monitored**: Actual number of files being watched
- **Folders Watched**: Number of directories being monitored
- **Tail Processes**: Active real-time monitoring processes
- **Data Processed**: Total data volume processed

#### Interactive Global Map
- **Site Markers**: Color-coded health indicators
  - 🟢 Green: Healthy (80-100% health score)
  - 🟡 Yellow: Warning (50-79% health score)
  - 🔴 Red: Critical (0-49% health score)
- **Click Markers**: View detailed site information
- **Map Controls**: Zoom, pan, and reset view
- **Real-time Updates**: Health status updates automatically

#### Live Log Stream
- **Real-time Entries**: New log entries appear automatically
- **Severity Levels**: Color-coded by importance (Critical, High, Medium, Low)
- **Filtering**: Filter by severity level or specific sites
- **Acknowledgment**: Mark critical/high alerts as acknowledged
- **File Information**: Shows source file, line number, and path

#### ML Anomalies Panel
- **AI Detection**: Machine learning identifies unusual patterns
- **Anomaly Types**: Pattern, Behavior, Time-series, Threshold, Clustering
- **Confidence Scores**: 0-100 scale indicating detection confidence
- **Expandable Details**: Click to view detailed analysis

### Advanced Features

#### Site Management
Access via the Settings panel → Sites tab:

**Adding Sites**:
1. Click "Add Site"
2. Enter basic information (name, location, coordinates)
3. Configure monitoring paths and patterns
4. Set file monitoring options
5. Save configuration

**Editing Sites**:
1. Click the edit icon next to any site
2. Modify settings as needed
3. Save changes (monitoring will restart automatically)

**Valid Monitoring Paths**:
- Linux: `/var/log/`, `/opt/*/logs/`, `/home/*/logs/`
- Windows: `C:\*\Logs\`, `D:\Applications\Logs\`
- Avoid demo/example paths for real monitoring

#### Error Code Management
Configure error code definitions for enhanced log analysis:

1. Go to Settings → Error Codes tab
2. Add error codes with:
   - **Code**: Unique identifier (e.g., "DB_001")
   - **Description**: What the error means
   - **Resolution**: Steps to fix the issue
   - **Category**: Group similar errors
   - **Severity**: Impact level
   - **Auto-resolve**: Whether to auto-clear when conditions improve

#### Asset Management
Track physical and virtual assets for log correlation:

1. Go to Settings → Assets tab
2. Add assets with:
   - **MAC Address**: Network identifier
   - **IP Address**: Network address
   - **Device Name**: Friendly name
   - **Location**: Physical location
   - **User Assignment**: Who uses the device
   - **Device Type**: Desktop, Server, Printer, etc.

#### Criticality Rules
Define rules for automatic alert escalation:

1. Go to Settings → Criticality Rules tab
2. Create rules with:
   - **Conditions**: When to trigger (error codes, sources, keywords)
   - **Severity**: Impact level
   - **Escalation Time**: How long before escalating
   - **Notification Channels**: Where to send alerts

### Advanced Panels

#### Predictive Analytics & AI Insights
Access via the Brain icon in the top-right action buttons:

**Failure Predictions**:
- 2-4 hour advance warning of potential system failures
- Confidence scores and affected sites
- Recommended preventive actions

**Capacity Forecasting**:
- 24-hour log volume predictions
- Resource utilization forecasts
- Scaling recommendations

**Seasonal Patterns**:
- Hourly, daily, weekly, and monthly patterns
- Peak time identification
- Expected volume increases

**Root Cause Analysis**:
- Select any critical log or anomaly
- AI correlates related events
- Timeline reconstruction
- Recommended remediation steps

#### Smart Alerting & Escalation
Access via the Bell icon:

**Active Alerts**:
- Real-time alert management
- Acknowledgment and resolution tracking
- Contextual troubleshooting information

**Alert Rules**:
- Configure custom alerting conditions
- Set up escalation workflows
- Define suppression rules to prevent alert fatigue

**Escalation Workflows**:
- Multi-level escalation paths
- Automatic team routing
- Time-based escalation triggers

#### Advanced Search (Regex)
Access via the Search icon:

**Pattern Matching**:
- Use regular expressions to find specific log patterns
- Search across all logs and anomalies
- Save frequently used search patterns

**Saved Queries**:
- Store complex search patterns
- Quick access to common searches
- Share patterns across team members

#### Reports & Analytics
Access via the Chart icon:

**Report Configurations**:
- Health trend reports
- Error analysis reports
- Site performance reports
- Anomaly summaries

**Generated Reports**:
- Automated report generation
- Export capabilities (JSON format)
- Historical data analysis
- Trend visualization

#### Network Topology (3D)
Access via the Network icon:

**3D Visualization**:
- Interactive 3D network map
- Real-time connection status
- Traffic flow animation
- Node health indicators

**Network Analysis**:
- Connection latency monitoring
- Error correlation across nodes
- Network performance metrics

#### Monitoring Tool Integration
Access via the Activity icon:

**Supported Integrations**:
- Telegraf Agent
- InfluxDB Time Series
- Prometheus Metrics
- Grafana Dashboards

**Configuration**:
- Connection settings
- Data collection intervals
- Tag and label management
- Test connections

#### Predictive Maintenance
Access via the Wrench icon:

**Maintenance Predictions**:
- Component failure forecasting
- Maintenance window recommendations
- Resource stress analysis

**Component Health**:
- Individual component monitoring
- MTBF (Mean Time Between Failures) tracking
- MTTR (Mean Time To Repair) analysis

#### Intelligent Log Parser
Access via the FileText icon:

**Automatic Pattern Detection**:
- AI identifies log formats
- Extracts structured data from unstructured logs
- Custom pattern creation

**Parsing Results**:
- Field extraction and typing
- Pattern confidence scores
- Processing performance metrics

#### Behavioral Learning
Access via the Users icon:

**Behavior Profiles**:
- User behavior analysis
- System behavior baselines
- Application behavior patterns

**Learning Insights**:
- Pattern discovery
- Anomaly correlation
- Trend analysis

#### NOC Wall Display
Access via the Monitor icon:

**Full-Screen Dashboard**:
- Large display optimization
- Real-time status overview
- Alert summary
- System health metrics

### Alert Management

#### Understanding Alert Levels
- **Critical**: Immediate attention required, system failure imminent
- **High**: Significant issue, investigate within 15 minutes
- **Medium**: Notable issue, investigate within 1 hour
- **Low**: Informational, investigate when convenient

#### Acknowledging Alerts
1. Click the "ACK" button next to any critical or high alert
2. Enter your name/ID for tracking
3. Alert is marked as acknowledged with timestamp
4. Acknowledged alerts appear with reduced opacity

#### Bulk Acknowledgment
1. Click the red alert badge in the bottom-left corner
2. Enter your name/ID
3. Click "Acknowledge All" to clear all unacknowledged alerts for selected sites

### Health Scoring

#### How Health Scores Work
- **100%**: Perfect health, no issues
- **80-99%**: Good health, minor issues
- **50-79%**: Warning state, moderate issues
- **0-49%**: Critical state, major issues

#### Factors Affecting Health
- Critical and high-severity log entries
- Unacknowledged alerts
- ML-detected anomalies
- System resource issues
- Error rates and patterns

#### Health Recovery
- Acknowledging alerts can improve health scores
- Resolving underlying issues automatically improves health
- Health scores update every 30 seconds

### File Monitoring

#### Supported File Types
- **Log Files**: `.log`, `.txt`
- **Windows Event Logs**: `.evtx`
- **Application Logs**: Custom patterns
- **System Logs**: Various formats

#### File Patterns
- `*.log`: All log files
- `*.evtx`: Windows event logs
- `app*.log`: Application-specific logs
- `error*.txt`: Error logs
- `*.*`: All files (use cautiously)

#### Monitoring Modes
- **Scan Only**: Check files periodically
- **Real-time Tail**: Monitor new entries as they're written
- **Recursive**: Include subfolders
- **Rotation Handling**: Detect and handle log rotation

### Troubleshooting

#### No Logs Appearing
1. Verify the folder path is correct and accessible
2. Check file patterns match your log files
3. Ensure the path doesn't contain "example" or "demo"
4. Verify real-time tailing is enabled if needed
5. Check the monitoring statistics in the system metrics panel

#### Incorrect File/Folder Counts
1. The system shows actual files being monitored
2. Counts update when sites are added/removed/modified
3. Recursive monitoring increases folder counts
4. File patterns affect file counts

#### Health Scores Not Updating
1. Health scores update every 30 seconds
2. Scores are based on recent log activity (24-hour window)
3. Acknowledging alerts can improve scores
4. Sites without monitoring maintain their current scores

#### Map Not Loading
1. Check internet connection for map tiles
2. Verify site coordinates are valid
3. Try the "Reset View" button on the map

#### ML Anomalies Not Detected
1. Anomaly detection requires sufficient log data
2. The system learns patterns over time
3. Very regular patterns may not trigger anomalies
4. Check anomaly confidence thresholds

### Best Practices

#### Site Configuration
- Use descriptive site names
- Provide accurate geographic coordinates
- Configure realistic monitoring paths
- Use specific file patterns when possible
- Enable recursive monitoring only when needed

#### Alert Management
- Acknowledge alerts promptly
- Use meaningful acknowledgment names/IDs
- Set up proper escalation rules
- Configure alert suppression to prevent fatigue

#### Performance Optimization
- Monitor only necessary files
- Use specific file patterns
- Limit recursive monitoring depth
- Regular cleanup of old logs

#### Security Considerations
- Ensure log file access permissions are appropriate
- Use read-only access where possible
- Monitor sensitive log files carefully
- Implement proper access controls

### API and Integration

#### Data Export
- Reports can be exported as JSON
- Asset data supports CSV import/export
- Error codes support CSV import/export

#### External Integrations
- Telegraf for metrics collection
- InfluxDB for time-series data
- Prometheus for monitoring
- Grafana for visualization

### Support and Maintenance

#### Regular Maintenance
- Review and update site configurations
- Clean up old acknowledged alerts
- Update error code definitions
- Review and adjust health thresholds

#### Performance Monitoring
- Monitor system resource usage
- Check log processing rates
- Review ML anomaly detection accuracy
- Optimize file monitoring patterns

#### Data Retention
- Configure appropriate log retention policies
- Archive old data as needed
- Monitor storage usage
- Implement backup procedures

---

## Technical Specifications

### System Requirements
- Modern web browser (Chrome, Firefox, Safari, Edge)
- JavaScript enabled
- Minimum 1920x1080 resolution recommended
- Internet connection for map tiles

### Supported Platforms
- **Operating Systems**: Any with modern web browser
- **Log Sources**: Linux, Windows, macOS
- **File Systems**: Local, network-mounted
- **Log Formats**: Text-based logs, structured logs

### Performance Characteristics
- **Real-time Processing**: Sub-second log ingestion
- **Scalability**: Supports hundreds of sites
- **Data Retention**: Configurable retention periods
- **Update Frequency**: 30-second health updates, real-time logs

### Security Features
- **Read-only File Access**: No modification of source logs
- **User Tracking**: All acknowledgments are tracked
- **Audit Trail**: Complete action history
- **Access Control**: Role-based access (when configured)

---

This documentation provides a comprehensive guide to using LogSentinel Enterprise effectively. For additional support or advanced configuration options, consult the system administrator or refer to the built-in help tooltips throughout the interface.