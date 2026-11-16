import React from 'react';
import { useAuth } from '../context/AuthContext';
import { ShieldAlert, LogOut } from 'lucide-react';
import { Navigate } from 'react-router-dom';

export const ForbiddenPage: React.FC = () => {
  const { user, hrUser, loading, logout } = useAuth();

  if (loading) {
    return <div className="min-h-screen bg-slate-50" />;
  }
  if (!user) return <Navigate to="/login" replace />;
  if (hrUser) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4 font-sans relative overflow-hidden" dir="rtl">
      {/* Background Decor */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-100/70 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-100/70 rounded-full blur-3xl pointer-events-none" />

      <div className="mb-6 relative z-10">
        <img src="/logo.webp" alt="AmaShope" className="h-12 w-auto object-contain drop-shadow-sm" />
      </div>
      <div className="rounded-3xl border border-rose-200/80 bg-white/95 p-8 max-w-md w-full text-center space-y-4 shadow-xl shadow-slate-200/60 backdrop-blur-xl relative z-10">
        <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-100">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-black text-slate-900">غير مصرح بالوصول (403)</h2>
        <p className="text-xs font-medium text-slate-500 leading-relaxed">
          حسابك الحالي غير مفعّل للدخول إلى نظام الموارد البشرية.
        </p>
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-600">
          يرجى التواصل مع مسؤول الموارد البشرية لتفعيل حسابك أو إضافتك للنظام.
        </div>
        <button
          onClick={logout}
          className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-sm"
        >
          <LogOut className="w-4 h-4 rotate-180" />
          <span>تسجيل الخروج</span>
        </button>
      </div>
    </div>
  );
};
