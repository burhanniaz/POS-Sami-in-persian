import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-ink-950 px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-paper-50 rounded-2xl p-8 shadow-xl">
        <div className="mb-6 text-center">
          <div className="text-2xl font-extrabold text-ink-900 tracking-tight">صندوق فروش</div>
          <div className="text-ink-700/70 text-sm mt-1">برای ورود اطلاعات خود را وارد کنید</div>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-rose-600/10 text-rose-600 text-sm px-3 py-2 status-rail border-rose-600">
            {error}
          </div>
        )}

        <label className="block text-sm font-medium text-ink-800 mb-1">نام کاربری</label>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full mb-4 rounded-lg border border-paper-200 bg-white px-3 py-2.5 text-ink-900 focus:outline-none focus:ring-2 focus:ring-ink-800"
          autoComplete="username"
          required
        />

        <label className="block text-sm font-medium text-ink-800 mb-1">رمز عبور</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full mb-6 rounded-lg border border-paper-200 bg-white px-3 py-2.5 text-ink-900 focus:outline-none focus:ring-2 focus:ring-ink-800"
          autoComplete="current-password"
          required
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-ink-900 text-white font-semibold py-2.5 hover:bg-ink-800 transition-colors disabled:opacity-60"
        >
          {loading ? 'در حال ورود...' : 'ورود'}
        </button>
      </form>
    </div>
  );
}
