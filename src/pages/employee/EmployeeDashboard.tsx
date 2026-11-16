import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import type { HRProject, HRTask } from '../../types/hr';
import { Badge } from '../../components/ui/Badge';
import { TableSkeleton } from '../../components/ui/Skeleton';
import { Button } from '../../components/ui/button';
import { CreateSelfTaskModal } from '../../components/tasks/CreateSelfTaskModal';
import { useSearchParams } from 'react-router-dom';
import { CheckSquare, Clock, CheckCircle2, Plus, UploadCloud, Users } from 'lucide-react';

export const EmployeeDashboard: React.FC = () => {
  const [, setSearchParams] = useSearchParams();
  const { hrUser } = useAuth();
  const [projects, setProjects] = useState<HRProject[]>([]);
  const [assignedTasks, setAssignedTasks] = useState<HRTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');

  const fetchEmployeeData = useCallback(async () => {
    if (!hrUser) return;
    setLoading(true);
    try {
      // 1. Fetch assigned projects via hr_project_members
      const { data: memberRows, error: memberError } = await supabase
        .from('hr_project_members')
        .select('project_id, hr_projects(*)')
        .eq('user_id', hrUser.id);
      if (memberError) throw memberError;

      const projList = (memberRows
        ?.flatMap((row) => Array.isArray(row.hr_projects)
          ? row.hr_projects
          : row.hr_projects ? [row.hr_projects] : []) as unknown as HRProject[]) || [];
      setProjects(projList);

      // 2. Fetch tasks assigned to this logged-in employee (via hr_task_assignees or legacy assignee_id)
      const { data: assigneeRows } = await supabase
        .from('hr_task_assignees')
        .select('task_id')
        .eq('user_id', hrUser.id);

      const assignedTaskIds = (assigneeRows || []).map((r) => r.task_id);

      let tasksQuery = supabase
        .from('hr_tasks')
        .select(`
          *,
          hr_projects(*),
          hr_task_assignees(user_id, hr_users:hr_users!hr_task_assignees_user_id_fkey(*))
        `)
        .order('updated_at', { ascending: false });

      if (assignedTaskIds.length > 0) {
        tasksQuery = tasksQuery.or(`assignee_id.eq.${hrUser.id},id.in.(${assignedTaskIds.join(',')})`);
      } else {
        tasksQuery = tasksQuery.eq('assignee_id', hrUser.id);
      }

      const { data: taskList, error: taskError } = await tasksQuery;
      if (taskError) throw taskError;

      setAssignedTasks((taskList as HRTask[]) || []);
    } catch (err) {
      console.error('Error fetching employee dashboard:', err);
    } finally {
      setLoading(false);
    }
  }, [hrUser]);

  useEffect(() => {
    fetchEmployeeData();
    const handleUpdate = () => fetchEmployeeData();
    window.addEventListener('hr:task-updated', handleUpdate);
    window.addEventListener('hr:task-deleted', handleUpdate);
    return () => {
      window.removeEventListener('hr:task-updated', handleUpdate);
      window.removeEventListener('hr:task-deleted', handleUpdate);
    };
  }, [fetchEmployeeData]);

  const todoTasks = assignedTasks.filter((t) => t.status === 'todo');
  const inProgressTasks = assignedTasks.filter((t) => t.status === 'in_progress');
  const doneTasks = assignedTasks.filter((t) => t.status === 'done');
  const visibleTasks = selectedProjectId === 'all'
    ? assignedTasks
    : assignedTasks.filter((task) => task.project_id === selectedProjectId);
  const selectedProject = projects.find((project) => project.id === selectedProjectId);

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
      {/* Header Banner */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight m-0">
            مرحباً بك، {hrUser?.full_name}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            ملخص مشاريعك ومهامك المسندة إليك
          </p>
        </div>
        <Button
          type="button"
          onClick={() => setIsCreateTaskOpen(true)}
          className="h-10 self-start rounded-xl bg-blue-600 px-4 text-white shadow-lg shadow-blue-600/20 hover:bg-blue-500 sm:self-auto"
        >
          <Plus />
          تسجيل عمل جديد
        </Button>
      </div>

      {/* Task Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center font-bold">
            <CheckSquare className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xl font-black text-slate-900 dark:text-slate-100">{todoTasks.length}</p>
            <p className="text-xs text-slate-500 font-bold">مهام لم تبدأ</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xl font-black text-slate-900 dark:text-slate-100">{inProgressTasks.length}</p>
            <p className="text-xs text-slate-500 font-bold">قيد التنفيذ</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xl font-black text-slate-900 dark:text-slate-100">{doneTasks.length}</p>
            <p className="text-xs text-slate-500 font-bold">مهام مكتملة</p>
          </div>
        </div>
      </div>

      {/* Main Grid: My Assigned Projects & My Tasks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Assigned Projects */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              المشاريع المسندة لي ({projects.length})
            </h3>
          </div>

          {loading ? (
            <TableSkeleton rows={3} />
          ) : projects.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-400">
              لم يتم إضافتك كعضو في أي مشروع حتى الآن.
            </div>
          ) : (
            <div className="space-y-3">
              {projects.map((p) => (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => setSelectedProjectId(p.id)}
                  className={`w-full p-3.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between text-right ${
                    selectedProjectId === p.id
                      ? 'border-blue-500 bg-blue-50/70 ring-2 ring-blue-500/10 dark:bg-blue-950/20'
                      : 'border-slate-100 dark:border-slate-800 hover:border-blue-500/50'
                  }`}
                >
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">{p.name}</h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                      {p.description || 'لا يوجد وصف'}
                    </p>
                  </div>
                  <Badge variant={p.status}>{p.status === 'active' ? 'نشط' : 'مؤرشف'}</Badge>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Assigned Tasks Feed */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              {selectedProject ? `أعمال مشروع ${selectedProject.name}` : 'كل المهام والأعمال'} ({visibleTasks.length})
            </h3>
            {selectedProjectId !== 'all' && (
              <Button type="button" variant="ghost" size="xs" onClick={() => setSelectedProjectId('all')}>
                عرض الكل
              </Button>
            )}
          </div>

          {loading ? (
            <TableSkeleton rows={3} />
          ) : visibleTasks.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-400">
              لا توجد مهام أو أعمال مسجلة هنا حاليًا.
            </div>
          ) : (
            <div className="space-y-3">
              {visibleTasks.map((t) => (
                <div
                  key={t.id}
                  onClick={() => setSearchParams({ taskId: t.id })}
                  className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-blue-500/50 cursor-pointer transition-all flex items-center justify-between gap-3 text-right"
                >
                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                      {t.title}
                    </h4>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      المشروع: {t.hr_projects?.name} • موعد التسليم:{' '}
                      {t.due_date ? new Date(t.due_date).toLocaleDateString('ar-EG') : 'غير محدد'}
                    </p>
                    {t.hr_task_assignees && t.hr_task_assignees.length > 1 && (
                      <p className="text-[10px] text-blue-600 dark:text-blue-400 mt-1 flex items-center gap-1 font-semibold">
                        <Users className="size-3" />
                        <span>
                          مع:{' '}
                          {t.hr_task_assignees
                            .filter((a) => a.user_id !== hrUser?.id)
                            .map((a) => a.hr_users?.full_name || 'موظف')
                            .join('، ')}
                        </span>
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <Badge variant={t.status}>{getArabicTaskStatus(t.status)}</Badge>
                    {t.hr_projects?.status !== 'archived' && (
                      <Button
                        type="button"
                        size="xs"
                        onClick={(event) => {
                          event.stopPropagation();
                          setSearchParams({ taskId: t.id });
                        }}
                        className="bg-blue-600 text-white hover:bg-blue-500"
                      >
                        <UploadCloud />
                        رفع ملفات التنفيذ
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <CreateSelfTaskModal
        isOpen={isCreateTaskOpen}
        projects={projects}
        defaultProjectId={selectedProjectId !== 'all' ? selectedProjectId : undefined}
        onClose={() => setIsCreateTaskOpen(false)}
        onCreated={async (taskId) => {
          await fetchEmployeeData();
          setSearchParams({ taskId });
        }}
      />
    </div>
  );
};
