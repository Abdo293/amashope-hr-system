import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import type { HRTask, HRProject, HRUser, TaskStatus } from '../../types/hr';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { TableSkeleton } from '../../components/ui/Skeleton';
import { useSearchParams } from 'react-router-dom';
import {
  CheckSquare,
  Plus,
  Search,
  Calendar,
  Clock,
  FolderKanban,
  Pencil,
  Trash2,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import { getErrorMessage } from '../../lib/utils';
import { useConfirm } from '../../context/ConfirmContext';

export const TasksList: React.FC = () => {
  const { user: signedInUser } = useAuth();
  const { confirm, showAlert } = useConfirm();
  const [, setSearchParams] = useSearchParams();

  const [tasks, setTasks] = useState<HRTask[]>([]);
  const [projects, setProjects] = useState<HRProject[]>([]);
  const [employees, setEmployees] = useState<HRUser[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | TaskStatus>('all');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [employeeFilter, setEmployeeFilter] = useState<string>('all');

  // Modal: Create Task
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createProjectId, setCreateProjectId] = useState('');
  const [createAssigneeId, setCreateAssigneeId] = useState('');
  const [createTitle, setCreateTitle] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [createDueDate, setCreateDueDate] = useState('');
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Modal: Edit Task
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<HRTask | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editAssigneeId, setEditAssigneeId] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [editStatus, setEditStatus] = useState<TaskStatus>('todo');
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Load dropdown options (projects and employees)
  const loadOptions = useCallback(async () => {
    try {
      const [projRes, empRes] = await Promise.all([
        supabase.from('hr_projects').select('*').order('name'),
        supabase.from('hr_users').select('*').eq('is_active', true).order('full_name'),
      ]);
      if (projRes.data) {
        setProjects(projRes.data as HRProject[]);
        if (projRes.data.length > 0 && !createProjectId) {
          const activeProj = projRes.data.find((p) => p.status === 'active') || projRes.data[0];
          setCreateProjectId(activeProj.id);
        }
      }
      if (empRes.data) {
        setEmployees(empRes.data as HRUser[]);
        if (empRes.data.length > 0 && !createAssigneeId) {
          setCreateAssigneeId(empRes.data[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load options:', err);
    }
  }, [createProjectId, createAssigneeId]);

  // Fetch all tasks
  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('hr_tasks')
        .select(`
          *,
          hr_users:hr_users!hr_tasks_assignee_id_fkey(*),
          hr_projects:project_id(*)
        `)
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }
      if (projectFilter !== 'all') {
        query = query.eq('project_id', projectFilter);
      }
      if (employeeFilter !== 'all') {
        query = query.eq('assignee_id', employeeFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      setTasks((data as HRTask[]) || []);
    } catch (err) {
      console.error('Failed to fetch tasks:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, projectFilter, employeeFilter]);

  useEffect(() => {
    void loadOptions();
  }, [loadOptions]);

  useEffect(() => {
    void fetchTasks();
    const handleUpdate = () => void fetchTasks();
    window.addEventListener('hr:task-updated', handleUpdate);
    window.addEventListener('hr:task-deleted', handleUpdate);
    return () => {
      window.removeEventListener('hr:task-updated', handleUpdate);
      window.removeEventListener('hr:task-deleted', handleUpdate);
    };
  }, [fetchTasks]);

  // Handle open drawer
  const handleOpenDrawer = (taskId: string) => {
    setSearchParams({ taskId });
  };

  // Handle Create Task
  const handleOpenCreateModal = () => {
    setCreateTitle('');
    setCreateDescription('');
    setCreateDueDate('');
    setCreateError(null);
    setIsCreateModalOpen(true);
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createProjectId || !createAssigneeId || !createTitle.trim()) return;

    setCreateSubmitting(true);
    setCreateError(null);

    try {
      // Ensure assignee is member of project
      await supabase.from('hr_project_members').upsert({
        project_id: createProjectId,
        user_id: createAssigneeId,
      });

      const { error } = await supabase.from('hr_tasks').insert({
        project_id: createProjectId,
        assignee_id: createAssigneeId,
        title: createTitle.trim(),
        description: createDescription.trim() || null,
        due_date: createDueDate ? new Date(createDueDate).toISOString() : null,
        status: 'todo',
        created_by: signedInUser?.id,
      });

      if (error) throw error;

      setIsCreateModalOpen(false);
      await fetchTasks();
    } catch (err: unknown) {
      setCreateError(getErrorMessage(err, 'فشل إنشاء المهمة'));
    } finally {
      setCreateSubmitting(false);
    }
  };

  // Handle Edit Task
  const handleOpenEditModal = (task: HRTask) => {
    setEditingTask(task);
    setEditTitle(task.title);
    setEditDescription(task.description || '');
    setEditAssigneeId(task.assignee_id || '');
    setEditStatus(task.status);
    setEditDueDate(task.due_date ? new Date(task.due_date).toISOString().slice(0, 16) : '');
    setEditError(null);
    setIsEditModalOpen(true);
  };

  const handleSaveEditTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask || !editTitle.trim()) return;

    setEditSubmitting(true);
    setEditError(null);

    try {
      if (editAssigneeId && editAssigneeId !== editingTask.assignee_id) {
        await supabase.from('hr_project_members').upsert({
          project_id: editingTask.project_id,
          user_id: editAssigneeId,
        });
      }

      const { error } = await supabase
        .from('hr_tasks')
        .update({
          title: editTitle.trim(),
          description: editDescription.trim() || null,
          assignee_id: editAssigneeId || null,
          status: editStatus,
          due_date: editDueDate ? new Date(editDueDate).toISOString() : null,
        })
        .eq('id', editingTask.id);

      if (error) throw error;

      setIsEditModalOpen(false);
      setEditingTask(null);
      await fetchTasks();
    } catch (err: unknown) {
      setEditError(getErrorMessage(err, 'فشل حفظ تعديلات المهمة'));
    } finally {
      setEditSubmitting(false);
    }
  };

  // Handle Delete Task
  const handleDeleteTask = async (task: HRTask) => {
    const ok = await confirm({
      title: 'حذف المهمة نهائياً',
      message: `هل أنت متأكد من حذف المهمة "${task.title}" نهائياً؟\nسيتم حذف كافة الملفات وسجلات النشاط المرتبطة بها.`,
      confirmText: 'حذف المهمة',
      variant: 'danger',
    });
    if (!ok) return;

    try {
      const { error: rpcErr } = await supabase.rpc('hr_admin_delete_task', {
        p_task_id: task.id,
      });

      if (rpcErr) {
        const { error: delErr } = await supabase.from('hr_tasks').delete().eq('id', task.id);
        if (delErr) throw delErr;
      }

      await fetchTasks();
    } catch (err: unknown) {
      await showAlert(`فشل حذف المهمة: ${getErrorMessage(err)}`);
    }
  };

  // Filtered tasks in memory by search query
  const filteredTasks = useMemo(() => {
    if (!search.trim()) return tasks;
    const q = search.toLowerCase().trim();
    return tasks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        (t.description && t.description.toLowerCase().includes(q)) ||
        (t.hr_users?.full_name && t.hr_users.full_name.toLowerCase().includes(q)) ||
        (t.hr_projects?.name && t.hr_projects.name.toLowerCase().includes(q))
    );
  }, [tasks, search]);

  const todoCount = tasks.filter((t) => t.status === 'todo').length;
  const inProgressCount = tasks.filter((t) => t.status === 'in_progress').length;
  const doneCount = tasks.filter((t) => t.status === 'done').length;

  const getArabicTaskStatus = (status: string) => {
    switch (status) {
      case 'todo': return 'لم تبدأ';
      case 'in_progress': return 'قيد التنفيذ';
      case 'done': return 'مكتملة';
      default: return status;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight m-0">
            إدارة المهام
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            متابعة وإسناد وتعديل وحذف مهام الموظفين عبر كافة المشاريع
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void fetchTasks()}
            disabled={loading}
            className="rounded-xl font-bold h-10"
          >
            <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
            تحديث
          </Button>

          <Button
            onClick={handleOpenCreateModal}
            className="h-10 px-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-blue-600/25 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة مهمة جديدة</span>
          </Button>
        </div>
      </div>

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 flex items-center justify-center font-bold">
            <CheckSquare className="size-5" />
          </div>
          <div>
            <p className="text-xl font-black text-slate-900 dark:text-slate-100">{tasks.length}</p>
            <p className="text-[11px] font-semibold text-slate-500">إجمالي المهام</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 flex items-center justify-center font-bold">
            <Clock className="size-5" />
          </div>
          <div>
            <p className="text-xl font-black text-slate-900 dark:text-slate-100">{todoCount}</p>
            <p className="text-[11px] font-semibold text-slate-500">لم تبدأ</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400 flex items-center justify-center font-bold">
            <Clock className="size-5" />
          </div>
          <div>
            <p className="text-xl font-black text-slate-900 dark:text-slate-100">{inProgressCount}</p>
            <p className="text-[11px] font-semibold text-slate-500">قيد التنفيذ</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 flex items-center justify-center font-bold">
            <CheckCircle2 className="size-5" />
          </div>
          <div>
            <p className="text-xl font-black text-slate-900 dark:text-slate-100">{doneCount}</p>
            <p className="text-[11px] font-semibold text-slate-500">مكتملة</p>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        {/* Status Pills */}
        <div className="flex items-center gap-1.5 flex-wrap border-b border-slate-100 dark:border-slate-800 pb-3">
          {(
            [
              { id: 'all', label: 'جميع الحالات' },
              { id: 'todo', label: 'لم تبدأ' },
              { id: 'in_progress', label: 'قيد التنفيذ' },
              { id: 'done', label: 'مكتملة' },
            ] as const
          ).map((s) => (
            <button
              key={s.id}
              onClick={() => setStatusFilter(s.id)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                statusFilter === s.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Search & Dropdowns */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute right-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث باسم المهمة أو الموظف..."
              className="w-full pr-9 pl-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">جميع المشاريع</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={employeeFilter}
              onChange={(e) => setEmployeeFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">جميع الموظفين</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.full_name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Tasks Grid */}
      {loading ? (
        <TableSkeleton rows={4} />
      ) : filteredTasks.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
          <CheckSquare className="w-12 h-12 text-slate-400 mx-auto" />
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">لا توجد مهام مطابقة</h3>
          <p className="text-xs text-slate-400">أضف مهمة جديدة أو غيّر معايير الفلترة.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTasks.map((task) => (
            <div
              key={task.id}
              className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between space-y-4 hover:border-blue-300 transition-all"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <button
                      onClick={() => handleOpenDrawer(task.id)}
                      className="text-right text-sm font-bold text-slate-900 dark:text-slate-100 hover:text-blue-600 transition-colors line-clamp-2"
                    >
                      {task.title}
                    </button>
                    <p className="text-[11px] font-semibold text-slate-400 mt-1 flex items-center gap-1 truncate">
                      <FolderKanban className="size-3 shrink-0" />
                      <span>{task.hr_projects?.name || 'مشروع غير محدد'}</span>
                    </p>
                  </div>
                  <Badge variant={task.status} size="sm">
                    {getArabicTaskStatus(task.status)}
                  </Badge>
                </div>

                {task.description && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-xl">
                    {task.description}
                  </p>
                )}

                <div className="space-y-1.5 pt-1 text-xs text-slate-500 dark:text-slate-400">
                  <div className="flex items-center gap-2">
                    <div className="size-6 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                      {task.hr_users?.full_name?.charAt(0) || 'م'}
                    </div>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                      {task.hr_users?.full_name || 'غير مسندة'}
                    </span>
                  </div>

                  {task.due_date && (
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                      <Calendar className="size-3.5 shrink-0" />
                      <span>الاستحقاق: {new Date(task.due_date).toLocaleDateString('ar-EG')}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleOpenDrawer(task.id)}
                  className="flex-1 rounded-xl text-xs font-bold h-8"
                >
                  <ExternalLink className="size-3" />
                  <span>التفاصيل</span>
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleOpenEditModal(task)}
                  className="rounded-xl text-xs font-bold h-8 px-2.5 text-slate-600 dark:text-slate-300"
                  title="تعديل المهمة"
                >
                  <Pencil className="size-3.5" />
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleDeleteTask(task)}
                  className="rounded-xl text-xs font-bold h-8 px-2.5 border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-900/50 dark:text-rose-400"
                  title="حذف المهمة"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Create Task */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => !createSubmitting && setIsCreateModalOpen(false)}
        title="إضافة مهمة جديدة"
        subtitle="إسناد مهمة عمل إلى موظف في أحد المشاريع"
      >
        <form onSubmit={handleCreateTask} className="space-y-4 text-right">
          {createError && (
            <div className="p-3 rounded-xl bg-rose-50 text-rose-700 text-xs border border-rose-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{createError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              المشروع *
            </label>
            <select
              value={createProjectId}
              onChange={(e) => setCreateProjectId(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              الموظف المسند إليه *
            </label>
            <select
              value={createAssigneeId}
              onChange={(e) => setCreateAssigneeId(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.full_name} ({emp.role === 'admin' ? 'أدمن' : 'موظف'})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              عنوان المهمة *
            </label>
            <input
              type="text"
              required
              value={createTitle}
              onChange={(e) => setCreateTitle(e.target.value)}
              placeholder="مثال: إعداد التقرير المالي لشهر أكتوبر"
              className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              الوصف والتعليمات (اختياري)
            </label>
            <textarea
              rows={3}
              value={createDescription}
              onChange={(e) => setCreateDescription(e.target.value)}
              placeholder="توضيح تفاصيل المطلوب للموظف..."
              className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              موعد الاستحقاق (اختياري)
            </label>
            <input
              type="datetime-local"
              value={createDueDate}
              onChange={(e) => setCreateDueDate(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              disabled={createSubmitting}
              onClick={() => setIsCreateModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={createSubmitting}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/20 disabled:opacity-50"
            >
              {createSubmitting ? 'جاري الإضافة...' : 'إضافة المهمة'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Edit Task */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => !editSubmitting && setIsEditModalOpen(false)}
        title="تعديل المهمة"
        subtitle={editingTask?.title || undefined}
      >
        <form onSubmit={handleSaveEditTask} className="space-y-4 text-right">
          {editError && (
            <div className="p-3 rounded-xl bg-rose-50 text-rose-700 text-xs border border-rose-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{editError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              عنوان المهمة *
            </label>
            <input
              type="text"
              required
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              الموظف المسند إليه
            </label>
            <select
              value={editAssigneeId}
              onChange={(e) => setEditAssigneeId(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">بدون إسناد</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.full_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              حالة المهمة *
            </label>
            <Select
              value={editStatus}
              onValueChange={(val) => val && setEditStatus(val as TaskStatus)}
              items={{ todo: 'لم تبدأ', in_progress: 'قيد التنفيذ', done: 'مكتملة' }}
            >
              <SelectTrigger className="h-10 w-full rounded-xl border-slate-200 bg-slate-50 text-xs dark:border-slate-700 dark:bg-slate-800">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="start">
                <SelectItem value="todo">لم تبدأ</SelectItem>
                <SelectItem value="in_progress">قيد التنفيذ</SelectItem>
                <SelectItem value="done">مكتملة</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              الوصف والتعليمات
            </label>
            <textarea
              rows={3}
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              موعد الاستحقاق
            </label>
            <input
              type="datetime-local"
              value={editDueDate}
              onChange={(e) => setEditDueDate(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              disabled={editSubmitting}
              onClick={() => setIsEditModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={editSubmitting}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/20 disabled:opacity-50"
            >
              {editSubmitting ? 'جاري الحفظ...' : 'حفظ التعديلات'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
