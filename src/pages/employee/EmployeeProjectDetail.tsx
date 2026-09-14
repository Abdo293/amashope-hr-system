import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import type { HRProject, HRTask } from '../../types/hr';
import { Badge } from '../../components/ui/Badge';
import { TableSkeleton } from '../../components/ui/Skeleton';
import { Button } from '../../components/ui/button';
import { CreateSelfTaskModal } from '../../components/tasks/CreateSelfTaskModal';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, CheckSquare, Plus, UploadCloud } from 'lucide-react';

export const EmployeeProjectDetail: React.FC = () => {
  const { id: projectId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [, setSearchParams] = useSearchParams();

  const { hrUser } = useAuth();
  const [project, setProject] = useState<HRProject | null>(null);
  const [myTasks, setMyTasks] = useState<HRTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);

  const fetchEmployeeProjectData = useCallback(async () => {
    if (!hrUser || !projectId) return;
    setLoading(true);
    try {
      // 1. Fetch project
      const { data: projData, error: projErr } = await supabase
        .from('hr_projects')
        .select('*')
        .eq('id', projectId)
        .single();

      if (projErr) throw projErr;
      setProject(projData as HRProject);

      // 2. Fetch tasks assigned strictly to this employee inside this project
      const { data: taskData, error: taskError } = await supabase
        .from('hr_tasks')
        .select('*')
        .eq('project_id', projectId)
        .eq('assignee_id', hrUser.id)
        .order('created_at', { ascending: false });
      if (taskError) throw taskError;

      setMyTasks((taskData as HRTask[]) || []);
    } catch (err) {
      console.error('Error fetching employee project detail:', err);
    } finally {
      setLoading(false);
    }
  }, [hrUser, projectId]);

  useEffect(() => {
    fetchEmployeeProjectData();
  }, [fetchEmployeeProjectData]);

  const getArabicTaskStatus = (status: string) => {
    switch (status) {
      case 'todo': return 'لم تبدأ';
      case 'in_progress': return 'قيد التنفيذ';
      case 'done': return 'مكتملة';
      default: return status;
    }
  };
  const createTaskProjects = useMemo(() => project ? [project] : [], [project]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Back Button */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/employee/projects')}
          className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
        >
          <ArrowRight className="w-4 h-4" />
          <span>العودة للمشاريع المسندة</span>
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
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
          <h2 className="text-xl font-black text-slate-900 dark:text-slate-100">{project.name}</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {project.description || 'لا يوجد وصف مخصص لهذا المشروع.'}
          </p>
        </div>
      ) : null}

      {/* Assigned Tasks List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <CheckSquare className="w-4 h-4 text-blue-500" />
            <span>مهامي في هذا المشروع ({myTasks.length})</span>
          </h3>
          {project?.status === 'active' && (
            <Button
              type="button"
              size="sm"
              onClick={() => setIsCreateTaskOpen(true)}
              className="bg-blue-600 text-white hover:bg-blue-500"
            >
              <Plus />
              تسجيل عمل جديد
            </Button>
          )}
        </div>

        {myTasks.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs text-slate-400">
            لا توجد مهام مسندة إليك في هذا المشروع.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {myTasks.map((task) => (
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
                    التسليم:{' '}
                    {task.due_date ? new Date(task.due_date).toLocaleDateString('ar-EG') : 'غير محدد'}
                  </span>
                  {project?.status === 'active' ? (
                    <Button
                      type="button"
                      size="xs"
                      onClick={(event) => {
                        event.stopPropagation();
                        setSearchParams({ taskId: task.id });
                      }}
                      className="bg-blue-600 text-white hover:bg-blue-500"
                    >
                      <UploadCloud />
                      رفع ملفات التنفيذ
                    </Button>
                  ) : (
                    <span className="font-bold">عرض الملفات السابقة</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <CreateSelfTaskModal
        isOpen={isCreateTaskOpen}
        projects={createTaskProjects}
        defaultProjectId={project?.id}
        onClose={() => setIsCreateTaskOpen(false)}
        onCreated={async (taskId) => {
          await fetchEmployeeProjectData();
          setSearchParams({ taskId });
        }}
      />
    </div>
  );
};
