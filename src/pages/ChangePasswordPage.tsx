import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Circle, KeyRound, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { getErrorMessage } from '../lib/utils';

const errorMessages: Record<string, string> = {
  CURRENT_PASSWORD_INCORRECT: 'كلمة المرور الحالية غير صحيحة.',
  WEAK_PASSWORD: 'استخدم 12 حرفًا على الأقل، وتشمل حرفًا كبيرًا وصغيرًا ورقمًا ورمزًا.',
  PASSWORD_UNCHANGED: 'كلمة المرور الجديدة يجب أن تختلف عن الحالية.',
  FORBIDDEN_INACTIVE_HR_USER: 'هذا الحساب غير نشط في نظام الموارد البشرية.',
  AUTH_PASSWORD_CHANGE_FAILED: 'تعذّر حفظ كلمة المرور الجديدة. جرّب كلمة مختلفة ثم أعد المحاولة.',
  PASSWORD_CHANGED_PROFILE_UPDATE_FAILED: 'تم تغيير كلمة المرور، لكن تعذّر تحديث الحساب. أعد المحاولة باستخدام كلمة المرور الجديدة ككلمة حالية.',
};

async function readFunctionError(error: unknown, data: unknown) {
  let payload = data && typeof data === 'object' ? data as Record<string, unknown> : null;
  const context = error && typeof error === 'object' && 'context' in error
    ? (error as { context?: unknown }).context
    : null;

  if (!payload && context instanceof Response) {
    try {
      payload = await context.clone().json() as Record<string, unknown>;
    } catch {
      payload = null;
    }
  }

  const code = typeof payload?.error === 'string' ? payload.error : '';
  const details = typeof payload?.details === 'string' ? payload.details : '';
  return errorMessages[code] || details || 'تعذّر تغيير كلمة المرور. راجع البيانات وحاول مرة أخرى.';
}

