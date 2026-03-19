import { useState } from 'react';
import logo from '../../edudron-logo.png';

interface LoginPageProps {
  onLogin: () => void;
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      await window.electronAPI.auth.login();
      onLogin();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white">
      <img src={logo} alt="Edudron" className="w-24 h-24 mb-6" />
      <h1 className="text-4xl font-bold mb-1">Edudron Emailer</h1>
      <p className="text-gray-400 mb-8">Bulk email sender for your team</p>
      <button
        onClick={handleLogin}
        disabled={loading}
        className="px-6 py-3 bg-[#1a7f37] hover:bg-[#15692d] disabled:bg-[#0f4f22] rounded-lg text-lg font-medium transition-colors"
      >
        {loading ? 'Signing in...' : 'Sign in with Microsoft'}
      </button>
      {error && <p className="mt-4 text-red-400 text-sm">{error}</p>}
    </div>
  );
}
