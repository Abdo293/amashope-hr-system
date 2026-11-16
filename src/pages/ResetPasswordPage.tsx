import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { CheckCircle2, KeyRound, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export const ResetPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const { session, loading: authLoading } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (!authLoading && !session && !done) return <Navigate to="/login" replace />;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (password.length < 12) {
      setError('كلمة المرور يجب ألا تقل عن 12 حرفًا.');
      return;
    }
    if (password !== confirmation) {
      setError('كلمتا المرور غير متطابقتين.');
      return;
    }

    setSubmitting(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message);
      setSubmitting(false);
      return;
    }

    setDone(true);
    setSubmitting(false);
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12 flex items-center justify-center font-sans relative overflow-hidden" dir="rtl">
      {/* Background Decor */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-100/70 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-100/70 rounded-full blur-3xl pointer-events-none" />

      <section className="w-full max-w-md rounded-3xl border border-slate-200/80 bg-white/95 p-7 sm:p-9 shadow-xl shadow-slate-200/60 backdrop-blur-xl relative z-10">
        {done ? (
          <div className="space-y-5 text-center">
            <CheckCircle2 className="mx-auto size-12 text-emerald-600" />
            <div>
              <h1 className="text-xl font-black text-slate-900">تم حفظ كلمة المرور</h1>
              <p className="mt-2 text-xs font-medium text-slate-500">يمكنك الآن الدخول إلى حسابك بصورة طبيعية.</p>
            </div>
            <button
              type="button"
              onClick={async () => {
                await supabase.auth.signOut();
                navigate('/login', { replace: true });
              }}
              className="w-full rounded-xl bg-blue-600 px-4 py-3 text-xs font-bold text-white hover:bg-blue-700 shadow-md shadow-blue-500/20"
            >
              الذهاب لتسجيل الدخول
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="text-center">
              <div className="mb-4 flex justify-center">
                <img src="/logo.webp" alt="AmaShope" className="h-12 w-auto object-contain drop-shadow-sm" />
              </div>
              <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 border border-blue-100">
                <KeyRound className="size-6" />
              </div>
              <h1 className="text-xl font-black text-slate-900">اختيار كلمة مرور جديدة</h1>
              <p className="mt-1.5 text-xs font-medium text-slate-500">استخدم 12 حرفًا على الأقل وتجنب كلمات المرور المتوقعة.</p>
            </div>

            {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700">{error}</div>}

            <label className="block space-y-1.5 text-xs font-bold text-slate-700">
              <span>كلمة المرور الجديدة</span>
              <input
                type="password"
                autoComplete="new-password"
                minLength={12}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 py-2.5 text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
              />
            </label>

            <label className="block space-y-1.5 text-xs font-bold text-slate-700">
              <span>تأكيد كلمة المرور</span>
              <input
                type="password"
                autoComplete="new-password"
                minLength={12}
                required
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 py-2.5 text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
              />
            </label>

            <button
              type="submit"
              disabled={submitting || authLoading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 px-4 py-3 text-xs font-bold text-white shadow-md shadow-blue-500/20 disabled:opacity-50 transition-all"
            >
              {(submitting || authLoading) && <Loader2 className="size-4 animate-spin" />}
              حفظ كلمة المرور
            </button>
          </form>
        )}
      </section>
    </main>
  );
};
