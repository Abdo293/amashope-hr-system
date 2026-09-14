import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Loader2, Plus } from 'lucide-react';
import type { HRProject } from '../../types/hr';
import { supabase } from '../../lib/supabase';
import { getErrorMessage } from '../../lib/utils';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

interface CreateSelfTaskModalProps {
  isOpen: boolean;
  projects: HRProject[];
  defaultProjectId?: string;
  onClose: () => void;
  onCreated: (taskId: string) => void | Promise<void>;
}

export const CreateSelfTaskModal: React.FC<CreateSelfTaskModalProps> = ({
  isOpen,
  projects,
  defaultProjectId,
  onClose,
  onCreated,
}) => {
  const activeProjects = useMemo(
    () => projects.filter((project) => project.status === 'active'),
    [projects],
  );
  const [projectId, setProjectId] = useState(defaultProjectId || '');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const preferredProject = activeProjects.some((project) => project.id === defaultProjectId)
      ? defaultProjectId || ''
      : activeProjects[0]?.id || '';
    setProjectId(preferredProject);
    setError(null);
  }, [isOpen, defaultProjectId, activeProjects]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!projectId) {
      setError('اختر المشروع الذي يخص هذا العمل.');
      return;
    }
    if (!title.trim()) {
      setError('اكتب عنوانًا واضحًا للعمل الذي نفذته.');
      return;
    }

    setSubmitting(true);
    try {
      const { data, error: createError } = await supabase.rpc('hr_create_self_task', {
        p_project_id: projectId,
        p_title: title.trim(),
        p_description: description.trim() || null,
      });

      if (createError || !data?.success || !data?.task_id) {
        throw createError || new Error('تعذّر تسجيل العمل الجديد.');
      }

      const taskId = String(data.task_id);
      setTitle('');
      setDescription('');
      onClose();
      await onCreated(taskId);
    } catch (createError: unknown) {
      setError(getErrorMessage(createError, 'تعذّر تسجيل العمل الجديد. حاول مرة أخرى.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !submitting && onClose()}
      title="تسجيل عمل جديد"
      subtitle="سجّل ما عملت عليه ثم أرفق ملفات التنفيذ"
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-right">
        {error && (
          <div role="alert" className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
            <AlertCircle className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div>
          <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">المشروع *</label>
          <Select
            value={projectId}
            onValueChange={(value) => value && setProjectId(value)}
            disabled={activeProjects.length <= 1}
            items={activeProjects.map((project) => ({ value: project.id, label: project.name }))}
          >
            <SelectTrigger className="h-10 w-full rounded-xl border-slate-200 bg-slate-50 text-xs dark:border-slate-700 dark:bg-slate-800">
              <SelectValue placeholder="اختر المشروع" />
            </SelectTrigger>
            <SelectContent align="start">
              {activeProjects.map((project) => (
                <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">عنوان العمل *</label>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={180}
            required
            autoFocus
            placeholder="مثال: تجهيز تقرير المبيعات الأسبوعي"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">وصف ما تم تنفيذه</label>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={5000}
            rows={5}
            placeholder="اكتب ملخصًا بسيطًا للعمل والنتيجة التي وصلت إليها..."
            className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs leading-6 text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>

        {activeProjects.length === 0 && (
          <p className="text-xs font-bold text-amber-600">لا يوجد مشروع نشط يمكنك تسجيل عمل بداخله حاليًا.</p>
        )}

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" disabled={submitting} onClick={onClose}>إلغاء</Button>
          <Button
            type="submit"
            disabled={submitting || activeProjects.length === 0}
            className="bg-blue-600 text-white hover:bg-blue-500"
          >
            {submitting ? <Loader2 className="animate-spin" /> : <Plus />}
            إنشاء والانتقال لرفع الملفات
          </Button>
        </div>
      </form>
    </Modal>
  );
};
