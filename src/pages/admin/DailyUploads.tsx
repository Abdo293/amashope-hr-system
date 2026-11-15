import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Archive,
  ChevronLeft,
  Clock3,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  FolderKanban,
  Image,
  Loader2,
  RefreshCw,
  Search,
  UserRound,
  Users,
  Video,
  Calendar,
  LayoutGrid,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { getFileDownloadUrl } from '../../lib/r2-client';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { Modal } from '../../components/ui/Modal';
import { TableSkeleton } from '../../components/ui/Skeleton';
import type { HRUser, HRProject } from '../../types/hr';

interface TaskFileRecord {
  id: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
  uploaded_by: string;
  hr_users?: {
    id: string;
    full_name: string;
    email: string;
  } | null;
  hr_tasks?: {
    id: string;
    title: string;
    project_id: string;
    hr_projects?: {
      id: string;
      name: string;
    } | null;
  } | null;
}

interface DeliveryFile {
  file_id: string;
  uploader_id: string;
  uploader_name: string;
  uploader_email: string;
  task_id: string;
  task_title: string;
  project_id: string;
  project_name: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  uploaded_at: string;
}

interface UploaderGroup {
  id: string;
  name: string;
  email: string;
  files: DeliveryFile[];
  totalBytes: number;
  lastUploadAt: string;
}

type DatePreset = 'all' | 'today' | 'yesterday' | 'week' | 'month' | 'custom';

const cairoDateFormatter = new Intl.DateTimeFormat('ar-EG', {
  dateStyle: 'medium',
  timeZone: 'Africa/Cairo',
});

const cairoTimeFormatter = new Intl.DateTimeFormat('ar-EG', {
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'Africa/Cairo',
});

