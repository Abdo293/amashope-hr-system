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
  UserRound,
  Users,
  Video,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { getFileDownloadUrl } from '../../lib/r2-client';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { Modal } from '../../components/ui/Modal';
import { TableSkeleton } from '../../components/ui/Skeleton';

interface DailyUpload {
  file_id: string;
  uploader_id: string;
  uploader_name: string;
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
  files: DailyUpload[];
  totalBytes: number;
  lastUploadAt: string;
}

const cairoDateFormatter = new Intl.DateTimeFormat('ar-EG', {
  dateStyle: 'full',
  timeZone: 'Africa/Cairo',
});

const cairoTimeFormatter = new Intl.DateTimeFormat('ar-EG', {
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'Africa/Cairo',
});

function formatBytes(bytes: number) {
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
  if (mimeType === 'application/zip') return <Archive className={className} />;
  return <FileText className={className} />;
}

export const DailyUploads: React.FC = () => {
  const [uploads, setUploads] = useState<DailyUpload[]>([]);
  const [selectedUploaderId, setSelectedUploaderId] = useState<string | null>(null);
  const [openingFileId, setOpeningFileId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchUploads = useCallback(async () => {
    setLoading(true);
    setError('');

    const { data, error: uploadsError } = await supabase.rpc('hr_admin_today_uploads');

    if (uploadsError) {
      console.error('Error loading today uploads:', uploadsError);
      setError('تعذّر تحميل تسليمات اليوم. حاول مرة أخرى.');
      setUploads([]);
    } else {
      setUploads((data ?? []) as DailyUpload[]);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchUploads();
  }, [fetchUploads]);

  const uploaders = useMemo<UploaderGroup[]>(() => {
    const groups = new Map<string, UploaderGroup>();

    uploads.forEach((file) => {
      const current = groups.get(file.uploader_id);
      if (current) {
        current.files.push(file);
        current.totalBytes += Number(file.size_bytes);
        return;
      }

      groups.set(file.uploader_id, {
        id: file.uploader_id,
        name: file.uploader_name,
        files: [file],
        totalBytes: Number(file.size_bytes),
        lastUploadAt: file.uploaded_at,
      });
    });

    return Array.from(groups.values());
  }, [uploads]);

  const selectedUploader = uploaders.find((uploader) => uploader.id === selectedUploaderId) ?? null;
  const totalBytes = uploads.reduce((sum, file) => sum + Number(file.size_bytes), 0);

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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="m-0 text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100">
            تسليمات اليوم
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            الموظفون الذين رفعوا ملفات يوم {cairoDateFormatter.format(new Date())}
          </p>
        </div>

        <Button
          variant="outline"
          size="lg"
          onClick={() => void fetchUploads()}
          disabled={loading}
          className="self-start rounded-xl font-bold sm:self-auto"
        >
          <RefreshCw className={loading ? 'animate-spin' : ''} />
          تحديث القائمة
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">
          <AlertCircle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="border-0 bg-white shadow-sm ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
          <CardContent className="flex items-center gap-4">
            <div className="flex size-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
              <Users className="size-5" />
            </div>
            <div>
              <p className="text-xl font-black text-slate-900 dark:text-slate-100">{uploaders.length}</p>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">موظفون رفعوا اليوم</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 bg-white shadow-sm ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
          <CardContent className="flex items-center gap-4">
            <div className="flex size-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
              <FileCheck2 className="size-5" />
            </div>
            <div>
              <p className="text-xl font-black text-slate-900 dark:text-slate-100">{uploads.length}</p>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">ملفات مرفوعة</p>
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

      {loading ? (
        <TableSkeleton rows={4} />
      ) : uploaders.length === 0 && !error ? (
        <Card className="border-0 bg-white py-14 text-center shadow-sm ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
          <CardContent className="flex flex-col items-center">
            <div className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
              <FileCheck2 className="size-8" />
            </div>
            <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
              لم يرفع أي موظف ملفات اليوم
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              ستظهر تسليمات الموظفين هنا فور رفعها.
            </p>
          </CardContent>
        </Card>
      ) : (
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
                    <span>{uploader.files.length} {uploader.files.length === 1 ? 'ملف' : 'ملفات'}</span>
                    <span>{formatBytes(uploader.totalBytes)}</span>
                    <span className="flex items-center gap-1">
                      <Clock3 className="size-3" />
                      آخر رفع {cairoTimeFormatter.format(new Date(uploader.lastUploadAt))}
                    </span>
                  </span>
                </span>
              </span>
              <ChevronLeft className="size-5 shrink-0 text-slate-400" />
            </Button>
          ))}
        </div>
      )}

      <Modal
        isOpen={Boolean(selectedUploader)}
        onClose={() => setSelectedUploaderId(null)}
        title={selectedUploader?.name ?? 'ملفات الموظف'}
        subtitle={selectedUploader ? `${selectedUploader.files.length} ${selectedUploader.files.length === 1 ? 'ملف مرفوع اليوم' : 'ملفات مرفوعة اليوم'}` : undefined}
        maxWidth="xl"
      >
        <div className="space-y-3">
          {selectedUploader?.files.map((file) => (
            <div
              key={file.file_id}
              className="rounded-xl border border-slate-200 p-4 dark:border-slate-800"
            >
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
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
                  {formatBytes(Number(file.size_bytes))} · {cairoTimeFormatter.format(new Date(file.uploaded_at))}
                </span>
                <Button
                  size="sm"
                  onClick={() => void handleOpenFile(file.file_id)}
                  disabled={openingFileId === file.file_id}
                  className="rounded-lg font-bold"
                >
                  {openingFileId === file.file_id ? <Loader2 className="animate-spin" /> : <FileText />}
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
