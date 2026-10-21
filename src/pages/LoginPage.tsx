import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../services/api';
import { Shield, AlertCircle, ArrowRight, Lock, Phone, Eye, EyeOff } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Optionally fetch configured admin phone from server (.env) as a placeholder hint
    authApi.getPublicConfig().then((cfg) => {
      if (cfg?.adminPhone && !phone) {
        setPhone(cfg.adminPhone);
      }
    }).catch(() => {
      // Fallback
    });
  }, []);

  const from = (location.state as any)?.from?.pathname || '/dashboard';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await login(phone.trim(), password);
      navigate(from, { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed. Please verify your phone number and password.');
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
            <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-start space-x-2.5 text-xs text-rose-700 shadow-2xs">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <span className="font-semibold">{error}</span>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="login-phone" className="block text-xs font-bold text-slate-700 flex items-center justify-between">
                <span>Registered Phone Number</span>
                <span className="text-[10px] text-slate-400 font-normal">10-digit mobile</span>
              </label>
              <div className="mt-1.5 relative rounded-xl shadow-2xs">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Phone className="w-4 h-4" />
                </div>
                <input
                  id="login-phone"
                  name="phone"
                  type="text"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. 9408197990"
                  className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-sky-500 focus:bg-white focus:border-sky-500 transition shadow-2xs"
                />
              </div>
            </div>

            <div>
              <label htmlFor="login-password" className="block text-xs font-bold text-slate-700 flex items-center justify-between">
                <span>Password</span>
                <span className="text-[10px] text-slate-400 font-normal">Secret credentials</span>
              </label>
              <div className="mt-1.5 relative rounded-xl shadow-2xs">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="login-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-sky-500 focus:bg-white focus:border-sky-500 transition shadow-2xs"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              id="login-submit-btn"
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-4 flex justify-center items-center py-2.5 px-4 border border-transparent rounded-xl shadow-md shadow-sky-600/25 text-sm font-bold text-white bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 disabled:opacity-50 transition active:scale-[0.98] cursor-pointer"
            >
              {isSubmitting ? 'Authenticating...' : 'Sign In to Account'}
              <ArrowRight className="ml-2 w-4 h-4" />
            </button>
          </form>

          {/* Secure Access Footer */}
          <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-center space-x-2 text-[11px] font-semibold text-slate-500">
            <Shield className="w-3.5 h-3.5 text-sky-600" />
            <span>Secure Authentication &bull; Role-Based Access Control</span>
          </div>
        </div>
      </div>
    </div>
  );
};