function formatBytes(bytes: number) {
  if (!bytes || isNaN(bytes)) return '0 بايت';
  if (bytes < 1024) return `${bytes} بايت`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} كيلوبايت`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} ميجابايت`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} جيجابايت`;
}

function FileTypeIcon({ mimeType }: { mimeType: string }) {
  const className = 'size-5';
  if (mimeType.startsWith('image/')) return <Image className={className} />;
  if (mimeType.startsWith('video/')) return <Video className={className} />;
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType === 'text/csv') {
    return <FileSpreadsheet className={className} />;
  }
  if (mimeType === 'application/zip' || mimeType.includes('compressed')) return <Archive className={className} />;
  return <FileText className={className} />;
}

export const DailyUploads: React.FC = () => {
  const [files, setFiles] = useState<DeliveryFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedUploaderId, setSelectedUploaderId] = useState<string | null>(null);
  const [openingFileId, setOpeningFileId] = useState<string | null>(null);

  // Filters State
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('all');
  const [selectedProjectId, setSelectedProjectId] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grouped' | 'list'>('grouped');

  // Options for dropdowns
  const [employees, setEmployees] = useState<HRUser[]>([]);
  const [projects, setProjects] = useState<HRProject[]>([]);

  // Load filter options
  useEffect(() => {
    const loadOptions = async () => {
      try {
        const [empRes, projRes] = await Promise.all([
          supabase.from('hr_users').select('id, full_name, email, role, is_active').order('full_name'),
          supabase.from('hr_projects').select('id, name, status').order('name'),
        ]);
        if (empRes.data) setEmployees(empRes.data as HRUser[]);
        if (projRes.data) setProjects(projRes.data as HRProject[]);
      } catch (err) {
        console.error('Failed to load filter options:', err);
      }
    };
    void loadOptions();
  }, []);

  const fetchUploads = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      let query = supabase
        .from('hr_task_files')
        .select(`
          id,
          original_name,
          mime_type,
          size_bytes,
          created_at,
          uploaded_by,
          hr_users:uploaded_by (id, full_name, email),
          hr_tasks:task_id (
            id,
            title,
            project_id,
            hr_projects:project_id (id, name)
          )
        `)
        .order('created_at', { ascending: false });

      // Apply date preset filter
      const now = new Date();
      if (datePreset === 'today') {
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        query = query.gte('created_at', today.toISOString());
      } else if (datePreset === 'yesterday') {
        const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        query = query.gte('created_at', yesterday.toISOString()).lt('created_at', today.toISOString());
      } else if (datePreset === 'week') {
        const weekAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
        query = query.gte('created_at', weekAgo.toISOString());
      } else if (datePreset === 'month') {
        const monthAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
        query = query.gte('created_at', monthAgo.toISOString());
      } else if (datePreset === 'custom') {
        if (customStartDate) {
          const start = new Date(customStartDate);
          start.setHours(0, 0, 0, 0);
          query = query.gte('created_at', start.toISOString());
        }
        if (customEndDate) {
          const end = new Date(customEndDate);
          end.setHours(23, 59, 59, 999);
          query = query.lte('created_at', end.toISOString());
        }
      }

      if (selectedEmployeeId !== 'all') {
        query = query.eq('uploaded_by', selectedEmployeeId);
      }

      const { data, error: fetchErr } = await query;
      if (fetchErr) throw fetchErr;

      const rawRecords = (data || []) as unknown as TaskFileRecord[];
      const mappedFiles: DeliveryFile[] = rawRecords.map((r) => ({
        file_id: r.id,
        uploader_id: r.uploaded_by,
        uploader_name: r.hr_users?.full_name || 'موظف غير معروف',
        uploader_email: r.hr_users?.email || '',
        task_id: r.hr_tasks?.id || '',
        task_title: r.hr_tasks?.title || 'مهمة محذوفة',
        project_id: r.hr_tasks?.project_id || '',
        project_name: r.hr_tasks?.hr_projects?.name || 'مشروع غير محدد',
        original_name: r.original_name,
        mime_type: r.mime_type || 'application/octet-stream',
        size_bytes: Number(r.size_bytes) || 0,
        uploaded_at: r.created_at,
      }));

      // In-memory project filter if selected
      const filtered = selectedProjectId === 'all'
        ? mappedFiles
        : mappedFiles.filter((f) => f.project_id === selectedProjectId);

      setFiles(filtered);
    } catch (err: unknown) {
      console.error('Error loading deliveries:', err);
      setError('تعذّر تحميل قائمة التسليمات. يرجى إعادة المحاولة.');
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, [datePreset, customStartDate, customEndDate, selectedEmployeeId, selectedProjectId]);

  useEffect(() => {
    void fetchUploads();
  }, [fetchUploads]);

  // Filter files by search query
  const searchedFiles = useMemo(() => {
    if (!searchQuery.trim()) return files;
    const q = searchQuery.toLowerCase().trim();
    return files.filter(
      (f) =>
        f.original_name.toLowerCase().includes(q) ||
        f.uploader_name.toLowerCase().includes(q) ||
        f.task_title.toLowerCase().includes(q) ||
        f.project_name.toLowerCase().includes(q)
    );
  }, [files, searchQuery]);

  // Group by uploader
  const uploaders = useMemo<UploaderGroup[]>(() => {
    const groups = new Map<string, UploaderGroup>();

    searchedFiles.forEach((file) => {
      const current = groups.get(file.uploader_id);
      if (current) {
        current.files.push(file);
        current.totalBytes += Number(file.size_bytes);
        return;
      }

      groups.set(file.uploader_id, {
        id: file.uploader_id,
        name: file.uploader_name,
        email: file.uploader_email,
        files: [file],
        totalBytes: Number(file.size_bytes),
        lastUploadAt: file.uploaded_at,
      });
    });

    return Array.from(groups.values());
  }, [searchedFiles]);

  const selectedUploader = uploaders.find((u) => u.id === selectedUploaderId) ?? null;
  const totalBytes = searchedFiles.reduce((sum, f) => sum + Number(f.size_bytes), 0);

  const handleOpenFile = async (fileId: string) => {
    setOpeningFileId(fileId);
    setError('');
    const previewWindow = window.open('about:blank', '_blank');
    if (previewWindow) previewWindow.opener = null;

    try {
      const url = await getFileDownloadUrl(fileId);
      if (previewWindow) {
        previewWindow.location.href = url;
      } else {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    } catch (openError) {
      previewWindow?.close();
      console.error('Error opening uploaded file:', openError);
      setError('تعذّر فتح الملف. حاول مرة أخرى.');
    } finally {
      setOpeningFileId(null);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="m-0 text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100">
            التسليمات
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            استعراض كافة الملفات والتسليمات المرفوعة من الموظفين مع إمكانية التصفية التاريخية
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {/* View mode toggle */}
          <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
            <button
              onClick={() => setViewMode('grouped')}
              className={`p-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                viewMode === 'grouped'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
              title="عرض حسب الموظف"
            >
              <Users className="size-4" />
              <span className="hidden sm:inline">حسب الموظف</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
              title="عرض قائمة الملفات"
            >
              <LayoutGrid className="size-4" />
              <span className="hidden sm:inline">جميع الملفات</span>
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => void fetchUploads()}
            disabled={loading}
            className="rounded-xl font-bold h-9"
          >
            <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
            تحديث
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">
          <AlertCircle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="border-0 bg-white shadow-sm ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
          <CardContent className="flex items-center gap-4">
            <div className="flex size-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
              <Users className="size-5" />
            </div>
            <div>
              <p className="text-xl font-black text-slate-900 dark:text-slate-100">{uploaders.length}</p>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">الموظفون المسلمون</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 bg-white shadow-sm ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
          <CardContent className="flex items-center gap-4">
            <div className="flex size-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
              <FileCheck2 className="size-5" />
            </div>
            <div>
              <p className="text-xl font-black text-slate-900 dark:text-slate-100">{searchedFiles.length}</p>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">الملفات المطابقة</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 bg-white shadow-sm ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
          <CardContent className="flex items-center gap-4">
            <div className="flex size-11 items-center justify-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-950/60 dark:text-violet-400">
              <Archive className="size-5" />
            </div>
            <div>
              <p className="text-xl font-black text-slate-900 dark:text-slate-100">{formatBytes(totalBytes)}</p>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">إجمالي حجم الملفات</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        {/* Date presets row */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-bold text-slate-400 flex items-center gap-1 ml-1">
              <Calendar className="size-3.5" /> الفترة:
            </span>
            {(
              [
                { id: 'all', label: 'كل الأوقات' },
                { id: 'today', label: 'اليوم' },
                { id: 'yesterday', label: 'أمس' },
                { id: 'week', label: 'آخر 7 أيام' },
                { id: 'month', label: 'آخر 30 يوماً' },
                { id: 'custom', label: 'تاريخ مخصص' },
              ] as const
            ).map((p) => (
              <button
                key={p.id}
                onClick={() => setDatePreset(p.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  datePreset === p.id
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Custom Date Pickers */}
          {datePreset === 'custom' && (
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-slate-400">من:</span>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="px-2.5 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-slate-400">إلى:</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="px-2.5 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* Dropdowns & Search */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 absolute right-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث بالملف أو المهمة أو الموظف..."
              className="w-full pr-9 pl-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Employee dropdown */}
          <div>
            <select
              value={selectedEmployeeId}
              onChange={(e) => setSelectedEmployeeId(e.target.value)}
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

          {/* Project dropdown */}
          <div>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">جميع المشاريع</option>
              {projects.map((proj) => (
                <option key={proj.id} value={proj.id}>
                  {proj.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <TableSkeleton rows={4} />
      ) : searchedFiles.length === 0 ? (
        <Card className="border-0 bg-white py-14 text-center shadow-sm ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
          <CardContent className="flex flex-col items-center">
            <div className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
              <FileCheck2 className="size-8" />
            </div>
            <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
              لا توجد تسليمات مطابقة للفلاتر المحددة
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              جرّب تغيير الفترة الزمنية أو إزالة فلاتر الموظف والمشروع والبحث.
            </p>
          </CardContent>
        </Card>
      ) : viewMode === 'grouped' ? (
        /* Grouped by Employee View */
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {uploaders.map((uploader) => (
            <Button
              key={uploader.id}
              variant="outline"
              onClick={() => setSelectedUploaderId(uploader.id)}
              className="h-auto w-full justify-between whitespace-normal rounded-2xl border-slate-200 bg-white p-5 text-right shadow-sm hover:border-blue-300 hover:bg-blue-50/40 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-800 dark:hover:bg-blue-950/20"
            >
              <span className="flex min-w-0 items-center gap-3">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-lg font-black text-white shadow-md shadow-blue-600/20">
                  {uploader.name.trim().charAt(0) || <UserRound className="size-5" />}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-black text-slate-900 dark:text-slate-100">
                    {uploader.name}
                  </span>
                  <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                    <span>
                      {uploader.files.length} {uploader.files.length === 1 ? 'تسليم' : 'تسليمات'}
                    </span>
                    <span>{formatBytes(uploader.totalBytes)}</span>
                    <span className="flex items-center gap-1">
                      <Clock3 className="size-3" />
                      آخر رفع: {cairoDateFormatter.format(new Date(uploader.lastUploadAt))} - {cairoTimeFormatter.format(new Date(uploader.lastUploadAt))}
                    </span>
                  </span>
                </span>
              </span>
              <ChevronLeft className="size-5 shrink-0 text-slate-400" />
            </Button>
          ))}
        </div>
      ) : (
        /* All Files Flat List View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {searchedFiles.map((file) => (
            <div
              key={file.file_id}
              className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between space-y-3"
            >
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
                  <FileTypeIcon mimeType={file.mime_type} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-black text-slate-900 dark:text-slate-100" title={file.original_name}>
                    {file.original_name}
                  </p>
                  <p className="text-[11px] font-bold text-blue-600 dark:text-blue-400 mt-0.5 truncate">
                    {file.uploader_name}
                  </p>
                </div>
              </div>

              <div className="space-y-1 text-[11px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-xl">
                <p className="flex items-center gap-1.5 truncate">
                  <FileCheck2 className="size-3.5 shrink-0 text-slate-400" />
                  <span className="truncate">المهمة: {file.task_title}</span>
                </p>
                <p className="flex items-center gap-1.5 truncate">
                  <FolderKanban className="size-3.5 shrink-0 text-slate-400" />
                  <span className="truncate">المشروع: {file.project_name}</span>
                </p>
              </div>

              <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                <span className="text-[10px] text-slate-400">
                  {formatBytes(file.size_bytes)} · {cairoDateFormatter.format(new Date(file.uploaded_at))}
                </span>
                <Button
                  size="sm"
                  onClick={() => void handleOpenFile(file.file_id)}
                  disabled={openingFileId === file.file_id}
                  className="rounded-xl font-bold h-7 px-2.5 text-xs"
                >
                  {openingFileId === file.file_id ? <Loader2 className="animate-spin size-3" /> : <FileText className="size-3" />}
                  فتح
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Selected Uploader's Files */}
      <Modal
        isOpen={Boolean(selectedUploader)}
        onClose={() => setSelectedUploaderId(null)}
        title={selectedUploader?.name ?? 'ملفات الموظف'}
        subtitle={
          selectedUploader
            ? `${selectedUploader.files.length} ${
                selectedUploader.files.length === 1 ? 'تسليم' : 'تسليمات'
              } بإجمالي حجم ${formatBytes(selectedUploader.totalBytes)}`
            : undefined
        }
        maxWidth="xl"
      >
        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
          {selectedUploader?.files.map((file) => (
            <div
              key={file.file_id}
              className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3"
            >
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
                  <FileTypeIcon mimeType={file.mime_type} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-black text-slate-900 dark:text-slate-100" title={file.original_name}>
                    {file.original_name}
                  </p>
                  <div className="mt-2 space-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                    <p className="flex items-center gap-1.5">
                      <FileCheck2 className="size-3.5 shrink-0" />
                      <span className="truncate">المهمة: {file.task_title}</span>
                    </p>
                    <p className="flex items-center gap-1.5">
                      <FolderKanban className="size-3.5 shrink-0" />
                      <span className="truncate">المشروع: {file.project_name}</span>
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3 dark:border-slate-800">
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  {formatBytes(Number(file.size_bytes))} · {cairoDateFormatter.format(new Date(file.uploaded_at))} {cairoTimeFormatter.format(new Date(file.uploaded_at))}
                </span>
                <Button
                  size="sm"
                  onClick={() => void handleOpenFile(file.file_id)}
                  disabled={openingFileId === file.file_id}
                  className="rounded-xl font-bold"
                >
                  {openingFileId === file.file_id ? <Loader2 className="animate-spin size-3.5" /> : <FileText className="size-3.5" />}
                  فتح الملف
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
};
