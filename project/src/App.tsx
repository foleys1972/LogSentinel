import React, { useState } from 'react';
import { Toaster } from 'react-hot-toast';
import { useAuth } from './contexts/AuthContext';
import { LoginPage } from './components/auth/LoginPage';
import { ChangePasswordPage } from './components/auth/ChangePasswordPage';
import { Header } from './components/Header';
import { SystemMetricsPanel } from './components/SystemMetrics';
import { InteractiveMap } from './components/InteractiveMap';
import { LogStream } from './components/LogStream';
import { MLAnomaliesPanel } from './components/MLAnomalies';
import { HealthTrends } from './components/HealthTrends';
import { SiteDetails } from './components/SiteDetails';
import { AdminPanel } from './components/AdminPanel';
import { AlertAcknowledgment } from './components/AlertAcknowledgment';
import { ReportsPanel } from './components/ReportsPanel';
import { PredictiveAnalyticsPanel } from './components/PredictiveAnalyticsPanel';
import { SmartAlertingPanel } from './components/SmartAlertingPanel';
import { RegexSearchPanel } from './components/advanced/RegexSearchPanel';
import { NetworkTopology3D } from './components/advanced/NetworkTopology3D';
import { MonitoringIntegration } from './components/advanced/MonitoringIntegration';
import { PredictiveMaintenancePanel } from './components/advanced/PredictiveMaintenancePanel';
import { IntelligentLogParser } from './components/advanced/IntelligentLogParser';
import { BehaviorLearningPanel } from './components/advanced/BehaviorLearningPanel';
import { NOCWallDisplay } from './components/advanced/NOCWallDisplay';
import { BTSystemsPanel } from './components/advanced/BTSystemsPanel';
import { TradeSensePanel } from './components/advanced/TradeSensePanel';
import { useRealTimeData } from './hooks/useRealTimeData';
import { ServiceImprovementPanel } from './components/ServiceImprovementPanel';
import { 
  BarChart3, 
  Brain, 
  Bell, 
  Search, 
  Network, 
  Activity, 
  Wrench, 
  FileText, 
  Users,
  Monitor,
  Zap,
  Radio,
  Target,
  LayoutGrid,
  X
} from 'lucide-react';

