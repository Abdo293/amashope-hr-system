import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import type { HRTask, HRTaskFile, HRTaskActivity, HRProjectMember, TaskStatus } from '../../types/hr';
import { Drawer } from '../ui/Drawer';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/button';
import { uploadFileToR2, getFileDownloadUrl, deleteTaskFile } from '../../lib/r2-client';
import { useSearchParams } from 'react-router-dom';
import {
  Calendar,
  CheckCircle2,
  FileText,
  UploadCloud,
  Trash2,
  Download,
  Eye,
  AlertCircle,
  Loader2,
  History,
  FileCode,
  Image as ImageIcon,
  Video,
  Pencil,
  RefreshCw,
  Users,
} from 'lucide-react';
import { getErrorMessage } from '../../lib/utils';
import { useConfirm } from '../../context/ConfirmContext';

export const TaskDetailDrawer: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const taskId = searchParams.get('taskId');
  const { confirm, showAlert } = useConfirm();

  const { hrUser } = useAuth();
  const [task, setTask] = useState<HRTask | null>(null);
  const [files, setFiles] = useState<HRTaskFile[]>([]);
  const [activities, setActivities] = useState<HRTaskActivity[]>([]);
  const [projectMembers, setProjectMembers] = useState<HRProjectMember[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [statusUpdating, setStatusUpdating] = useState<boolean>(false);

  // File Upload State
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // File Preview Modal State
  const [previewFile, setPreviewFile] = useState<{ name: string; url: string; mime: string } | null>(null);
  const [previewLoading, setPreviewLoading] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editDueDate, setEditDueDate] = useState('');

  const onClose = () => {
    searchParams.delete('taskId');
    setSearchParams(searchParams);
  };

  const fetchTaskDetails = useCallback(async () => {
    if (!taskId) return;
    setLoading(true);
    setLoadError(null);
    setTask(null);
    try {
      // Fetch task
      const { data: taskData, error: taskErr } = await supabase
        .from('hr_tasks')
        .select(`
          *,
          hr_users:hr_users!hr_tasks_assignee_id_fkey(*),
          hr_projects(*),
          hr_task_assignees(user_id, hr_users:hr_users!hr_task_assignees_user_id_fkey(*))
        `)
        .eq('id', taskId)
        .single();

      if (taskErr) throw taskErr;
      setTask(taskData as HRTask);

      if (hrUser?.role === 'admin') {
        const { data: memberData, error: memberError } = await supabase
          .from('hr_project_members')
          .select('*, hr_users(*)')
          .eq('project_id', taskData.project_id);
        if (memberError) throw memberError;
        setProjectMembers((memberData as HRProjectMember[]) || []);
      } else {
        setProjectMembers([]);
      }

      // Fetch files
      const { data: filesData, error: filesError } = await supabase
        .from('hr_task_files')
        .select('*, hr_users(*)')
        .eq('task_id', taskId)
        .order('created_at', { ascending: false });
      if (filesError) throw filesError;

      setFiles((filesData as HRTaskFile[]) || []);

      // Fetch activities
      const { data: activityData, error: activityError } = await supabase
        .from('hr_task_activity')
        .select('*, hr_users(*)')
        .eq('task_id', taskId)
        .order('created_at', { ascending: false });
      if (activityError) throw activityError;

      setActivities((activityData as HRTaskActivity[]) || []);
    } catch (err) {
      console.error('Error fetching task details:', err);
      setLoadError('تعذّر تحميل تفاصيل المهمة. تحقق من الاتصال ثم حاول مرة أخرى.');
    } finally {
      setLoading(false);
    }
  }, [taskId, hrUser]);

  useEffect(() => {
    setEditing(false);
    if (taskId) {
      fetchTaskDetails();
    } else {
      setTask(null);
      setLoadError(null);
      setFiles([]);
      setActivities([]);
      setProjectMembers([]);
    }
  }, [taskId, fetchTaskDetails]);

  const handleStatusChange = async (newStatus: TaskStatus) => {
    if (!task) return;
    setStatusUpdating(true);
    try {
      const { data, error } = await supabase.rpc('hr_update_task_status', {
        p_task_id: task.id,
        p_new_status: newStatus,
      });

      if (error) throw error;

      if (data?.success) {
        await fetchTaskDetails();
      }
    } catch (err: unknown) {
      alert(`فشل تغيير حالة المهمة: ${getErrorMessage(err)}`);
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile || !task) return;

    setUploading(true);
    setUploadProgress(0);
    setUploadError(null);

    try {
      await uploadFileToR2(task.id, selectedFile, (percent) => setUploadProgress(percent));
      await fetchTaskDetails();
    } catch (err: unknown) {
      setUploadError(getErrorMessage(err, 'فشل رفع الملف. يرجى المحاولة مرة أخرى.'));
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleToggleAssignee = async (userId: string) => {
    if (!task) return;
    const currentAssigneeIds =
      task.hr_task_assignees?.map((a) => a.user_id) || (task.assignee_id ? [task.assignee_id] : []);
    let newAssigneeIds: string[];
    if (currentAssigneeIds.includes(userId)) {
      if (currentAssigneeIds.length <= 1) {
        alert('يجب أن تحتوي المهمة على موظف مسند إليه واحد على الأقل.');
        return;
      }
      newAssigneeIds = currentAssigneeIds.filter((id) => id !== userId);
    } else {
      newAssigneeIds = [...currentAssigneeIds, userId];
    }

    setStatusUpdating(true);
    try {
      const { data, error } = await supabase.rpc('hr_set_task_assignees', {
        p_task_id: task.id,
        p_user_ids: newAssigneeIds,
      });
      if (error || !data?.success) throw error || new Error('فشل تحديث موظفي المهمة');
      await fetchTaskDetails();
      window.dispatchEvent(new CustomEvent('hr:task-updated', { detail: { taskId: task.id } }));
    } catch (error) {
      alert(`فشل تحديث الإسناد: ${getErrorMessage(error)}`);
    } finally {
      setStatusUpdating(false);
    }
  };

  const startEditing = () => {
    if (!task) return;
    setEditTitle(task.title);
    setEditDescription(task.description || '');
    setEditDueDate(task.due_date ? new Date(task.due_date).toISOString().slice(0, 10) : '');
    setEditing(true);
  };

  const handleSaveTask = async () => {
    if (!task || !editTitle.trim()) return;
    setStatusUpdating(true);
    try {
      const { error } = await supabase
        .from('hr_tasks')
        .update({
          title: editTitle.trim(),
          description: editDescription.trim() || null,
          due_date: editDueDate ? new Date(editDueDate).toISOString() : null,
        })
        .eq('id', task.id);
      if (error) throw error;
      setEditing(false);
      await fetchTaskDetails();
      window.dispatchEvent(new CustomEvent('hr:task-updated', { detail: { taskId: task.id } }));
    } catch (error) {
      alert(`فشل تعديل المهمة: ${getErrorMessage(error)}`);
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleDeleteTask = async () => {
    if (!task) return;
    const ok = await confirm({
      title: 'حذف المهمة نهائياً',
      message: `هل أنت متأكد من حذف المهمة "${task.title}" نهائياً؟\nسيتم حذف جميع المرفقات وسجل الأنشطة التابع لها.`,
      confirmText: 'حذف المهمة',
      variant: 'danger',
    });
    if (!ok) return;

    setStatusUpdating(true);
    try {
      const { error: rpcErr } = await supabase.rpc('hr_admin_delete_task', {
        p_task_id: task.id,
      });
      if (rpcErr) {
        const { error: delErr } = await supabase.from('hr_tasks').delete().eq('id', task.id);
        if (delErr) throw delErr;
      }
      onClose();
      window.dispatchEvent(new CustomEvent('hr:task-deleted', { detail: { taskId: task.id } }));
    } catch (err) {
      await showAlert(`فشل حذف المهمة: ${getErrorMessage(err)}`);
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleDownload = async (fileId: string) => {
    try {
      const url = await getFileDownloadUrl(fileId);
      window.open(url, '_blank');
    } catch (err: unknown) {
      await showAlert(`فشل التحميل: ${getErrorMessage(err)}`);
    }
  };

  const handlePreview = async (file: HRTaskFile) => {
    setPreviewLoading(file.id);
    try {
      const url = await getFileDownloadUrl(file.id);
      setPreviewFile({ name: file.original_name, url, mime: file.mime_type });
    } catch (err: unknown) {
      await showAlert(`فشل المعاينة: ${getErrorMessage(err)}`);
    } finally {
      setPreviewLoading(null);
    }
  };

  const handleDeleteFile = async (fileId: string) => {
    const ok = await confirm({
      title: 'حذف الملف المرفق',
      message: 'هل أنت متأكد من رغبتك في حذف هذا الملف المرفق؟ لا يمكن التراجع عن هذا الإجراء.',
      confirmText: 'حذف الملف',
      variant: 'danger',
    });
    if (!ok) return;

    try {
      await deleteTaskFile(fileId);
      await fetchTaskDetails();
    } catch (err: unknown) {
      await showAlert(`فشل حذف الملف: ${getErrorMessage(err)}`);
    }
  };

  if (!taskId) return null;

  const isProjectArchived = task?.hr_projects?.status === 'archived';
  const isAdmin = hrUser?.role === 'admin';
  const isAssignee =
    task?.assignee_id === hrUser?.id ||
    Boolean(task?.hr_task_assignees?.some((a) => a.user_id === hrUser?.id));
  const canUpdateStatus = !isProjectArchived && (isAdmin || isAssignee);
  const canUploadFiles = !isProjectArchived && !isAdmin && isAssignee;
  const latestFile = files[0];

  const getFileIcon = (mime: string) => {
    if (mime.startsWith('image/')) return <ImageIcon className="w-4 h-4 text-blue-500" />;
    if (mime.startsWith('video/')) return <Video className="w-4 h-4 text-purple-500" />;
    if (mime.includes('pdf')) return <FileText className="w-4 h-4 text-rose-500" />;
    return <FileCode className="w-4 h-4 text-slate-500" />;
  };

  const canPreviewFile = (mime: string) =>
    mime.startsWith('image/') || mime.startsWith('video/') || mime === 'application/pdf';

  const getActivityLabel = (activity: HRTaskActivity) => {
    switch (activity.action) {
      case 'TASK_CREATED': return 'أنشأ المهمة';
      case 'TASK_UPDATED': return 'عدّل بيانات المهمة';
      case 'TASK_REASSIGNED': return 'أعاد إسناد المهمة';
      case 'FILE_UPLOADED': return 'رفع ملفًا جديدًا';
      case 'FILE_DELETED': return 'حذف ملفًا مرفقًا';
      case 'STATUS_CHANGE': return `غيّر الحالة إلى ${getArabicTaskStatus(activity.new_status || '')}`;
      default: return 'نفّذ تحديثًا على المهمة';
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

  return (
    <Drawer
      isOpen={!!taskId}
      onClose={onClose}
      title={task?.title || 'تفاصيل المهمة'}
      subtitle={task?.hr_projects ? `المشروع: ${task.hr_projects.name}` : ''}
      width="xl"
    >
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        </div>
      ) : loadError ? (
        <div className="flex min-h-[60vh] items-center justify-center p-4" dir="rtl">
          <div className="w-full max-w-sm rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center dark:border-rose-900 dark:bg-rose-950/30">
            <AlertCircle className="mx-auto size-10 text-rose-500" />
            <h3 className="mt-3 text-sm font-black text-slate-900 dark:text-slate-100">لم نتمكن من فتح المهمة</h3>
            <p className="mt-2 text-xs leading-6 text-slate-600 dark:text-slate-400">{loadError}</p>
            <Button type="button" onClick={fetchTaskDetails} className="mt-4 bg-blue-600 text-white hover:bg-blue-500">
              <RefreshCw />
              إعادة المحاولة
            </Button>
          </div>
        </div>
      ) : task ? (
        <div className="space-y-6 text-right font-sans" dir="rtl">
          {/* Status Header Bar */}
          <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">الحالة الحالية:</span>
              <Badge variant={task.status}>{getArabicTaskStatus(task.status)}</Badge>
              {isProjectArchived && <Badge variant="archived">مشروع مؤرشف</Badge>}
            </div>

            {/* Status Change Buttons */}
            {canUpdateStatus && (
              <div className="flex items-center gap-1.5">
                {task.status !== 'todo' && (
                  <button
                    disabled={statusUpdating}
                    onClick={() => handleStatusChange('todo')}
                    className="px-3 py-1 rounded-lg text-xs font-bold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 transition-colors"
                  >
                    لم تبدأ
                  </button>
                )}
                {task.status !== 'in_progress' && (
                  <button
                    disabled={statusUpdating}
                    onClick={() => handleStatusChange('in_progress')}
                    className="px-3 py-1 rounded-lg text-xs font-bold bg-amber-500 text-white hover:bg-amber-600 transition-colors shadow-sm"
                  >
                    بدء التنفيذ
                  </button>
                )}
                {task.status !== 'done' && (
                  <button
                    disabled={statusUpdating}
                    onClick={() => handleStatusChange('done')}
                    className="px-3 py-1 rounded-lg text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-sm flex items-center gap-1"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    إكمال المهمة
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Employee deliverable upload is intentionally placed at the top so it
              is the first action the assigned employee sees. */}
          {canUploadFiles && (
            <div className="rounded-2xl border-2 border-dashed border-blue-300 bg-blue-50/70 p-5 text-center dark:border-blue-800 dark:bg-blue-950/20">
              <input
                type="file"
                id="task-file-input"
                onChange={handleFileUpload}
                disabled={uploading}
                className="hidden"
                accept="image/png,image/jpeg,image/webp,image/gif,application/pdf,video/mp4,video/webm,video/quicktime,text/csv,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip"
              />
              <label htmlFor="task-file-input" className="flex cursor-pointer flex-col items-center justify-center gap-2">
                <span className="flex size-11 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/20">
                  <UploadCloud className="size-5" />
                </span>
                <span className="text-sm font-black text-slate-800 dark:text-slate-100">
                  {uploading ? `جاري رفع الملف... ${uploadProgress}%` : 'رفع ملفات التنفيذ'}
                </span>
                <span className="text-[11px] leading-5 text-slate-500 dark:text-slate-400">
                  اضغط هنا لاختيار صور أو PDF أو فيديو أو ملفات Word وExcel وZIP
                </span>
              </label>

              {uploading && (
                <div className="mx-auto mt-4 h-2 w-full max-w-md overflow-hidden rounded-full bg-blue-100 dark:bg-slate-700">
                  <div
                    className="h-2 rounded-full bg-blue-600 transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              )}

              {uploadError && (
                <div className="mt-3 flex items-center justify-center gap-1 text-xs font-bold text-rose-500">
                  <AlertCircle className="size-3.5" />
                  <span>{uploadError}</span>
                </div>
              )}
            </div>
          )}

          {isAdmin && projectMembers.length > 0 && !isProjectArchived && (
            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Users className="size-4 text-blue-600 dark:text-blue-400" />
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-200">
                    الموظفون المكلفون بالمهمة ({task.hr_task_assignees?.length || (task.assignee_id ? 1 : 0)})
                  </label>
                </div>
                <span className="text-[11px] text-slate-400">انقر لإضافة أو إزالة موظف</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {projectMembers.map((member) => {
                  const isAssigned =
                    task.hr_task_assignees?.some((a) => a.user_id === member.user_id) ||
                    task.assignee_id === member.user_id;
                  return (
                    <button
                      key={member.user_id}
                      type="button"
                      disabled={statusUpdating}
                      onClick={() => handleToggleAssignee(member.user_id)}
                      className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition-all ${
                        isAssigned
                          ? 'border border-blue-500 bg-blue-50 text-blue-700 shadow-sm dark:border-blue-600 dark:bg-blue-950/50 dark:text-blue-300'
                          : 'border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400 dark:hover:bg-slate-800'
                      }`}
                    >
                      <span
                        className={`size-2 rounded-full ${
                          isAssigned ? 'bg-blue-600 dark:bg-blue-400' : 'bg-slate-300 dark:bg-slate-600'
                        }`}
                      />
                      <span>{member.hr_users?.full_name || 'موظف'}</span>
                      {isAssigned && (
                        <CheckCircle2 className="size-3.5 text-blue-600 dark:text-blue-400" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Description & Assignee Metadata */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">الوصف والتعليمات</h4>
              <div className="flex items-center gap-2">
                {!isProjectArchived && (isAdmin || isAssignee) && !editing && (
                  <Button type="button" variant="outline" size="sm" onClick={startEditing} className="h-8 gap-1.5 text-xs">
                    <Pencil className="size-3.5" /> تعديل المهمة
                  </Button>
                )}
                {isAdmin && !isProjectArchived && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleDeleteTask}
                    disabled={statusUpdating}
                    className="h-8 gap-1.5 text-xs border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-900/50 dark:text-rose-400 dark:hover:bg-rose-950/30"
                  >
                    <Trash2 className="size-3.5" /> حذف المهمة
                  </Button>
                )}
              </div>
            </div>
            {editing ? (
              <div className="space-y-3 rounded-xl border border-blue-200 bg-blue-50/40 p-4 dark:border-blue-900 dark:bg-blue-950/20">
                <input
                  value={editTitle}
                  onChange={(event) => setEditTitle(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900"
                  placeholder="عنوان المهمة"
                />
                <textarea
                  rows={4}
                  value={editDescription}
                  onChange={(event) => setEditDescription(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900"
                  placeholder="وصف المهمة"
                />
                <input
                  type="date"
                  value={editDueDate}
                  onChange={(event) => setEditDueDate(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900"
                />
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="ghost" onClick={() => setEditing(false)}>إلغاء</Button>
                  <Button type="button" onClick={handleSaveTask} disabled={statusUpdating}>حفظ</Button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-900/60 p-3.5 rounded-xl border border-slate-200/60 dark:border-slate-800">
                {task.description || 'لا يوجد وصف مخصص لهذه المهمة.'}
              </p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="flex items-start gap-2 text-xs">
                <Users className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <span className="text-slate-500 font-medium block mb-1">المسند إليهم:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {task.hr_task_assignees && task.hr_task_assignees.length > 0 ? (
                      task.hr_task_assignees.map((a) => (
                        <span
                          key={a.user_id}
                          className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800"
                        >
                          {a.hr_users?.full_name || 'موظف'}
                        </span>
                      ))
                    ) : (
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {task.hr_users?.full_name || 'غير محدد'}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2 text-xs">
                <Calendar className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <span className="text-slate-500 font-medium block mb-1">موعد التسليم:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {task.due_date ? new Date(task.due_date).toLocaleDateString('ar-EG') : 'غير محدد'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <hr className="border-slate-200 dark:border-slate-800" />

          {/* Attachments Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {isAdmin ? 'ملفات تسليم الموظف' : 'ملفات تسليم المهمة'} ({files.length})
                </h4>
                <p className="mt-1 text-[10px] text-slate-400">
                  {isAdmin
                    ? 'تابع الملفات التي رفعها الموظف المكلّف بالمهمة.'
                    : 'ارفع هنا الملفات والنتائج الخاصة بتنفيذ المهمة.'}
                </p>
              </div>
              {isAdmin && files.length > 0 && (
                <Badge variant="done">تم رفع {files.length} {files.length === 1 ? 'ملف' : 'ملفات'}</Badge>
              )}
            </div>

            {isAdmin && latestFile && (
              <div className="grid grid-cols-1 gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 sm:grid-cols-3 dark:border-emerald-900/60 dark:bg-emerald-950/20">
                <div>
                  <p className="text-[10px] font-bold text-slate-400">آخر رفع بواسطة</p>
                  <p className="mt-1 text-xs font-black text-slate-800 dark:text-slate-100">{latestFile.hr_users?.full_name || 'الموظف'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400">اسم الملف</p>
                  <p className="mt-1 truncate text-xs font-bold text-slate-800 dark:text-slate-100" title={latestFile.original_name}>{latestFile.original_name}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400">وقت الرفع</p>
                  <p className="mt-1 text-xs font-bold text-slate-800 dark:text-slate-100">{new Date(latestFile.created_at).toLocaleString('ar-EG')}</p>
                </div>
              </div>
            )}

            {/* Files List */}
            {files.length === 0 ? (
              <p className="text-xs text-slate-400 italic text-center py-4">لا توجد ملفات مرفقة بالمهمة حتى الآن.</p>
            ) : (
              <div className="space-y-2">
                {files.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800">
                        {getFileIcon(file.mime_type)}
                      </div>
                      <div className="min-w-0 text-right">
                        <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate max-w-[200px] sm:max-w-[280px]">
                          {file.original_name}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {(file.size_bytes / (1024 * 1024)).toFixed(2)} MB
                          {' • '}بواسطة {file.hr_users?.full_name || 'الموظف'}
                          {' • '}{new Date(file.created_at).toLocaleString('ar-EG')}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      {canPreviewFile(file.mime_type) && (
                        <button
                          onClick={() => handlePreview(file)}
                          disabled={previewLoading === file.id}
                          title="معاينة الملف"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                          {previewLoading === file.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      )}

                      <button
                        onClick={() => handleDownload(file.id)}
                        title="تنزيل الملف (رابط مؤقت)"
                        className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      >
                        <Download className="w-4 h-4" />
                      </button>

                      {(isAdmin || (file.uploaded_by === hrUser?.id && !isProjectArchived)) && (
                        <button
                          onClick={() => handleDeleteFile(file.id)}
                          title="حذف الملف"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <hr className="border-slate-200 dark:border-slate-800" />

          {/* Activity Audit Log */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-slate-400" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">سجل التغييرات والأحداث</h4>
            </div>

            <div className="space-y-3 pr-2 border-r-2 border-slate-200 dark:border-slate-800 mr-2">
              {activities.length === 0 ? (
                <p className="text-xs text-slate-400 italic pr-3">لا يوجد سجل نشاط حتى الآن.</p>
              ) : (
                activities.map((act) => (
                  <div key={act.id} className="relative pr-4 text-xs">
                    <div className="absolute -right-[9px] top-1 w-2.5 h-2.5 rounded-full bg-blue-500 ring-4 ring-white dark:ring-slate-900" />
                    <p className="font-bold text-slate-800 dark:text-slate-200">
                      قام {act.hr_users?.full_name || 'النظام'} بـ{' '}
                      <span className="text-blue-600 dark:text-blue-400 font-extrabold">{getActivityLabel(act)}</span>
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {new Date(act.created_at).toLocaleString('ar-EG')}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="py-16 text-center text-xs text-slate-500">المهمة غير متاحة أو تم حذفها.</div>
      )}

      {/* File Preview Modal */}
      {previewFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md" dir="rtl">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 max-w-4xl w-full max-h-[90vh] flex flex-col space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
              <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                {previewFile.name}
              </h4>
              <button
                onClick={() => setPreviewFile(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-auto flex items-center justify-center bg-slate-950/50 rounded-xl p-2 min-h-[300px]">
              {previewFile.mime.startsWith('image/') ? (
                <img src={previewFile.url} alt={previewFile.name} className="max-h-[70vh] object-contain rounded" />
              ) : previewFile.mime.startsWith('video/') ? (
                <video src={previewFile.url} controls className="max-h-[70vh] rounded" />
              ) : (
                <iframe src={previewFile.url} title={previewFile.name} className="w-full h-[70vh] rounded" />
              )}
            </div>
          </div>
        </div>
      )}
    </Drawer>
  );
};
