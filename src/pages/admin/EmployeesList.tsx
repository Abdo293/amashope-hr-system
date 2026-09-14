import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { HRUser, HRRole } from '../../types/hr';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { TableSkeleton } from '../../components/ui/Skeleton';
import { Users, UserPlus, Search, Power, AlertCircle, KeyRound, Copy, CheckCircle2 } from 'lucide-react';
import { getErrorMessage } from '../../lib/utils';
import { useAuth } from '../../context/AuthContext';

export const EmployeesList: React.FC = () => {
  const { user: signedInUser } = useAuth();
  const [users, setUsers] = useState<HRUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | HRRole>('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<HRRole>('employee');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [credentialResult, setCredentialResult] = useState<{
    fullName: string;
    email: string;
    temporaryPassword: string | null;
    existingAccount: boolean;
    isReset: boolean;
  } | null>(null);
  const [resettingUserId, setResettingUserId] = useState<string | null>(null);
  const [pendingResetUser, setPendingResetUser] = useState<HRUser | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('hr_users')
        .select('*')
        .order('created_at', { ascending: false })
        .range(0, 99);

      if (roleFilter !== 'all') {
        query = query.eq('role', roleFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      setUsers((data as HRUser[]) || []);
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  }, [roleFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleToggleActive = async (user: HRUser) => {
    const newStatus = !user.is_active;
    const actionName = newStatus ? 'تفعيل' : 'تعطيل';

    if (!confirm(`هل أنت تأكد من رغبتك في ${actionName} حساب الموظف ${user.full_name}؟`)) return;

    try {
      const { data, error } = await supabase.functions.invoke('hr-manage-user', {
        body: {
          action: 'toggle_active',
          user_id: user.id,
          is_active: newStatus,
        },
      });

      if (error || !data?.success) {
        throw new Error(data?.details || data?.error || error?.message || 'فشل تغيير حالة الحساب');
      }

      await fetchUsers();
    } catch (err: unknown) {
      alert(`فشل ${actionName} الموظف: ${getErrorMessage(err)}`);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !fullName.trim()) return;
    setSubmitting(true);
    setFormError(null);

    try {
      const { data, error } = await supabase.functions.invoke('hr-manage-user', {
        body: {
          action: 'create_user',
          email: email.trim(),
          full_name: fullName.trim(),
          role,
        },
      });

      if (error || !data?.success) {
        throw new Error(data?.details || data?.error || error?.message || 'فشل إضافة الموظف');
      }

      setIsModalOpen(false);
      setCredentialResult({
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        temporaryPassword: data.temporary_password || null,
        existingAccount: Boolean(data.existing_account),
        isReset: false,
      });
      setEmail('');
      setFullName('');
      setRole('employee');
      await fetchUsers();
    } catch (err: unknown) {
      setFormError(getErrorMessage(err, 'فشل إضافة الموظف.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async (user: HRUser) => {
    setResettingUserId(user.id);
    try {
      const { data, error } = await supabase.functions.invoke('hr-manage-user', {
        body: { action: 'reset_password', user_id: user.id },
      });

      if (error || !data?.success || !data?.temporary_password) {
        throw new Error(data?.details || data?.error || error?.message || 'فشل إعادة تعيين كلمة المرور');
      }

      setCopied(false);
      setCredentialResult({
        fullName: user.full_name,
        email: user.email || '',
        temporaryPassword: data.temporary_password,
        existingAccount: false,
        isReset: true,
      });
      setPendingResetUser(null);
      await fetchUsers();
    } catch (err: unknown) {
      alert(`فشل إعادة تعيين كلمة المرور: ${getErrorMessage(err)}`);
    } finally {
      setResettingUserId(null);
    }
  };

  const copyTemporaryPassword = async () => {
    if (!credentialResult?.temporaryPassword) return;
    try {
      await navigator.clipboard.writeText(credentialResult.temporaryPassword);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const handleRoleChange = async (user: HRUser, newRole: HRRole) => {
    if (user.role === newRole) return;
    if (!confirm(`تغيير صلاحية ${user.full_name} إلى ${newRole === 'admin' ? 'أدمن' : 'موظف'}؟`)) return;

    const { data, error } = await supabase.functions.invoke('hr-manage-user', {
      body: { action: 'update_role', user_id: user.id, role: newRole },
    });

    if (error || !data?.success) {
      alert(data?.details || data?.error || error?.message || 'فشل تغيير الصلاحية');
      return;
    }
    await fetchUsers();
  };

  const filteredUsers = users.filter((u) =>
    u.full_name.toLowerCase().includes(search.toLowerCase()) ||
    (u.email && u.email.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight m-0">
            دليل الموظفين
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            إدارة حسابات النظام وتعيين الصلاحيات وتفعيل الحسابات
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-blue-600/25 flex items-center gap-2 transition-all self-start sm:self-auto"
        >
          <UserPlus className="w-4 h-4" />
          <span>إضافة موظف</span>
        </button>
      </div>

      {/* Filter & Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute right-3 top-3 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث باسم الموظف..."
            className="w-full pr-9 pl-4 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto">
          {([
            { id: 'all', label: 'الكل' },
            { id: 'admin', label: 'الأدمن' },
            { id: 'employee', label: 'الموظفون' },
          ] as const).map((r) => (
            <button
              key={r.id}
              onClick={() => setRoleFilter(r.id)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                roleFilter === r.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of Employees */}
      {loading ? (
        <TableSkeleton rows={4} />
      ) : filteredUsers.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
          <Users className="w-12 h-12 text-slate-400 mx-auto" />
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">لا يوجد موظفون مطابقون</h3>
          <p className="text-xs text-slate-400">أضف موظفاً جديداً أو غيّر كلمات البحث.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredUsers.map((user) => (
            <div
              key={user.id}
              className={`p-5 rounded-2xl bg-white dark:bg-slate-900 border shadow-sm transition-all space-y-4 flex flex-col justify-between ${
                user.is_active
                  ? 'border-slate-200 dark:border-slate-800'
                  : 'border-rose-200 dark:border-rose-900/40 bg-rose-50/20 dark:bg-rose-950/10'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold text-sm flex items-center justify-center shadow-md">
                    {user.full_name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      {user.full_name}
                    </h3>
                    <Badge variant={user.role === 'admin' ? 'admin' : 'employee'} size="sm">
                      {user.role === 'admin' ? 'أدمن' : 'موظف'}
                    </Badge>
                    {user.must_change_password && (
                      <Badge variant="warning" size="sm">بانتظار تغيير كلمة المرور</Badge>
                    )}
                    {user.email && <p className="mt-1 text-[10px] text-slate-400" dir="ltr">{user.email}</p>}
                  </div>
                </div>

                <button
                  onClick={() => handleToggleActive(user)}
                  title={user.is_active ? 'تعطيل الحساب' : 'تفعيل الحساب'}
                  className={`p-2 rounded-xl transition-colors ${
                    user.is_active
                      ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100'
                      : 'text-rose-600 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100'
                  }`}
                >
                  <Power className="w-4 h-4" />
                </button>
              </div>

              <Select
                value={user.role}
                onValueChange={(value) => value && handleRoleChange(user, value as HRRole)}
                items={{ employee: 'موظف', admin: 'أدمن HR' }}
              >
                <SelectTrigger className="h-9 w-full rounded-xl border-slate-200 bg-slate-50 text-xs dark:border-slate-700 dark:bg-slate-800">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="start">
                  <SelectItem value="employee">موظف</SelectItem>
                  <SelectItem value="admin">أدمن HR</SelectItem>
                </SelectContent>
              </Select>

              <Button
                type="button"
                variant="outline"
                disabled={resettingUserId === user.id || signedInUser?.id === user.id}
                onClick={() => setPendingResetUser(user)}
                title={signedInUser?.id === user.id ? 'غيّر كلمة مرور حسابك من أيقونة المفتاح أعلى الصفحة' : undefined}
                className="h-9 w-full rounded-xl border-slate-200 bg-white text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              >
                <KeyRound className="size-4" />
                {signedInUser?.id === user.id
                  ? 'غيّر كلمة مرورك من أعلى الصفحة'
                  : resettingUserId === user.id
                    ? 'جاري إنشاء كلمة مؤقتة...'
                    : 'إعادة تعيين كلمة المرور'}
              </Button>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                <span className="text-[11px]">
                  انضم: {new Date(user.created_at).toLocaleDateString('ar-EG')}
                </span>
                <span
                  className={`font-bold text-[11px] ${
                    user.is_active ? 'text-emerald-600' : 'text-rose-500'
                  }`}
                >
                  {user.is_active ? 'نشط' : 'معطل'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Add Employee */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="إضافة موظف جديد"
        subtitle="إنشاء حساب جديد أو ربط حساب قائم بنظام الموارد البشرية"
      >
        <form onSubmit={handleCreateUser} className="space-y-4 text-right">
          {formError && (
            <div className="p-3 rounded-xl bg-rose-50 text-rose-700 text-xs border border-rose-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              الاسم الكامل *
            </label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="مثال: أحمد علي"
              className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              البريد الإلكتروني *
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ahmed@company.com"
              className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              صلاحية الحساب *
            </label>
            <Select
              value={role}
              onValueChange={(value) => value && setRole(value as HRRole)}
              items={{ employee: 'موظف (مشاهدة مشاريعه ومهامه فقط)', admin: 'أدمن HR (صلاحية كاملة)' }}
            >
              <SelectTrigger className="h-10 w-full rounded-xl border-slate-200 bg-slate-50 text-xs dark:border-slate-700 dark:bg-slate-800">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="start">
                <SelectItem value="employee">موظف (مشاهدة مشاريعه ومهامه فقط)</SelectItem>
                <SelectItem value="admin">أدمن HR (صلاحية كاملة)</SelectItem>
              </SelectContent>
            </Select>
            <p className="mt-1.5 text-[10px] leading-4 text-slate-400">
              سيُنشئ النظام كلمة مرور مؤقتة ويعرضها لك مرة واحدة، ثم يطلب من الموظف تغييرها عند أول دخول.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/20 disabled:opacity-50"
            >
              {submitting ? 'جاري الإضافة...' : 'إضافة الموظف'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={Boolean(credentialResult)}
        onClose={() => {
          setCredentialResult(null);
          setCopied(false);
        }}
        title={credentialResult?.isReset ? 'تم إنشاء كلمة مرور مؤقتة' : 'تمت إضافة الموظف'}
        subtitle="انقل بيانات الدخول للموظف عبر وسيلة آمنة"
      >
        {credentialResult && (
          <div className="space-y-4 text-right">
            {credentialResult.existingAccount ? (
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-xs leading-6 text-blue-800 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200">
                الحساب <strong>{credentialResult.email}</strong> موجود مسبقًا، لذلك تم ربطه بنظام الموارد البشرية من غير تغيير كلمة مروره. يمكن للموظف الدخول ببياناته الحالية.
              </div>
            ) : (
              <>
                <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  <span>هذه الكلمة ستظهر هنا فقط. انسخها الآن، ولا ترسلها في قناة عامة.</span>
                </div>

                <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950">
                  <div className="text-xs text-slate-500">البريد الإلكتروني</div>
                  <div className="font-mono text-sm text-slate-900 dark:text-white" dir="ltr">{credentialResult.email}</div>
                  <div className="pt-2 text-xs text-slate-500">كلمة المرور المؤقتة</div>
                  <div className="flex items-center gap-2" dir="ltr">
                    <code className="min-w-0 flex-1 select-all break-all rounded-lg bg-white px-3 py-2 font-mono text-sm font-bold text-slate-900 dark:bg-slate-900 dark:text-white">
                      {credentialResult.temporaryPassword}
                    </code>
                    <Button type="button" variant="outline" size="icon" onClick={copyTemporaryPassword} aria-label="نسخ كلمة المرور">
                      {copied ? <CheckCircle2 className="text-emerald-600" /> : <Copy />}
                    </Button>
                  </div>
                </div>
              </>
            )}

            <Button
              type="button"
              onClick={() => {
                setCredentialResult(null);
                setCopied(false);
              }}
              className="h-10 w-full rounded-xl bg-blue-600 text-white hover:bg-blue-500"
            >
              تم الحفظ
            </Button>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={Boolean(pendingResetUser)}
        onClose={() => {
          if (!resettingUserId) setPendingResetUser(null);
        }}
        title="إعادة تعيين كلمة المرور"
        subtitle={pendingResetUser ? `إصدار كلمة مرور مؤقتة لـ ${pendingResetUser.full_name}` : undefined}
        maxWidth="sm"
      >
        {pendingResetUser && (
          <div className="space-y-5 text-right">
            <p className="text-xs leading-6 text-slate-600 dark:text-slate-300">
              سيتم إلغاء كلمة المرور الحالية وإصدار كلمة مرور مؤقتة جديدة، وسيُطلب من الموظف تغييرها عند تسجيل الدخول.
            </p>
            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                disabled={Boolean(resettingUserId)}
                onClick={() => setPendingResetUser(null)}
                className="text-slate-600 dark:text-slate-300"
              >
                إلغاء
              </Button>
              <Button
                type="button"
                disabled={Boolean(resettingUserId)}
                onClick={() => handleResetPassword(pendingResetUser)}
                className="bg-blue-600 text-white hover:bg-blue-500"
              >
                {resettingUserId ? 'جاري إعادة التعيين...' : 'تأكيد إعادة التعيين'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