function App() {
  const { user, authConfig, isLoading: authLoading, login, changePassword, logout } = useAuth();
  const { 
    sites, 
    logs, 
    anomalies, 
    metrics, 
    isLoading, 
    isRefreshing, 
    refreshData, 
    updateSites,
    acknowledgeLog,
    acknowledgeAnomaly,
    acknowledgeAllForSite,
    serverPredictions,
    llmEvaluationResult
  } = useRealTimeData();
  
  const [selectedSite, setSelectedSite] = useState<string | null>(null);
  const [showSiteDetails, setShowSiteDetails] = useState<string | null>(null);
  const [showReports, setShowReports] = useState(false);
  const [showPredictiveAnalytics, setShowPredictiveAnalytics] = useState(false);
  const [showSmartAlerting, setShowSmartAlerting] = useState(false);
  const [showRegexSearch, setShowRegexSearch] = useState(false);
  const [showNetworkTopology, setShowNetworkTopology] = useState(false);
  const [showMonitoringIntegration, setShowMonitoringIntegration] = useState(false);
  const [showPredictiveMaintenance, setShowPredictiveMaintenance] = useState(false);
  const [showLogParser, setShowLogParser] = useState(false);
  const [showBehaviorLearning, setShowBehaviorLearning] = useState(false);
  const [showNOCDisplay, setShowNOCDisplay] = useState(false);
  const [showBTSystems, setShowBTSystems] = useState(false);
  const [showTradeSense, setShowTradeSense] = useState(false);
  const [showServiceImprovement, setShowServiceImprovement] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showQuickTools, setShowQuickTools] = useState(false);

  const quickTools = [
    { title: 'Advanced Regex Search', icon: Search, color: 'bg-green-600 hover:bg-green-700', onClick: () => setShowRegexSearch(true) },
    { title: 'Intelligent Log Parser', icon: FileText, color: 'bg-green-600 hover:bg-green-700', onClick: () => setShowLogParser(true) },
    { title: '3D Network Topology', icon: Network, color: 'bg-purple-600 hover:bg-purple-700', onClick: () => setShowNetworkTopology(true) },
    { title: 'Behavioral Learning', icon: Users, color: 'bg-purple-600 hover:bg-purple-700', onClick: () => setShowBehaviorLearning(true) },
    { title: 'Predictive Analytics & AI Insights', icon: Brain, color: 'bg-purple-600 hover:bg-purple-700', onClick: () => setShowPredictiveAnalytics(true) },
    { title: 'Monitoring Tool Integration', icon: Activity, color: 'bg-blue-600 hover:bg-blue-700', onClick: () => setShowMonitoringIntegration(true) },
    { title: 'Reports & Analytics', icon: BarChart3, color: 'bg-blue-600 hover:bg-blue-700', onClick: () => setShowReports(true) },
    { title: 'BT Systems WebSocket (passive)', icon: Zap, color: 'bg-cyan-600 hover:bg-cyan-700', onClick: () => setShowBTSystems(true) },
    { title: 'TradeSense WBA API', icon: Radio, color: 'bg-teal-600 hover:bg-teal-700', onClick: () => setShowTradeSense(true) },
    { title: 'Smart Alerting & Escalation', icon: Bell, color: 'bg-orange-600 hover:bg-orange-700', onClick: () => setShowSmartAlerting(true) },
    { title: 'Predictive Maintenance', icon: Wrench, color: 'bg-orange-600 hover:bg-orange-700', onClick: () => setShowPredictiveMaintenance(true) },
    { title: 'NOC Wall Display', icon: Monitor, color: 'bg-slate-600 hover:bg-slate-700', onClick: () => setShowNOCDisplay(true) },
    { title: 'Service Improvement', icon: Target, color: 'bg-amber-600 hover:bg-amber-700', onClick: () => setShowServiceImprovement(true) },
  ];

  const handleSiteSelect = (siteId: string | null) => {
    setSelectedSite(siteId);
    if (siteId) {
      setShowSiteDetails(siteId);
    }
  };

  const selectedSiteData = showSiteDetails ? sites.find(s => s.id === showSiteDetails) : null;

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400" />
      </div>
    );
  }
  if (authConfig?.authRequired && !user) {
    return <LoginPage onLogin={login} />;
  }
  if (user?.mustChangePassword) {
    return <ChangePasswordPage onChangePassword={changePassword} isFirstLogin />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-400 mx-auto mb-4"></div>
          <p className="text-white text-lg">Initializing LogSentinel Enterprise...</p>
          <p className="text-slate-400 text-sm mt-2">Loading ML models and real-time data streams</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900">
      <Toaster 
        position="top-right"
        toastOptions={{
          style: {
            background: '#1e293b',
            color: '#f8fafc',
            border: '1px solid #334155'
          }
        }}
      />
      
      <Header onRefresh={refreshData} isLoading={isLoading} isRefreshing={isRefreshing} user={user} onLogout={logout} onChangePassword={changePassword} onShowLogin={() => setShowLoginModal(true)} />

      {/* Quick tools — bottom-right, above Settings gear; avoids header Sign in overlap */}
      {!showLoginModal && (
        <div className="fixed bottom-28 right-6 z-30 flex flex-col items-end gap-2">
          {showQuickTools && (
            <div className="grid grid-cols-2 gap-2 max-h-[min(50vh,28rem)] overflow-y-auto rounded-xl border border-slate-700 bg-slate-900/95 p-2 shadow-xl backdrop-blur-sm">
              {quickTools.map(({ title, icon: Icon, color, onClick }) => (
                <button
                  key={title}
                  onClick={() => {
                    onClick();
                    setShowQuickTools(false);
                  }}
                  className={`${color} text-white p-3 rounded-full shadow-lg transition-all duration-200 hover:scale-110`}
                  title={title}
                >
                  <Icon className="h-5 w-5" />
                </button>
              ))}
            </div>
          )}
          <button
            onClick={() => setShowQuickTools((open) => !open)}
            className="bg-slate-700 hover:bg-slate-600 text-white p-3 rounded-full shadow-lg transition-all duration-200 hover:scale-110"
            title={showQuickTools ? 'Close tools' : 'Quick tools'}
            aria-expanded={showQuickTools}
          >
            {showQuickTools ? <X className="h-5 w-5" /> : <LayoutGrid className="h-5 w-5" />}
          </button>
        </div>
      )}
      
      <main className="p-6">
        {/* System Metrics */}
        {metrics && <SystemMetricsPanel metrics={metrics} />}
        
        {/* Interactive Global Site Map */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-xl font-semibold text-white">Interactive Global Site Map</h2>
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
            <InteractiveMap 
              sites={sites} 
              selectedSite={selectedSite}
              onSiteSelect={handleSiteSelect}
            />
          </div>
        </div>
        
        {/* ML Anomalies */}
        <div className="mb-6">
          <MLAnomaliesPanel anomalies={anomalies} />
        </div>
        
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Live Log Stream */}
          <div>
            <LogStream 
              logs={logs} 
              selectedSite={selectedSite}
              onAcknowledgeLog={acknowledgeLog}
              currentUser={user}
            />
          </div>
          
          {/* Health Trends */}
          <div>
            <HealthTrends sites={sites} logs={logs} />
          </div>
        </div>
      </main>
      
      {/* Site Details Modal */}
      {selectedSiteData && showSiteDetails && (
        <SiteDetails
          site={selectedSiteData}
          logs={logs}
          anomalies={anomalies}
          onClose={() => setShowSiteDetails(null)}
        />
      )}
      
      {/* Enhanced Panels */}
      <RegexSearchPanel
        logs={logs}
        anomalies={anomalies}
        isOpen={showRegexSearch}
        onClose={() => setShowRegexSearch(false)}
      />
      
      <NetworkTopology3D
        sites={sites}
        logs={logs}
        isOpen={showNetworkTopology}
        onClose={() => setShowNetworkTopology(false)}
      />
      
      <MonitoringIntegration
        sites={sites}
        isOpen={showMonitoringIntegration}
        onClose={() => setShowMonitoringIntegration(false)}
      />
      
      <BTSystemsPanel
        sites={sites}
        isOpen={showBTSystems}
        onClose={() => setShowBTSystems(false)}
      />
      
      <TradeSensePanel
        sites={sites}
        onSitesUpdate={updateSites}
        isOpen={showTradeSense}
        onClose={() => setShowTradeSense(false)}
      />
      
      <PredictiveMaintenancePanel
        sites={sites}
        logs={logs}
        anomalies={anomalies}
        isOpen={showPredictiveMaintenance}
        onClose={() => setShowPredictiveMaintenance(false)}
      />
      
      <IntelligentLogParser
        logs={logs}
        isOpen={showLogParser}
        onClose={() => setShowLogParser(false)}
      />
      
      <BehaviorLearningPanel
        sites={sites}
        logs={logs}
        anomalies={anomalies}
        isOpen={showBehaviorLearning}
        onClose={() => setShowBehaviorLearning(false)}
      />
      
      <NOCWallDisplay
        sites={sites}
        logs={logs}
        anomalies={anomalies}
        metrics={metrics}
        isOpen={showNOCDisplay}
        onClose={() => setShowNOCDisplay(false)}
      />
      
      <PredictiveAnalyticsPanel
        sites={sites}
        logs={logs}
        anomalies={anomalies}
        serverPredictions={serverPredictions}
        isOpen={showPredictiveAnalytics}
        onClose={() => setShowPredictiveAnalytics(false)}
      />
      
      <SmartAlertingPanel
        sites={sites}
        logs={logs}
        anomalies={anomalies}
        isOpen={showSmartAlerting}
        onClose={() => setShowSmartAlerting(false)}
        currentUser={user}
      />
      
      <ReportsPanel
        sites={sites}
        logs={logs}
        anomalies={anomalies}
        isOpen={showReports}
        onClose={() => setShowReports(false)}
      />
      
      <ServiceImprovementPanel
        sites={sites}
        logs={logs}
        anomalies={anomalies}
        llmEvaluationResult={llmEvaluationResult}
        isOpen={showServiceImprovement}
        onClose={() => setShowServiceImprovement(false)}
      />
      
      {/* Alert Acknowledgment */}
      <AlertAcknowledgment
        logs={logs}
        anomalies={anomalies}
        onAcknowledgeLog={acknowledgeLog}
        onAcknowledgeAnomaly={acknowledgeAnomaly}
        onAcknowledgeAll={acknowledgeAllForSite}
        selectedSite={selectedSite}
        currentUser={user}
      />
      
      {showLoginModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4">
          <div className="relative w-full max-w-md">
            <button onClick={() => setShowLoginModal(false)} className="absolute -top-2 -right-2 z-10 p-2 bg-slate-700 hover:bg-slate-600 rounded-full text-slate-400 hover:text-white text-xl leading-none">×</button>
            <LoginPage compact onLogin={async (u, p) => { const r = await login(u, p); if (r.success) setShowLoginModal(false); return r; }} />
          </div>
        </div>
      )}
      {/* Admin Panel */}
      <AdminPanel 
        sites={sites} 
        onSitesUpdate={updateSites}
        onDataUpdate={refreshData}
      />
    </div>
  );
}

export default App;