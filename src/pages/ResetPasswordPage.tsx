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
    <main className="min-h-screen bg-slate-950 px-4 py-12 flex items-center justify-center font-sans" dir="rtl">
      <section className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/90 p-7 shadow-2xl">
        {done ? (
          <div className="space-y-5 text-center">
            <CheckCircle2 className="mx-auto size-12 text-emerald-400" />
            <div>
              <h1 className="text-xl font-black text-white">تم حفظ كلمة المرور</h1>
              <p className="mt-2 text-xs text-slate-400">يمكنك الآن الدخول إلى حسابك بصورة طبيعية.</p>
            </div>
            <button
              type="button"
              onClick={async () => {
                await supabase.auth.signOut();
                navigate('/login', { replace: true });
              }}
              className="w-full rounded-xl bg-blue-600 px-4 py-3 text-xs font-bold text-white hover:bg-blue-500"
            >
              الذهاب لتسجيل الدخول
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="text-center">
              <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-blue-600/15 text-blue-400">
                <KeyRound className="size-6" />
              </div>
              <h1 className="text-xl font-black text-white">اختيار كلمة مرور جديدة</h1>
              <p className="mt-2 text-xs text-slate-400">استخدم 12 حرفًا على الأقل وتجنب كلمات المرور المتوقعة.</p>
            </div>

            {error && <div className="rounded-xl border border-rose-800 bg-rose-950/50 p-3 text-xs text-rose-300">{error}</div>}

            <label className="block space-y-1.5 text-xs font-bold text-slate-300">
              <span>كلمة المرور الجديدة</span>
              <input
                type="password"
                autoComplete="new-password"
                minLength={12}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-white outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>

            <label className="block space-y-1.5 text-xs font-bold text-slate-300">
              <span>تأكيد كلمة المرور</span>
              <input
                type="password"
                autoComplete="new-password"
                minLength={12}
                required
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-white outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>

            <button
              type="submit"
              disabled={submitting || authLoading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-xs font-bold text-white hover:bg-blue-500 disabled:opacity-50"
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
