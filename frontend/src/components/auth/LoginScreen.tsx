import React, { useState } from 'react';
import { GoogleLogin, CredentialResponse } from '@react-oauth/google';
import { useAuth } from '../../context/AuthContext';
import { Mail, Lock, ShieldCheck, ArrowRight } from 'lucide-react';

interface LoginScreenProps {
  onShowToast: (message: string, type: 'success' | 'error') => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onShowToast }) => {
  const { loginWithGoogleToken, loading } = useAuth();
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');

  const handleGoogleSuccess = async (credentialResponse: CredentialResponse) => {
    if (!credentialResponse.credential) {
      onShowToast('Google authentication failed: no credential token returned', 'error');
      return;
    }

    try {
      await loginWithGoogleToken(credentialResponse.credential);
      onShowToast('Welcome to ReachInbox Email Scheduler!', 'success');
    } catch (err: any) {
      onShowToast(err.response?.data?.error || 'Google login failed on backend verification', 'error');
    }
  };

  const handleGoogleError = () => {
    onShowToast('Google OAuth popup was closed or encountered an error', 'error');
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Decorative Gradient Orbs */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 p-8 z-10">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 mb-4 shadow-sm border border-emerald-100">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">ReachInbox Scheduler</h1>
          <p className="text-sm text-slate-500 mt-1">Production-Grade Distributed Job Scheduler</p>
        </div>

        {/* Real Google OAuth Button */}
        <div className="flex flex-col items-center justify-center mb-6">
          <div className="w-full flex justify-center">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={handleGoogleError}
              useOneTap={false}
              theme="filled_blue"
              size="large"
              shape="pill"
              text="continue_with"
              width="320"
            />
          </div>
          <p className="text-xs text-slate-400 mt-2">Sign in using verified Google Identity Services</p>
        </div>

        <div className="relative my-6 flex items-center">
          <div className="flex-grow border-t border-slate-200"></div>
          <span className="flex-shrink mx-4 text-xs font-medium text-slate-400 uppercase tracking-wider">
            or sign up through email
          </span>
          <div className="flex-grow border-t border-slate-200"></div>
        </div>

        {/* Visual Email/Password inputs matching Figma design */}
        <form onSubmit={(e) => { e.preventDefault(); onShowToast('Please click "Continue with Google" to log in with real Google OAuth.', 'error'); }} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Email ID
            </label>
            <div className="relative">
              <Mail className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="email"
                placeholder="name@domain.com"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm transition-all placeholder:text-slate-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="password"
                placeholder="••••••••"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm transition-all placeholder:text-slate-400"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-sm transition-colors shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 group"
          >
            <span>Log In</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-100 text-center">
          <p className="text-xs text-slate-400">
            ReachInbox Hiring Assignment • BullMQ + Redis + PostgreSQL
          </p>
        </div>
      </div>
    </div>
  );
};
