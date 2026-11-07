import React, { useState } from 'react';
import { X, Sparkles, User, Lock, Mail, ShieldCheck, AlertCircle, Info } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export const AuthModal: React.FC = () => {
  const {
    authModalOpen,
    setAuthModalOpen,
    authModalView,
    setAuthModalView,
    login,
    signup,
  } = useAuth();
  const { showToast } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authNotice, setAuthNotice] = useState<string | null>(null);

  if (!authModalOpen) return null;

  const handleSwitchView = (view: 'login' | 'signup' | 'forgot') => {
    setAuthError(null);
    setAuthNotice(null);
    setAuthModalView(view);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setAuthError(null);
    setAuthNotice(null);

    try {
      if (authModalView === 'login') {
        const result = await login(email, password);
        if (!result.success) {
          setAuthError(result.error || 'Login failed. Please check your email and password.');
        }
      } else if (authModalView === 'signup') {
        const result = await signup(email, password, username, fullName);
        if (!result.success) {
          setAuthError(result.error || 'Signup failed. Please try again.');
        } else if (result.requiresEmailConfirmation) {
          setAuthNotice(result.error || 'Account created! Please check your email to confirm before signing in.');
          setAuthModalView('login');
        }
      } else {
        showToast('Password reset link sent to your email!', 'info');
        setAuthNotice('If an account exists with that email, a password reset link has been dispatched.');
        setAuthModalView('login');
      }
    } catch (err: any) {
      setAuthError(err.message || 'Authentication error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="bg-[#121218] border border-white/10 rounded-3xl w-full max-w-md p-6 sm:p-8 shadow-2xl relative">
        <button
          onClick={() => setAuthModalOpen(false)}
          className="absolute top-6 right-6 text-zinc-400 hover:text-white p-1 rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Brand header */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-brand-600 via-brand-500 to-brand-neon mx-auto flex items-center justify-center shadow-lg shadow-brand-500/20 mb-3">
            <Sparkles className="w-6 h-6 text-black" />
          </div>
          <h2 className="text-2xl font-extrabold text-white">
            {authModalView === 'login' && 'Sign in to Sonora'}
            {authModalView === 'signup' && 'Create your Account'}
            {authModalView === 'forgot' && 'Reset your Password'}
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            Private, secure high-fidelity audio stream powered by Supabase & Cloudinary
          </p>
        </div>

        {/* Error / Notice Banners */}
        {authError && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5 animate-shake">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
            <div className="leading-relaxed">{authError}</div>
          </div>
        )}

        {authNotice && (
          <div className="mb-4 p-3 rounded-xl bg-sky-500/15 border border-sky-500/30 text-sky-300 text-xs flex items-start gap-2.5">
            <Info className="w-4 h-4 shrink-0 mt-0.5 text-sky-400" />
            <div className="leading-relaxed">{authNotice}</div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {authModalView === 'signup' && (
            <>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                  Full Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    placeholder="Aditya Verma"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full bg-[#181822] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                  Username
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    placeholder="aditya_music"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full bg-[#181822] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#181822] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          {authModalView !== 'forgot' && (
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Password
                </label>
                {authModalView === 'login' && (
                  <button
                    type="button"
                    onClick={() => handleSwitchView('forgot')}
                    className="text-xs text-brand-neon hover:underline"
                  >
                    Forgot?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (authError) setAuthError(null);
                  }}
                  className="w-full bg-[#181822] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-brand-500"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 mt-2 rounded-xl bg-brand-500 hover:bg-brand-neon text-black font-bold text-sm shadow-lg shadow-brand-500/25 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? 'Please wait...' : authModalView === 'login' ? 'Sign In' : authModalView === 'signup' ? 'Create Account' : 'Send Reset Link'}
          </button>
        </form>

        {/* Footer Toggle */}
        <div className="text-center mt-6 text-xs text-zinc-400">
          {authModalView === 'login' ? (
            <>
              Don&apos;t have an account?{' '}
              <button
                onClick={() => handleSwitchView('signup')}
                className="text-brand-neon font-semibold hover:underline"
              >
                Sign up free
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button
                onClick={() => handleSwitchView('login')}
                className="text-brand-neon font-semibold hover:underline"
              >
                Sign in
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
