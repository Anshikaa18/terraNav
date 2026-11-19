import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Lock, Mail, Loader2, Sparkles, Compass } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please fill in both email & password');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.message || 'Login failed. Please verify your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleFillDemo = () => {
    setEmail('demo@terranav.app');
    setPassword('password123');
  };

  return (
    <div className="h-[calc(100vh-64px)] flex items-center justify-center p-4 bg-[var(--background)] overflow-y-auto">
      <div className="w-full max-w-md p-8 rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-[var(--shadow-lg)]">
        {/* Brand */}
        <div className="flex flex-col items-center text-center mb-6">
          <span className="w-12 h-12 rounded-2xl bg-[var(--primary)] text-white grid place-items-center shadow-md mb-3">
            <Compass className="w-6 h-6" />
          </span>
          <h1 className="text-2xl font-extrabold tracking-tight text-[var(--text)]">
            Welcome to ChunkFlow
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            Access your saved routes, waypoints, and custom map preferences
          </p>
        </div>

        {/* Quick Demo Autofill Pill */}
        <div className="mb-5 flex items-center justify-between gap-3 px-1 py-1">
          <div className="flex min-w-0 items-center gap-2 text-[var(--text-secondary)]">
            <Sparkles className="w-4 h-4 shrink-0 text-[var(--primary)]" />
            <span className="text-xs font-medium">
              Demo Credentials Available
            </span>
          </div>
          <button
            type="button"
            onClick={handleFillDemo}
            className="shrink-0 border-0 bg-transparent shadow-none rounded-lg px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wide text-[var(--primary)] transition-colors hover:bg-[var(--primary-soft)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--outline)]"
          >
            Auto-fill
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-[var(--red)]/10 border border-[var(--red)]/30 text-xs font-medium text-[var(--red)]">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
              Email Address
            </label>
            <div className="relative flex items-center">
              <Mail className="w-4 h-4 text-[var(--text-tertiary)] absolute left-3.5" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                required
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border)] text-xs font-medium text-[var(--text)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-[var(--outline)] focus:ring-2 focus:ring-[var(--primary-soft)] transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
              Password
            </label>
            <div className="relative flex items-center">
              <Lock className="w-4 h-4 text-[var(--text-tertiary)] absolute left-3.5" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border)] text-xs font-medium text-[var(--text)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-[var(--outline)] focus:ring-2 focus:ring-[var(--primary-soft)] transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl text-xs font-bold uppercase tracking-wider text-white bg-[var(--primary)] hover:bg-[var(--primary-strong)] disabled:opacity-50 transition-all flex items-center justify-center space-x-2 shadow-sm mt-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            <span>{loading ? 'Authenticating...' : 'Sign In'}</span>
          </button>
        </form>

        <div className="mt-6 text-center text-xs text-[var(--text-secondary)] border-t border-[var(--border)] pt-4">
          Don't have an account?{' '}
          <Link to="/register" className="font-bold text-[var(--primary)] hover:underline">
            Register here
          </Link>
        </div>
      </div>
    </div>
  );
}