export const ChangePasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const { hrUser, refreshProfile, logout } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (redirectTimerRef.current) {
        clearTimeout(redirectTimerRef.current);
      }
    };
  }, []);

  const destination = hrUser?.role === 'admin' ? '/admin' : '/employee';
  const passwordRules = [
    { id: 'length', label: 'تتكون من 12 حرفًا على الأقل', passed: newPassword.length >= 12 },
    { id: 'lowercase', label: 'تحتوي على حرف إنجليزي صغير (a-z)', passed: /[a-z]/.test(newPassword) },
    { id: 'uppercase', label: 'تحتوي على حرف إنجليزي كبير (A-Z)', passed: /[A-Z]/.test(newPassword) },
    { id: 'number', label: 'تحتوي على رقم واحد على الأقل (0-9)', passed: /\d/.test(newPassword) },
    { id: 'symbol', label: 'تحتوي على رمز مثل ! أو @ أو #', passed: /[^A-Za-z0-9]/.test(newPassword) },
  ];
  const isStrongPassword = passwordRules.every((rule) => rule.passed);
  const passwordsMatch = confirmation.length > 0 && newPassword === confirmation;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!currentPassword) {
      setError('اكتب كلمة المرور الحالية أولًا.');
      return;
    }
    if (!isStrongPassword) {
      setError('كلمة المرور الجديدة ضعيفة أو غير مكتملة. أكمل الشروط الموضحة بالأسفل.');
      return;
    }
    if (currentPassword === newPassword) {
      setError('كلمة المرور الجديدة يجب أن تختلف عن كلمة المرور الحالية.');
      return;
    }
    if (newPassword !== confirmation) {
      setError('كلمتا المرور الجديدتان غير متطابقتين.');
      return;
    }

    setSubmitting(true);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('hr-manage-user', {
        body: {
          action: 'change_password',
          current_password: currentPassword,
          new_password: newPassword,
        },
      });

      if (invokeError || !data?.success) {
        throw new Error(await readFunctionError(invokeError, data));
      }

      setCurrentPassword('');
      setNewPassword('');
      setConfirmation('');

      const updatedProfile = await refreshProfile();
      const targetDestination = (updatedProfile?.role || hrUser?.role) === 'admin' ? '/admin' : '/employee';
      setDone(true);

      redirectTimerRef.current = setTimeout(() => {
        navigate(targetDestination, { replace: true });
      }, 1500);
    } catch (changeError: unknown) {
      setError(getErrorMessage(changeError, 'فشل تغيير كلمة المرور.'));
    } finally {
      setSubmitting(false);
    }
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
              <h1 className="text-xl font-black text-slate-900">تم تغيير كلمة المرور بنجاح</h1>
              <p className="mt-2 text-xs font-medium text-slate-500">
                تم حفظ كلمة المرور الجديدة، جاري تحويلك إلى النظام تلقائيًا...
              </p>
            </div>
            <Button
              onClick={() => {
                if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
                navigate(destination, { replace: true });
              }}
              className="h-11 w-full rounded-xl bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-500/20 font-bold"
            >
              الدخول إلى النظام الآن
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            <div className="text-center">
              <div className="mb-4 flex justify-center">
                <img src="/logo.webp" alt="AmaShope" className="h-12 w-auto object-contain drop-shadow-sm" />
              </div>
              <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 border border-blue-100">
                <KeyRound className="size-6" />
              </div>
              <h1 className="text-xl font-black text-slate-900">
                {hrUser?.must_change_password ? 'أنشئ كلمة مرور خاصة بك' : 'تغيير كلمة المرور'}
              </h1>
              <p className="mt-1.5 text-xs font-medium leading-5 text-slate-500">
                {hrUser?.must_change_password
                  ? 'هذه أول مرة تدخل فيها أو أعاد الأدمن تعيين حسابك. يجب تغيير كلمة المرور المؤقتة للمتابعة.'
                  : 'أدخل كلمة المرور الحالية، ثم اختر كلمة مرور جديدة قوية.'}
              </p>
            </div>

            {error && (
              <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold leading-5 text-rose-700">
                {error}
              </div>
            )}

            <label className="block space-y-1.5 text-xs font-bold text-slate-700">
              <span>كلمة المرور الحالية</span>
              <input
                type="password"
                autoComplete="current-password"
                required
                value={currentPassword}
                onChange={(event) => {
                  setCurrentPassword(event.target.value);
                  setError(null);
                }}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 py-2.5 text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
              />
            </label>

            <label className="block space-y-1.5 text-xs font-bold text-slate-700">
              <span>كلمة المرور الجديدة</span>
              <input
                type="password"
                autoComplete="new-password"
                minLength={12}
                maxLength={128}
                required
                value={newPassword}
                onChange={(event) => {
                  setNewPassword(event.target.value);
                  setError(null);
                }}
                aria-invalid={newPassword.length > 0 && !isStrongPassword}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 py-2.5 text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
              />
            </label>

            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4">
              <p className="mb-3 text-xs font-bold text-slate-700">اتبع الخطوات التالية:</p>
              <ol className="space-y-2">
                {passwordRules.map((rule, index) => (
                  <li
                    key={rule.id}
                    className={`flex items-center gap-2 text-[11px] font-medium transition-colors ${
                      rule.passed ? 'text-emerald-600' : newPassword ? 'text-rose-500' : 'text-slate-400'
                    }`}
                  >
                    {rule.passed
                      ? <CheckCircle2 className="size-4 shrink-0" />
                      : <Circle className="size-4 shrink-0" />}
                    <span><b className="ml-1">{index + 1}.</b>{rule.label}</span>
                  </li>
                ))}
              </ol>
            </div>

            <label className="block space-y-1.5 text-xs font-bold text-slate-700">
              <span>تأكيد كلمة المرور الجديدة</span>
              <input
                type="password"
                autoComplete="new-password"
                minLength={12}
                maxLength={128}
                required
                value={confirmation}
                onChange={(event) => {
                  setConfirmation(event.target.value);
                  setError(null);
                }}
                aria-invalid={confirmation.length > 0 && !passwordsMatch}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 py-2.5 text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
              />
              {confirmation.length > 0 && (
                <span className={`flex items-center gap-1.5 pt-1 font-medium text-[11px] ${passwordsMatch ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {passwordsMatch ? <CheckCircle2 className="size-3.5" /> : <Circle className="size-3.5" />}
                  {passwordsMatch ? 'كلمتا المرور متطابقتان' : 'كلمتا المرور غير متطابقتين'}
                </span>
              )}
            </label>

            <Button type="submit" disabled={submitting} className="h-11 w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold shadow-md shadow-blue-500/20 transition-all">
              {submitting && <Loader2 className="size-4 animate-spin" />}
              حفظ كلمة المرور الجديدة
            </Button>

            {!hrUser?.must_change_password && (
              <Button type="button" variant="ghost" onClick={() => navigate(destination)} className="w-full text-slate-500 hover:text-slate-800 hover:bg-slate-100 font-semibold">
                رجوع بدون تغيير
              </Button>
            )}
            {hrUser?.must_change_password && (
              <Button type="button" variant="ghost" onClick={logout} className="w-full text-slate-500 hover:text-rose-600 hover:bg-rose-50 font-semibold">
                تسجيل الخروج
              </Button>
            )}
          </form>
        )}
      </section>
    </main>
  );
};
