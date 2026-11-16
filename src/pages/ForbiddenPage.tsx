import React from 'react';
import { useAuth } from '../context/AuthContext';
import { ShieldAlert, LogOut } from 'lucide-react';
import { Navigate } from 'react-router-dom';

export const ForbiddenPage: React.FC = () => {
  const { user, hrUser, loading, logout } = useAuth();

  if (loading) {
    return <div className="min-h-screen bg-slate-950" />;
  }
  if (!user) return <Navigate to="/login" replace />;
  if (hrUser) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 font-sans" dir="rtl">
      <div className="mb-6">
        <img src="/logo.webp" alt="AmaShope" className="h-10 w-auto object-contain" />
      </div>
      <div className="glass-panel p-8 rounded-3xl max-w-md w-full text-center space-y-4 border border-rose-900/50 shadow-2xl">
        <div className="w-16 h-16 rounded-2xl bg-rose-950/60 text-rose-500 flex items-center justify-center mx-auto border border-rose-800/60">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-white">غير مصرح بالوصول (403)</h2>
        <p className="text-xs text-slate-400 leading-relaxed">
          حسابك الحالي غير مفعّل للدخول إلى نظام الموارد البشرية.
        </p>
        <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-[11px] text-slate-400">
          يرجى التواصل مع مسؤول الموارد البشرية لتفعيل حسابك أو إضافتك للنظام.
        </div>
        <button
          onClick={logout}
          className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors"
        >
          <LogOut className="w-4 h-4 rotate-180" />
          <span>تسجيل الخروج</span>
        </button>
      </div>
    </div>
  );
};
