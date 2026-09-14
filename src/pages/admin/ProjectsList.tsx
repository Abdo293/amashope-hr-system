import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import type { HRProject, ProjectStatus } from '../../types/hr';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { TableSkeleton } from '../../components/ui/Skeleton';
import { useNavigate } from 'react-router-dom';
import { FolderKanban, Plus, Search, Archive, ArchiveRestore, ArrowLeft } from 'lucide-react';
import { getErrorMessage } from '../../lib/utils';

export const ProjectsList: React.FC = () => {
  const navigate = useNavigate();
  const { hrUser } = useAuth();
  const [projects, setProjects] = useState<HRProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ProjectStatus>('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('hr_projects')
        .select('*')
        .order('created_at', { ascending: false })
        .range(0, 99);

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      setProjects((data as HRProject[]) || []);
    } catch (err) {
      console.error('Error fetching projects:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setFormError(null);

    try {
      const { data, error } = await supabase
        .from('hr_projects')
        .insert({
          name: name.trim(),
          description: description.trim() || null,
          status: 'active',
          created_by: hrUser?.id,
        })
        .select()
        .single();

      if (error) throw error;

      setIsModalOpen(false);
      setName('');
      setDescription('');
      await fetchProjects();
      if (data?.id) navigate(`/admin/projects/${data.id}`);
    } catch (err: unknown) {
      setFormError(getErrorMessage(err, 'فشل إنشاء المشروع.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleArchive = async (project: HRProject, e: React.MouseEvent) => {
    e.stopPropagation();
    const newStatus = project.status === 'active' ? 'archived' : 'active';
    const actionText = newStatus === 'archived' ? 'أرشفة' : 'إعادة تفعيل';

    if (!confirm(`هل أنت تأكد من رغبتك في ${actionText} مشروع "${project.name}"؟`)) return;

    try {
      const { error } = await supabase
        .from('hr_projects')
        .update({ status: newStatus })
        .eq('id', project.id);

      if (error) throw error;
      await fetchProjects();
    } catch (err: unknown) {
      alert(`فشل ${actionText} المشروع: ${getErrorMessage(err)}`);
    }
  };

  const filteredProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.description && p.description.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight m-0">
            دليل المشاريع
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            إدارة مشاريع الشركة وتكليف أعضاء الفريق ومتابعة الإنجاز
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-blue-600/25 flex items-center gap-2 transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>مشروع جديد</span>
        </button>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute right-3 top-3 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث باسم المشروع..."
            className="w-full pr-9 pl-4 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto">
          {([
            { id: 'all', label: 'الكل' },
            { id: 'active', label: 'النشطة' },
            { id: 'archived', label: 'المؤرشفة' },
          ] as const).map((st) => (
            <button
              key={st.id}
              onClick={() => setStatusFilter(st.id)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                statusFilter === st.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of Projects */}
      {loading ? (
        <TableSkeleton rows={4} />
      ) : filteredProjects.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
          <FolderKanban className="w-12 h-12 text-slate-400 mx-auto" />
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">لا توجد مشاريع مطابقة</h3>
          <p className="text-xs text-slate-400">قم بتغيير الفلتر أو إضافة مشروع جديد.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProjects.map((project) => (
            <div
              key={project.id}
              onClick={() => navigate(`/admin/projects/${project.id}`)}
              className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-blue-500/50 cursor-pointer transition-all flex flex-col justify-between space-y-4 group"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 group-hover:text-blue-600 transition-colors">
                    {project.name}
                  </h3>
                  <Badge variant={project.status}>
                    {project.status === 'active' ? 'نشط' : 'مؤرشف'}
                  </Badge>
                </div>

                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                  {project.description || 'لا يوجد وصف متاح.'}
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
                <span className="text-slate-400 text-[11px]">
                  تاريخ الإنشاء: {new Date(project.created_at).toLocaleDateString('ar-EG')}
                </span>

                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => handleToggleArchive(project, e)}
                    title={project.status === 'active' ? 'أرشفة المشروع' : 'إعادة تفعيل المشروع'}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors"
                  >
                    {project.status === 'active' ? (
                      <Archive className="w-4 h-4" />
                    ) : (
                      <ArchiveRestore className="w-4 h-4" />
                    )}
                  </button>

                  <ArrowLeft className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-blue-500 group-hover:-translate-x-0.5 transition-all" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New Project Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="إنشاء مشروع جديد"
        subtitle="تنظيم المهام وتحديد أعضاء الفريق المسؤولين"
      >
        <form onSubmit={handleCreateProject} className="space-y-4 text-right">
          {formError && (
            <div className="p-3 rounded-xl bg-rose-50 text-rose-700 text-xs border border-rose-200">
              {formError}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              اسم المشروع *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثال: تطوير المنظومة اللوجستية"
              className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              وصف المشروع
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="نبذة عن أهداف المشروع ونطاق العمل..."
              className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/20 disabled:opacity-50"
            >
              {submitting ? 'جاري الإنشاء...' : 'إنشاء المشروع'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
