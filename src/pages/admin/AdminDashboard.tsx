import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Badge } from '../../components/ui/Badge';
import { TableSkeleton } from '../../components/ui/Skeleton';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  FolderKanban,
  Users,
  CheckCircle2,
  Clock,
  Plus,
  ArrowLeft,
} from 'lucide-react';
import type { HRProject, HRTask } from '../../types/hr';

export const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [, setSearchParams] = useSearchParams();

  const [stats, setStats] = useState({
    activeProjects: 0,
    totalEmployees: 0,
    todoTasks: 0,
    inProgressTasks: 0,
    doneTasks: 0,
  });
  const [recentProjects, setRecentProjects] = useState<HRProject[]>([]);
  const [recentTasks, setRecentTasks] = useState<HRTask[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: dashboardStats, error: statsError } = await supabase.rpc('hr_admin_dashboard_stats');
      if (statsError) throw statsError;
      setStats(dashboardStats as typeof stats);

      // Recent Projects
      const [{ data: recProj, error: projectError }, { data: recTasks, error: taskError }] = await Promise.all([
        supabase
          .from('hr_projects')
          .select('*')
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(4),
        supabase
          .from('hr_tasks')
          .select('*, hr_users:hr_users!hr_tasks_assignee_id_fkey(*), hr_projects(*)')
          .order('updated_at', { ascending: false })
          .limit(5),
      ]);
      if (projectError) throw projectError;
      if (taskError) throw taskError;

      setRecentProjects(recProj || []);
      setRecentTasks(recTasks || []);
    } catch (err) {
      console.error('Error loading admin dashboard stats:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const getArabicStatus = (status: string) => {
    switch (status) {
      case 'todo': return 'لم تبدأ';
      case 'in_progress': return 'قيد التنفيذ';
      case 'done': return 'مكتملة';
      case 'active': return 'نشط';
      case 'archived': return 'مؤرشف';
      default: return status;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight m-0">
            لوحة التحكم والإحصائيات
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            ملخص عام للمشاريع والمهام والموظفين الفعالين
          </p>
        </div>

        <button
          onClick={() => navigate('/admin/projects')}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs shadow-md shadow-blue-600/20 flex items-center gap-2 transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>إدارة المشاريع</span>
        </button>
      </div>

      {/* Metrics Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
            <FolderKanban className="w-6 h-6" />
          </div>
          <div>
            <p className="text-2xl font-black text-slate-900 dark:text-slate-100 leading-tight">
              {stats.activeProjects}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">مشاريع نشطة</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-2xl font-black text-slate-900 dark:text-slate-100 leading-tight">
              {stats.totalEmployees}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">موظفون فعالون</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-2xl font-black text-slate-900 dark:text-slate-100 leading-tight">
              {stats.inProgressTasks}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">قيد التنفيذ</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-2xl font-black text-slate-900 dark:text-slate-100 leading-tight">
              {stats.doneTasks}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">مهام مكتملة</p>
          </div>
        </div>
      </div>

      {/* Main Grid: Active Projects & Task Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Projects */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              أحدث المشاريع النشطة
            </h3>
            <button
              onClick={() => navigate('/admin/projects')}
              className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
            >
              <span>عرض الكل</span>
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
          </div>

          {loading ? (
            <TableSkeleton rows={3} />
          ) : recentProjects.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-400">
              لا توجد مشاريع نشطة حالياً.
            </div>
          ) : (
            <div className="space-y-3">
              {recentProjects.map((p) => (
                <div
                  key={p.id}
                  onClick={() => navigate(`/admin/projects/${p.id}`)}
                  className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-blue-500/50 hover:bg-blue-50/30 dark:hover:bg-blue-950/20 cursor-pointer transition-all flex items-center justify-between"
                >
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">{p.name}</h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                      {p.description || 'لا يوجد وصف'}
                    </p>
                  </div>
                  <Badge variant="active">نشط</Badge>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Task Activity Feed */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              أحدث تحديثات المهام
            </h3>
            <span className="text-[11px] text-slate-400">سجل الأحداث</span>
          </div>

          {loading ? (
            <TableSkeleton rows={3} />
          ) : recentTasks.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-400">
              لا توجد تحديثات مهام مسجلة.
            </div>
          ) : (
            <div className="space-y-3">
              {recentTasks.map((t) => (
                <div
                  key={t.id}
                  onClick={() => setSearchParams({ taskId: t.id })}
                  className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-blue-500/50 cursor-pointer transition-all flex items-center justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                      {t.title}
                    </h4>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      المشروع: {t.hr_projects?.name} • المسند إليه: {t.hr_users?.full_name}
                    </p>
                  </div>
                  <Badge variant={t.status}>{getArabicStatus(t.status)}</Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
