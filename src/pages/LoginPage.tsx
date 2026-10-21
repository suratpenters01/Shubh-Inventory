import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, Wrench, AlertCircle, ArrowRight } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const [phone, setPhone] = useState('9876543210');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login, quickLogin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as any)?.from?.pathname || '/dashboard';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await login(phone.trim(), password);
      navigate(from, { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed. Please check your credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuick = async (role: 'admin' | 'technician', testPhone?: string) => {
    setError(null);
    setIsSubmitting(true);
    try {
      await quickLogin(role, testPhone);
      navigate(role === 'admin' ? '/dashboard' : '/my-stock', { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Quick login failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 relative flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 overflow-hidden selection:bg-sky-500 selection:text-white">
      {/* Ambient background glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[450px] bg-gradient-to-b from-sky-500/20 via-blue-600/10 to-transparent blur-3xl pointer-events-none rounded-full" />
      <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-indigo-500/15 blur-3xl pointer-events-none rounded-full" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-cyan-500/15 blur-3xl pointer-events-none rounded-full" />

      <div className="relative z-10 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="relative group">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-sky-500 via-blue-600 to-indigo-600 text-white flex items-center justify-center font-display font-black text-xl tracking-wider shadow-lg shadow-sky-500/30 group-hover:scale-105 transition-transform ring-4 ring-white/10">
              AQ
            </div>
            <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-slate-900 ring-2 ring-emerald-400"></span>
          </div>
        </div>
        <h2 className="mt-4 text-center text-3xl font-display font-extrabold tracking-tight text-white">
          AquaStock <span className="text-sky-400 font-light">Pureit</span>
        </h2>
        <p className="mt-1 text-center text-xs text-slate-400 font-medium">
          Field Service Spare Parts &amp; Immutable Stock Ledger System
        </p>
      </div>

      <div className="mt-8 relative z-10 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white/95 backdrop-blur-xl py-8 px-6 shadow-2xl rounded-2xl border border-white/20 sm:px-10 ring-1 ring-slate-900/5">
          {error && (
            <div className="mb-5 p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-start space-x-2 text-xs text-rose-700">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <span className="font-medium">{error}</span>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="login-phone" className="block text-xs font-bold text-slate-700">
                Registered Phone Number
              </label>
              <div className="mt-1.5">
                <input
                  id="login-phone"
                  name="phone"
                  type="text"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. 9876543210"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-sky-500 focus:bg-white focus:border-sky-500 transition shadow-2xs"
                />
              </div>
            </div>

            <div>
              <label htmlFor="login-password" className="block text-xs font-bold text-slate-700">
                Password
              </label>
              <div className="mt-1.5">
                <input
                  id="login-password"
                  name="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-sky-500 focus:bg-white focus:border-sky-500 transition shadow-2xs"
                />
              </div>
            </div>

            <button
              id="login-submit-btn"
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-3 flex justify-center items-center py-2.5 px-4 border border-transparent rounded-xl shadow-md shadow-sky-600/25 text-sm font-bold text-white bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 disabled:opacity-50 transition active:scale-[0.98] cursor-pointer"
            >
              {isSubmitting ? 'Signing in...' : 'Sign In'}
              <ArrowRight className="ml-2 w-4 h-4" />
            </button>
          </form>

          {/* Quick Demo Test Logins */}
          <div className="mt-6 pt-5 border-t border-slate-100">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">
              1-Click Demo Login (Instant Access)
            </p>

            <div className="space-y-2">
              <button
                id="demo-login-admin"
                type="button"
                onClick={() => handleQuick('admin')}
                className="w-full flex items-center justify-between p-3 rounded-xl border border-sky-100 bg-sky-50/60 hover:bg-sky-50 text-left transition group cursor-pointer shadow-2xs hover:shadow-xs"
              >
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-lg bg-sky-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900">Warehouse Manager (Admin)</p>
                    <p className="text-[11px] text-sky-700/90 font-medium">Suresh Verma • 9876543210</p>
                  </div>
                </div>
                <span className="text-[11px] font-bold text-sky-700 bg-white px-2.5 py-1 rounded-lg shadow-2xs border border-sky-200/60 group-hover:bg-sky-600 group-hover:text-white transition">
                  Login Admin →
                </span>
              </button>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  id="demo-login-tech-1"
                  type="button"
                  onClick={() => handleQuick('technician', '9876500001')}
                  className="flex items-center space-x-2 p-2.5 rounded-xl border border-slate-200/80 bg-slate-50/80 hover:bg-white hover:border-slate-300 text-left transition cursor-pointer shadow-2xs hover:shadow-xs"
                >
                  <div className="w-6 h-6 rounded-md bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    <Wrench className="w-3.5 h-3.5" />
                  </div>
                  <div className="truncate">
                    <p className="text-[11px] font-bold text-slate-800 truncate">Rajesh Kumar</p>
                    <p className="text-[10px] text-emerald-600 font-semibold">Tech 1 (Primary)</p>
                  </div>
                </button>

                <button
                  id="demo-login-tech-2"
                  type="button"
                  onClick={() => handleQuick('technician', '9876500002')}
                  className="flex items-center space-x-2 p-2.5 rounded-xl border border-slate-200/80 bg-slate-50/80 hover:bg-white hover:border-slate-300 text-left transition cursor-pointer shadow-2xs hover:shadow-xs"
                >
                  <div className="w-6 h-6 rounded-md bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                    <Wrench className="w-3.5 h-3.5" />
                  </div>
                  <div className="truncate">
                    <p className="text-[11px] font-bold text-slate-800 truncate">Amit Sharma</p>
                    <p className="text-[10px] text-blue-600 font-semibold">Tech 2</p>
                  </div>
                </button>

                <button
                  id="demo-login-tech-3"
                  type="button"
                  onClick={() => handleQuick('technician', '9876500003')}
                  className="flex items-center space-x-2 p-2.5 rounded-xl border border-slate-200/80 bg-slate-50/80 hover:bg-white hover:border-slate-300 text-left transition cursor-pointer shadow-2xs hover:shadow-xs"
                >
                  <div className="w-6 h-6 rounded-md bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                    <Wrench className="w-3.5 h-3.5" />
                  </div>
                  <div className="truncate">
                    <p className="text-[11px] font-bold text-slate-800 truncate">Priya Patel</p>
                    <p className="text-[10px] text-indigo-600 font-semibold">Tech 3</p>
                  </div>
                </button>

                <button
                  id="demo-login-tech-4"
                  type="button"
                  onClick={() => handleQuick('technician', '9876500004')}
                  className="flex items-center space-x-2 p-2.5 rounded-xl border border-slate-200/80 bg-slate-50/80 hover:bg-white hover:border-slate-300 text-left transition cursor-pointer shadow-2xs hover:shadow-xs"
                >
                  <div className="w-6 h-6 rounded-md bg-teal-100 text-teal-700 flex items-center justify-center shrink-0">
                    <Wrench className="w-3.5 h-3.5" />
                  </div>
                  <div className="truncate">
                    <p className="text-[11px] font-bold text-slate-800 truncate">Vikram Singh</p>
                    <p className="text-[10px] text-teal-600 font-semibold">Tech 4</p>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
