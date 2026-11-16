import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import type { HRProject, HRProjectMember, HRTask, HRUser } from '../../types/hr';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { TableSkeleton } from '../../components/ui/Skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Button } from '../../components/ui/button';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  Users,
  CheckSquare,
  Plus,
  UserPlus,
  UserX,
  AlertTriangle,
  Pencil,
  Trash2,
} from 'lucide-react';
import { getErrorMessage } from '../../lib/utils';
import { useConfirm } from '../../context/ConfirmContext';

export const ProjectDetail: React.FC = () => {
  const { id: projectId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [, setSearchParams] = useSearchParams();
  const { confirm, showAlert } = useConfirm();

  const { hrUser } = useAuth();
  const [project, setProject] = useState<HRProject | null>(null);
  const [members, setMembers] = useState<HRProjectMember[]>([]);
  const [tasks, setTasks] = useState<HRTask[]>([]);
  const [loading, setLoading] = useState(true);

  // Active Tab: 'tasks' | 'members'
  const [activeTab, setActiveTab] = useState<'tasks' | 'members'>('tasks');

  // Modals State
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<HRUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [memberAdding, setMemberAdding] = useState(false);

  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);
  const [isEditProjectOpen, setIsEditProjectOpen] = useState(false);
  const [editProjectName, setEditProjectName] = useState('');
  const [editProjectDescription, setEditProjectDescription] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskAssignees, setTaskAssignees] = useState<string[]>([]);
  const [taskDueDate, setTaskDueDate] = useState('');
  const [taskSubmitting, setTaskSubmitting] = useState(false);

  const fetchProjectData = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      // 1. Fetch Project
      const { data: projData, error: projErr } = await supabase
        .from('hr_projects')
        .select('*')
        .eq('id', projectId)
        .single();

      if (projErr) throw projErr;
      setProject(projData as HRProject);

      // 2. Fetch Members
      const { data: membData, error: memberError } = await supabase
        .from('hr_project_members')
        .select('*, hr_users(*)')
        .eq('project_id', projectId);
      if (memberError) throw memberError;

      setMembers((membData as HRProjectMember[]) || []);

      // 3. Fetch Tasks
      const { data: taskData, error: taskError } = await supabase
        .from('hr_tasks')
        .select(`
          *,
          hr_users:hr_users!hr_tasks_assignee_id_fkey(*),
          hr_task_assignees(user_id, hr_users:hr_users!hr_task_assignees_user_id_fkey(*))
        `)
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });
      if (taskError) throw taskError;

      setTasks((taskData as HRTask[]) || []);
    } catch (err) {
      console.error('Error fetching project detail:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchProjectData();
    const handleUpdate = () => fetchProjectData();
    window.addEventListener('hr:task-updated', handleUpdate);
    window.addEventListener('hr:task-deleted', handleUpdate);
    return () => {
      window.removeEventListener('hr:task-updated', handleUpdate);
      window.removeEventListener('hr:task-deleted', handleUpdate);
    };
  }, [fetchProjectData]);

  // Load available employees for Add Member modal
  const handleOpenAddMember = async () => {
    try {
      const { data: allUsers, error } = await supabase
        .from('hr_users')
        .select('*')
        .eq('is_active', true);
      if (error) throw error;

      const existingMemberIds = new Set(members.map((m) => m.user_id));
      const filtered = (allUsers as HRUser[] || []).filter((u) => !existingMemberIds.has(u.id));

      setAvailableUsers(filtered);
      if (filtered.length > 0) setSelectedUserId(filtered[0].id);
      setIsAddMemberOpen(true);
    } catch (err) {
      console.error('Failed to load available users:', err);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId || !projectId) return;
    setMemberAdding(true);

    try {
      const { error } = await supabase
        .from('hr_project_members')
        .insert({
          project_id: projectId,
          user_id: selectedUserId,
        });

      if (error) throw error;
      setIsAddMemberOpen(false);
      await fetchProjectData();
    } catch (err: unknown) {
      alert(`فشل إضافة العضو للمشروع: ${getErrorMessage(err)}`);
    } finally {
      setMemberAdding(false);
    }
  };

  const handleRemoveMember = async (member: HRProjectMember) => {
    const userName = member.hr_users?.full_name || 'العضو';
    const ok = await confirm({
      title: 'إزالة عضو من المشروع',
      message: `هل أنت متأكد من رغبتك في إزالة ${userName} من هذا المشروع؟`,
      confirmText: 'إزالة العضو',
      variant: 'warning',
    });
    if (!ok) return;

    try {
      // Execute safe member removal RPC
      const { error } = await supabase.rpc('hr_remove_project_member_safely', {
        p_project_id: projectId,
        p_user_id: member.user_id,
      });

      if (error) throw error;
      await fetchProjectData();
    } catch (err: unknown) {
      await showAlert(`لا يمكن إزالة العضو: ${getErrorMessage(err)}`);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim() || !projectId) return;
    if (taskAssignees.length === 0) {
      await showAlert('يرجى اختيار موظف واحد على الأقل للمهمة.');
      return;
    }
    setTaskSubmitting(true);

    try {
      const { data: newTask, error } = await supabase
        .from('hr_tasks')
        .insert({
          project_id: projectId,
          title: taskTitle.trim(),
          description: taskDesc.trim() || null,
          assignee_id: taskAssignees[0] || null,
          due_date: taskDueDate ? new Date(taskDueDate).toISOString() : null,
          created_by: hrUser?.id,
          status: 'todo',
        })
        .select()
        .single();

      if (error) throw error;

      if (newTask && taskAssignees.length > 0) {
        await supabase.rpc('hr_set_task_assignees', {
          p_task_id: newTask.id,
          p_user_ids: taskAssignees,
        });
      }

      setIsAddTaskOpen(false);
      setTaskTitle('');
      setTaskDesc('');
      setTaskAssignees([]);
      setTaskDueDate('');
      await fetchProjectData();
    } catch (err: unknown) {
      await showAlert(`فشل إنشاء المهمة: ${getErrorMessage(err)}`);
    } finally {
      setTaskSubmitting(false);
    }
  };

  const handleEditProject = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!projectId || !editProjectName.trim()) return;
    setTaskSubmitting(true);
    try {
      const { error } = await supabase
        .from('hr_projects')
        .update({
          name: editProjectName.trim(),
          description: editProjectDescription.trim() || null,
        })
        .eq('id', projectId);
      if (error) throw error;
      setIsEditProjectOpen(false);
      await fetchProjectData();
    } catch (error) {
      await showAlert(`فشل تعديل المشروع: ${getErrorMessage(error)}`);
    } finally {
      setTaskSubmitting(false);
    }
  };

  const handleDeleteProject = async () => {
    if (!project || !projectId) return;
    const ok = await confirm({
      title: 'حذف المشروع نهائياً',
      message: `هل أنت متأكد تماماً من حذف مشروع "${project.name}" نهائياً؟\nسيتم حذف جميع المهام التابعة له فوراً.`,
      confirmText: 'حذف المشروع',
      variant: 'danger',
    });
    if (!ok) return;

    try {
      const { error: rpcError } = await supabase.rpc('hr_admin_delete_project', {
        p_project_id: projectId,
      });

      if (rpcError) {
        const { error: directError } = await supabase
          .from('hr_projects')
          .delete()
          .eq('id', projectId);
        if (directError) throw directError;
      }

      navigate('/admin/projects');
    } catch (err: unknown) {
      await showAlert(`فشل حذف المشروع: ${getErrorMessage(err)}`);
    }
  };

  const handleDeleteTask = async (taskItem: HRTask, e: React.MouseEvent) => {
    e.stopPropagation();
    const ok = await confirm({
      title: 'حذف المهمة نهائياً',
      message: `هل أنت متأكد من حذف المهمة "${taskItem.title}" نهائياً؟`,
      confirmText: 'حذف المهمة',
      variant: 'danger',
    });
    if (!ok) return;

    try {
      const { error: rpcError } = await supabase.rpc('hr_admin_delete_task', {
        p_task_id: taskItem.id,
      });

      if (rpcError) {
        const { error: directError } = await supabase
          .from('hr_tasks')
          .delete()
          .eq('id', taskItem.id);
        if (directError) throw directError;
      }

      await fetchProjectData();
    } catch (err: unknown) {
      await showAlert(`فشل حذف المهمة: ${getErrorMessage(err)}`);
    }
  };

  const getArabicTaskStatus = (status: string) => {
    switch (status) {
      case 'todo': return 'لم تبدأ';
      case 'in_progress': return 'قيد التنفيذ';
      case 'done': return 'مكتملة';
      default: return status;
    }
  };

  const isArchived = project?.status === 'archived';

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Back Button & Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/admin/projects')}
          className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
        >
          <ArrowRight className="w-4 h-4" />
          <span>العودة لدليل المشاريع</span>
        </button>

        {project && (
          <Badge variant={project.status}>
            {project.status === 'active' ? 'نشط' : 'مؤرشف'}
          </Badge>
        )}
      </div>

      {/* Project Banner */}
      {loading ? (
        <TableSkeleton rows={2} />
      ) : project ? (
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100">{project.name}</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {project.description || 'لا يوجد وصف مخصص لهذا المشروع.'}
              </p>
            </div>

            {!isArchived && (
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  onClick={() => {
                    setEditProjectName(project.name);
                    setEditProjectDescription(project.description || '');
                    setIsEditProjectOpen(true);
                  }}
                  className="rounded-xl text-xs"
                >
                  <Pencil />
                  تعديل المشروع
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  onClick={handleDeleteProject}
                  className="rounded-xl text-xs text-rose-600 border-rose-200 dark:border-rose-900 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                >
                  <Trash2 />
                  حذف المشروع
                </Button>

                <button
                  onClick={handleOpenAddMember}
                  className="px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors"
                >
                  <UserPlus className="w-4 h-4 text-purple-500" />
                  <span>إضافة عضو</span>
                </button>

                <button
                  onClick={() => setIsAddTaskOpen(true)}
                  className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs shadow-md shadow-blue-600/20 flex items-center gap-1.5 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>مهمة جديدة</span>
                </button>
              </div>
            )}
          </div>

          {isArchived && (
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 text-amber-800 dark:text-amber-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>المشروع مؤرشف حالياً. تم إيقاف تعديل المهام ورفع الملفات.</span>
            </div>
          )}
        </div>
      ) : null}

      {/* Tabs */}
      <div className="flex items-center border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setActiveTab('tasks')}
          className={`px-4 py-2.5 text-xs font-bold flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'tasks'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <CheckSquare className="w-4 h-4" />
          <span>مهام المشروع ({tasks.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('members')}
          className={`px-4 py-2.5 text-xs font-bold flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'members'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>أعضاء الفريق ({members.length})</span>
        </button>
      </div>

      {/* Tab 1: Tasks List */}
      {activeTab === 'tasks' && (
        <div className="space-y-3">
          {tasks.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs text-slate-400">
              لم يتم إنشاء أي مهام داخل هذا المشروع حتى الآن.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  onClick={() => setSearchParams({ taskId: task.id })}
                  className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-500/50 cursor-pointer shadow-sm transition-all space-y-2 text-right"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">{task.title}</h4>
                    <Badge variant={task.status}>{getArabicTaskStatus(task.status)}</Badge>
                  </div>

                  <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                    {task.description || 'لا يوجد وصف'}
                  </p>

                  <div className="pt-2 flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-100 dark:border-slate-800">
                    <span>
                      {(() => {
                        const assignees =
                          (task.hr_task_assignees?.map((a) => a.hr_users).filter(Boolean) as HRUser[]) ||
                          (task.hr_users ? [task.hr_users] : []);
                        return assignees.length > 0
                          ? `المسند إليهم: ${assignees.map((u) => u.full_name).join('، ')}`
                          : 'المسند إليه: غير محدد';
                      })()}
                    </span>
                    <div className="flex items-center gap-2">
                      <span>
                        {task.due_date ? `موعد التسليم: ${new Date(task.due_date).toLocaleDateString('ar-EG')}` : 'بدون موعد تسليم'}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => handleDeleteTask(task, e)}
                        title="حذف المهمة"
                        className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Team Members */}
      {activeTab === 'members' && (
        <div className="space-y-3">
          {members.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs text-slate-400">
              لم يتم تعيين أي موظفين لهذا المشروع.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {members.map((member) => (
                <div
                  key={member.user_id}
                  className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs">
                      {member.hr_users?.full_name?.charAt(0) || 'م'}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        {member.hr_users?.full_name}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        الصلاحية: {member.hr_users?.role === 'admin' ? 'أدمن' : 'موظف'}
                      </p>
                    </div>
                  </div>

                  {!isArchived && (
                    <button
                      onClick={() => handleRemoveMember(member)}
                      title="إزالة العضو"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                    >
                      <UserX className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal: Add Member */}
      <Modal
        isOpen={isEditProjectOpen}
        onClose={() => setIsEditProjectOpen(false)}
        title="تعديل المشروع"
        subtitle="حدّث اسم المشروع ووصفه"
      >
        <form onSubmit={handleEditProject} className="space-y-4 text-right">
          <label className="block space-y-1 text-xs font-bold text-slate-700 dark:text-slate-300">
            <span>اسم المشروع *</span>
            <input
              required
              value={editProjectName}
              onChange={(event) => setEditProjectName(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800"
            />
          </label>
          <label className="block space-y-1 text-xs font-bold text-slate-700 dark:text-slate-300">
            <span>الوصف</span>
            <textarea
              rows={4}
              value={editProjectDescription}
              onChange={(event) => setEditProjectDescription(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800"
            />
          </label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setIsEditProjectOpen(false)}>إلغاء</Button>
            <Button type="submit" disabled={taskSubmitting}>حفظ التعديلات</Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Add Member */}
      <Modal
        isOpen={isAddMemberOpen}
        onClose={() => setIsAddMemberOpen(false)}
        title="إضافة عضو للمشروع"
        subtitle="اختر موظفاً فعالاً لتمكينه من الوصول للمشروع والمهام"
      >
        {availableUsers.length === 0 ? (
          <p className="text-xs text-slate-400 italic text-center py-4">
            جميع الموظفين الفعالين مضافون بالفعل كأعضاء في هذا المشروع.
          </p>
        ) : (
          <form onSubmit={handleAddMember} className="space-y-4 text-right">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                اختر الموظف
              </label>
              <Select
                value={selectedUserId}
                onValueChange={(value) => value && setSelectedUserId(value)}
                items={availableUsers.map((user) => ({
                  value: user.id,
                  label: `${user.full_name} (${user.role === 'admin' ? 'أدمن' : 'موظف'})`,
                }))}
              >
                <SelectTrigger className="h-10 w-full rounded-xl border-slate-200 bg-slate-50 text-xs dark:border-slate-700 dark:bg-slate-800">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="start">
                  {availableUsers.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.full_name} ({u.role === 'admin' ? 'أدمن' : 'موظف'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsAddMemberOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={memberAdding}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl text-xs shadow-md shadow-purple-600/20"
              >
                {memberAdding ? 'جاري الإضافة...' : 'إضافة للمشروع'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Modal: Add Task */}
      <Modal
        isOpen={isAddTaskOpen}
        onClose={() => setIsAddTaskOpen(false)}
        title="إنشاء مهمة جديدة"
        subtitle="يجب إسناد المهمة حصراً إلى أحد أعضاء الفريق في المشروع"
      >
        <form onSubmit={handleCreateTask} className="space-y-4 text-right">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              عنوان المهمة *
            </label>
            <input
              type="text"
              required
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              placeholder="مثال: إعداد وثائق الموارد البشرية"
              className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              وصف المهمة
            </label>
            <textarea
              rows={3}
              value={taskDesc}
              onChange={(e) => setTaskDesc(e.target.value)}
              placeholder="تعليمات وتفاصيل المهمة..."
              className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                الموظفون المسند إليهم المهمة (أعضاء المشروع فقط) *
              </label>
              {members.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    if (taskAssignees.length === members.length) {
                      setTaskAssignees([]);
                    } else {
                      setTaskAssignees(members.map((m) => m.user_id));
                    }
                  }}
                  className="text-[11px] font-bold text-blue-600 hover:text-blue-500 cursor-pointer"
                >
                  {taskAssignees.length === members.length
                    ? 'إلغاء تحديد الكل'
                    : 'تحديد جميع أعضاء المشروع'}
                </button>
              )}
            </div>

            {members.length === 0 ? (
              <p className="text-xs text-rose-500 bg-rose-50 dark:bg-rose-950/40 p-2.5 rounded-xl border border-rose-200 dark:border-rose-900">
                لا يوجد أعضاء في المشروع! يرجى إضافة عضو للمشروع أولاً قبل إنشاء المهام.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                {members.map((m) => {
                  const isSelected = taskAssignees.includes(m.user_id);
                  return (
                    <label
                      key={m.user_id}
                      className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer border transition-all text-xs select-none ${
                        isSelected
                          ? 'bg-blue-50/80 border-blue-500/80 text-blue-900 dark:bg-blue-950/40 dark:border-blue-700 dark:text-blue-200 shadow-xs'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {
                          if (isSelected) {
                            setTaskAssignees(taskAssignees.filter((id) => id !== m.user_id));
                          } else {
                            setTaskAssignees([...taskAssignees, m.user_id]);
                          }
                        }}
                        className="size-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500"
                      />
                      <div className="size-6 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                        {m.hr_users?.full_name?.charAt(0) || 'م'}
                      </div>
                      <span className="font-semibold truncate flex-1">{m.hr_users?.full_name}</span>
                      <span className="text-[10px] text-slate-400">({m.hr_users?.role === 'admin' ? 'أدمن' : 'موظف'})</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              موعد التسليم (اختياري)
            </label>
            <input
              type="date"
              value={taskDueDate}
              onChange={(e) => setTaskDueDate(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsAddTaskOpen(false)}
              className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={taskSubmitting || members.length === 0}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs shadow-md shadow-blue-600/20 disabled:opacity-50"
            >
              {taskSubmitting ? 'جاري الإنشاء...' : 'إنشاء المهمة'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
