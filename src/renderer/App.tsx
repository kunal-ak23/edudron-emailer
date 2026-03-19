import { useState, useEffect } from 'react';
import type { UserProfile, EmailRow } from '../shared/ipc-types';
import LoginPage from './pages/LoginPage';
import MainPage from './pages/MainPage';
import SendDashboard from './pages/SendDashboard';
import logo from '../edudron-logo.png';

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [checking, setChecking] = useState(true);
  const [view, setView] = useState<'main' | 'sending'>('main');
  const [sendDelayMs, setSendDelayMs] = useState(1200);

  useEffect(() => {
    window.electronAPI.auth.getStatus().then(profile => {
      setUser(profile);
      setChecking(false);
    });
  }, []);

  const handleLogin = async () => {
    const profile = await window.electronAPI.auth.getStatus();
    setUser(profile);
  };

  const handleLogout = async () => {
    await window.electronAPI.auth.logout();
    setUser(null);
  };

  const handleStartSend = async (rows: EmailRow[], delayMs: number) => {
    setSendDelayMs(delayMs);
    setView('sending');
    await window.electronAPI.send.start(rows, delayMs);
  };

  if (checking) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white">
        <img src={logo} alt="Edudron" className="w-16 h-16 mb-4 animate-pulse" />
        <p className="text-gray-400">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <div className="h-screen bg-gray-900 text-white">
      <header className="flex items-center justify-between px-6 py-3 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-3">
          <img src={logo} alt="Edudron" className="w-8 h-8 rounded-md bg-white p-0.5" />
          <h1 className="text-lg font-semibold">Edudron Emailer</h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-300">{user.displayName} ({user.email})</span>
          <button onClick={handleLogout} className="text-sm text-red-400 hover:text-red-300">
            Sign out
          </button>
        </div>
      </header>
      {view === 'main' ? (
        <MainPage user={user} onStartSend={handleStartSend} />
      ) : (
        <SendDashboard delayMs={sendDelayMs} onDone={() => setView('main')} />
      )}
    </div>
  );
}
