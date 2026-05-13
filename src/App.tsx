import { HashRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Settings, Home as HomeIcon, Zap, RefreshCw, Bell } from 'lucide-react';
import { Toaster, toast } from 'react-hot-toast';
import Home from './pages/Home';
import ConfigPage from './pages/Config';
import { ipcService, sendDesktopNotification } from './lib/ipc-service';

function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  return (
    <div className="min-h-screen p-4 md:p-8">
      <nav className="max-w-7xl mx-auto mb-8 flex justify-between items-center glass-panel p-4">
        <Link to="/" className="text-xl font-black tracking-tighter flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white shadow-[0_0_15px_rgba(37,99,235,0.4)]">
            <Zap size={18} fill="currentColor" />
          </div>
          ORDER TRAILER <span className="text-blue-500">PRO</span>
        </Link>
        <div className="flex gap-2 items-center">
          <Link
            to="/"
            className={`p-2 rounded-lg transition-all flex items-center gap-2 px-4 ${location.pathname === '/' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-white/5 text-gray-400'}`}
          >
            <HomeIcon size={18} />
            <span className="hidden sm:inline font-medium">Dashboard</span>
          </Link>
          <Link
            to="/config"
            className={`p-2 rounded-lg transition-all flex items-center gap-2 px-4 ${location.pathname === '/config' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-white/5 text-gray-400'}`}
          >
            <Settings size={18} />
            <span className="hidden sm:inline font-medium">Settings</span>
          </Link>
          <button
            onClick={() => window.location.reload()}
            className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-all"
            title="Refresh page"
          >
            <RefreshCw size={18} />
          </button>
          {/* TEMP: Test notification */}
          <button
            onClick={async () => {
              toast.success('Sending test notification...', { icon: '🔔', duration: 2000 });
              await sendDesktopNotification('Test Notification 🔔', 'Desktop notifications are working!');
            }}
            className="p-2 rounded-lg hover:bg-amber-500/10 text-amber-400 hover:text-amber-300 transition-all border border-amber-500/20"
            title="Test notification (temporary)"
          >
            <Bell size={18} />
          </button>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto">
        {children}
      </main>
      <Toaster position="bottom-right" toastOptions={{
        style: { background: '#1e293b', color: '#fff', border: '1px solid #334155' }
      }} />
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/config" element={<ConfigPage />} />
        </Routes>
      </Layout>
    </Router>
  );
}
