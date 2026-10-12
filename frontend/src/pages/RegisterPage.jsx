import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserPlus, Lock, Mail, User, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !email || !password) {
      setError('All fields are required');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await register(name, email, password);
      navigate('/');
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-[calc(100vh-62px)] flex items-center justify-center p-4 bg-[#090c0f] overflow-y-auto">
      <div className="w-full max-w-md p-8 rounded bg-[#11171b] border border-[#29353a] shadow-float font-mono">
        {/* Brand */}
        <div className="flex flex-col items-center text-center mb-6">
          <span className="text-[#63e7ee] text-3xl font-mono leading-none drop-shadow-[0_0_10px_#63e7ee] mb-2">
            ◫
          </span>
          <h1 className="font-condensed text-2xl font-bold tracking-wider text-[#edf3f1]">
            CREATE TERRANAV ACCOUNT
          </h1>
          <p className="text-[10px] text-[#8c9a9c] mt-1 uppercase tracking-wider">
            REGISTER FOR PERSISTENT PLACES & ROUTING MEMORY
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded bg-[#ff5d61]/10 border border-[#ff5d61]/40 text-xs text-[#ff5d61]">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-wider text-[#8c9a9c] mb-1.5">
              FULL NAME
            </label>
            <div className="relative flex items-center">
              <User className="w-4 h-4 text-[#586769] absolute left-3.5" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Doe"
                required
                className="w-full pl-10 pr-4 py-2.5 rounded bg-[#172125] border border-[#38474b] text-xs text-[#edf3f1] placeholder-[#586769] focus:outline-none focus:border-[#63e7ee] focus:shadow-[0_0_10px_rgba(99,231,238,0.25)] transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-mono uppercase tracking-wider text-[#8c9a9c] mb-1.5">
              EMAIL ADDRESS
            </label>
            <div className="relative flex items-center">
              <Mail className="w-4 h-4 text-[#586769] absolute left-3.5" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                required
                className="w-full pl-10 pr-4 py-2.5 rounded bg-[#172125] border border-[#38474b] text-xs text-[#edf3f1] placeholder-[#586769] focus:outline-none focus:border-[#63e7ee] focus:shadow-[0_0_10px_rgba(99,231,238,0.25)] transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-mono uppercase tracking-wider text-[#8c9a9c] mb-1.5">
              PASSWORD (MIN. 6 CHARACTERS)
            </label>
            <div className="relative flex items-center">
              <Lock className="w-4 h-4 text-[#586769] absolute left-3.5" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="w-full pl-10 pr-4 py-2.5 rounded bg-[#172125] border border-[#38474b] text-xs text-[#edf3f1] placeholder-[#586769] focus:outline-none focus:border-[#63e7ee] focus:shadow-[0_0_10px_rgba(99,231,238,0.25)] transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded bg-[#63e7ee] hover:bg-[#7ef1f7] text-[#071014] text-xs font-bold uppercase tracking-wider border border-[#63e7ee] shadow-[0_0_12px_rgba(99,231,238,0.3)] transition-all flex items-center justify-center space-x-2 disabled:opacity-50 mt-2"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <UserPlus className="w-4 h-4" />
            )}
            <span>{loading ? 'INITIALIZING ACCOUNT...' : 'CREATE ACCOUNT'}</span>
          </button>
        </form>

        <div className="mt-6 text-center text-[10px] text-[#8c9a9c]">
          ALREADY HAVE AN ACCOUNT?{' '}
          <Link to="/login" className="font-bold text-[#63e7ee] hover:underline">
            SIGN IN
          </Link>
        </div>
      </div>
    </div>
  );
}
