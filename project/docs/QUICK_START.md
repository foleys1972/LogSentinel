# LogSentinel Enterprise - Quick Start Guide

## Getting Started in 5 Minutes

### Step 1: Access the Dashboard
1. Open LogSentinel Enterprise in your web browser
2. You'll see the main dashboard with system metrics at the top
3. Initially, no sites will be configured, so monitoring stats will show zeros

### Step 2: Configure Your First Site
1. **Click the Settings button** (gear icon) in the bottom-right corner
2. **Select the "Sites" tab** in the administration panel
3. **Click "Add Site"** to create your first monitoring location

### Step 3: Enter Site Information
Fill in the basic details:
- **Site Name**: Give it a descriptive name (e.g., "Production Server")
- **Location**: Enter the geographic location (e.g., "New York, NY")
- **Latitude**: Enter the latitude coordinate (e.g., 40.7128)
- **Longitude**: Enter the longitude coordinate (e.g., -74.0060)

### Step 4: Configure File Monitoring
This is the most important part:

**Folder Path to Monitor**:
- Enter the actual path where your log files are located
- Examples:
  - Linux: `/var/log/myapp`, `/opt/application/logs`
  - Windows: `C:\Logs\MyApp`, `D:\Applications\Logs`
- ⚠️ **Important**: Use real file system paths, not demo/example paths

**File Patterns**:
- `*.log` - Monitor all .log files
- `*.evtx` - Monitor Windows event logs
- `*.txt` - Monitor text files
- `app*.log` - Monitor files starting with "app"

**Additional Options**:
- ✅ **Monitor Subfolders**: Check if you want to monitor subdirectories
- ✅ **Enable Real-time Tail**: Check for live monitoring of new log entries
- **Max File Size**: Set maximum file size to monitor (default: 100MB)

### Step 5: Save and Verify
1. **Click "Save Site"**
2. The site will appear in the sites list
3. Check the **System Metrics panel** at the top of the dashboard
4. You should see:
   - **Files Monitored**: Number of actual files found
   - **Folders Watched**: Number of directories being monitored
   - **Tail Processes**: Active monitoring processes

### Step 6: Monitor Live Activity
Once configured, you'll see:
- **Interactive Map**: Your site appears as a marker on the world map
- **Live Log Stream**: New log entries appear in real-time (if any)
- **Health Trends**: Site health tracking begins
- **ML Anomalies**: AI starts learning patterns and detecting anomalies

## Understanding the Interface

### Main Dashboard Components

#### System Metrics (Top Panel)
- **Total Sites**: Number of configured sites
- **Active Sites**: Sites currently operational
- **Total Logs**: Cumulative logs processed
- **Logs/Hour**: Current processing rate
- **ML Anomalies**: AI-detected issues
- **Avg Response**: System response time

#### Interactive Map (Center Left)
- **Green markers**: Healthy sites (80-100% health)
- **Yellow markers**: Warning sites (50-79% health)
- **Red markers**: Critical sites (0-49% health)
- **Click markers**: View detailed site information

#### Live Log Stream (Bottom Left)
- **Real-time entries**: New logs appear automatically
- **Color coding**: 
  - 🔴 Critical (immediate attention)
  - 🟠 High (investigate soon)
  - 🟡 Medium (monitor)
  - 🔵 Low (informational)

#### ML Anomalies (Right Panel)
- **AI Detection**: Machine learning identifies unusual patterns
- **Confidence Scores**: 0-100 scale
- **Anomaly Types**: Pattern, Behavior, Time-series, etc.

### Quick Actions

#### Acknowledge Alerts
- Click **"ACK"** next to critical or high-severity logs
- Enter your name/ID for tracking
- Acknowledged alerts appear dimmed

#### View Site Details
- Click any site marker on the map
- View comprehensive site information
- See recent logs and anomalies for that site

#### Access Advanced Features
Use the action buttons in the top-right corner:
- 🔍 **Advanced Search**: Regex pattern matching
- 🌐 **3D Network**: Interactive network topology
- 📊 **Monitoring Integration**: Connect external tools
- 🔧 **Predictive Maintenance**: Component health analysis
- 📄 **Log Parser**: Intelligent log format detection
- 👥 **Behavioral Learning**: AI behavior analysis
- 🖥️ **NOC Display**: Full-screen operations view

## Common First-Time Issues

### "No Files Monitored" Showing
**Problem**: System shows 0 files monitored despite configuring a site.

**Solutions**:
1. **Check the folder path**: Ensure it's a real, accessible path
2. **Verify file patterns**: Make sure patterns match your actual files
3. **Avoid demo paths**: Don't use paths containing "example" or "demo"
4. **Check permissions**: Ensure the system can read the specified directory

### Site Appears Red on Map
**Problem**: New site immediately shows as critical (red).

**Explanation**: This is normal for new sites. Health scores improve as the system:
1. Processes log data
2. Establishes baselines
3. Learns normal patterns

**Action**: Monitor for 10-15 minutes as the system learns your environment.

### No Logs Appearing in Stream
**Problem**: Live log stream remains empty.

**Possible Causes**:
1. **No new log activity**: If applications aren't actively logging
2. **Real-time tail disabled**: Check site configuration
3. **File permissions**: System can't read the log files
4. **Incorrect patterns**: File patterns don't match actual files

### Map Not Loading
**Problem**: Interactive map shows loading or error.

**Solutions**:
1. **Check internet connection**: Map requires external tile servers
2. **Verify coordinates**: Ensure latitude/longitude are valid
3. **Try reset**: Use the "Reset View" button on the map

## Next Steps

### Explore Advanced Features
1. **Set up Error Codes**: Define error codes for better log analysis
2. **Configure Assets**: Add device information for correlation
3. **Create Alert Rules**: Set up intelligent alerting
4. **Generate Reports**: Create automated reports

### Optimize Performance
1. **Refine file patterns**: Use specific patterns to reduce noise
2. **Adjust monitoring scope**: Monitor only necessary files
3. **Configure thresholds**: Set appropriate health and alert thresholds

### Team Collaboration
1. **Share acknowledgment practices**: Establish team protocols
2. **Use meaningful names**: When acknowledging alerts
3. **Regular reviews**: Schedule periodic configuration reviews

## Getting Help

### Built-in Help
- **Tooltips**: Hover over interface elements for quick help
- **Validation messages**: The system provides feedback on configuration issues
- **Status indicators**: Color coding and icons indicate system status

### Troubleshooting
- **Check system metrics**: Monitor the file monitoring statistics
- **Review site configurations**: Verify paths and patterns are correct
- **Monitor health trends**: Watch how health scores evolve over time

### Best Practices
- **Start small**: Begin with one or two sites
- **Use realistic paths**: Always use actual file system paths
- **Monitor gradually**: Add more sites as you become comfortable
- **Regular maintenance**: Periodically review and update configurations

You're now ready to start monitoring your log files with LogSentinel Enterprise! The system will begin learning your environment's patterns and providing intelligent insights within minutes of configuration.