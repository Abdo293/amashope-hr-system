import { supabase } from './supabase';
import type { HRTaskFile } from '../types/hr';
import { optimizeTaskImage } from './optimizeImage';

export interface UploadProgressCallback {
  (progress: number): void;
}

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024 * 1024; // 5 GB (Cloudflare R2 single PUT limit)

/**
 * Resolves the canonical MIME type expected by hr-r2-storage.
 * Normalizes OS-dependent MIME types (e.g. Windows reporting .zip as application/x-zip-compressed,
 * or browsers reporting empty MIME type for .zip/.csv/.docx files).
 */
export function resolveCanonicalMimeType(file: File): string {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';

  const EXTENSION_TO_CANONICAL_MIME: Record<string, string> = {
    zip: 'application/zip',
    pdf: 'application/pdf',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    gif: 'image/gif',
    csv: 'text/csv',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    mp4: 'video/mp4',
    webm: 'video/webm',
    mov: 'video/quicktime',
  };

  if (ext && EXTENSION_TO_CANONICAL_MIME[ext]) {
    return EXTENSION_TO_CANONICAL_MIME[ext];
  }

  return file.type || 'application/octet-stream';
}

/**
 * Uploads a file to Cloudflare R2 using server-side Presigned URL and records metadata in Supabase.
 * Automatically compresses and converts images (JPEG, PNG, WebP) to optimized WebP.
 * Supports direct uploads of any size up to 5 GB.
 */
export async function uploadFileToR2(
  taskId: string,
  file: File,
  onProgress?: UploadProgressCallback
): Promise<HRTaskFile> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    throw new Error('انتهت جلسة تسجيل الدخول. سجّل الدخول مرة أخرى.');
  }

  // Optimize and convert images to WebP if applicable
  const fileToUpload = await optimizeTaskImage(file);
  const mimeType = resolveCanonicalMimeType(fileToUpload);

  if (fileToUpload.size > MAX_FILE_SIZE_BYTES) {
    throw new Error('حجم الملف يتجاوز الحد الأقصى المسموح به (5 جيجابايت).');
  }

  // 1. Get Presigned Upload URL from Edge Function
  const { data: presignedData, error: presignedErr } = await supabase.functions.invoke('hr-r2-storage', {
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
    body: {
      action: 'get_upload_url',
      task_id: taskId,
      original_name: fileToUpload.name,
      mime_type: mimeType,
      size_bytes: fileToUpload.size,
    },
  });

  if (presignedErr || !presignedData?.upload_url) {
    const errorMsg =
      presignedData?.details ||
      (presignedData?.error === 'UNAUTHORIZED'
        ? 'انتهت جلسة تسجيل الدخول أو غير مصرح لك. سجّل الدخول مرة أخرى.'
        : presignedData?.error === 'FORBIDDEN_EMPLOYEE_UPLOADS_ONLY'
        ? 'رفع ملفات التنفيذ متاح للموظف المسند إليه المهمة فقط.'
        : presignedData?.error === 'FORBIDDEN_TASK_NOT_ASSIGNED'
          ? 'لا يمكنك رفع ملفات لهذه المهمة لأنها غير مسندة إليك.'
          : presignedData?.error === 'FORBIDDEN_NOT_PROJECT_MEMBER'
            ? 'غير مسموح برفع ملفات لأنك لست عضوًا في هذا المشروع.'
            : presignedData?.error === 'PROJECT_ARCHIVED_OR_INVALID'
              ? 'لا يمكن رفع ملفات لأن المشروع غير نشط.'
              : presignedData?.error === 'FILE_SIZE_EXCEEDED'
                ? 'حجم الملف أكبر من الحد المسموح.'
                : presignedData?.error === 'MIME_TYPE_NOT_ALLOWED' ||
                  presignedData?.error === 'FILE_EXTENSION_FORBIDDEN' ||
                  presignedData?.error === 'FILE_EXTENSION_MIME_MISMATCH'
                  ? 'نوع الملف غير مسموح به.'
                  : 'تعذّر تجهيز رفع الملف. حاول مرة أخرى.');
    throw new Error(errorMsg);
  }

  const { upload_url, file_id } = presignedData;
  if (!file_id) throw new Error('تعذّر تجهيز الملف للرفع. حاول مرة أخرى.');

  try {
    // 2. Upload directly to Cloudflare R2 via XMLHttpRequest to track progress
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', upload_url, true);
      xhr.setRequestHeader('Content-Type', mimeType);
      xhr.timeout = 10 * 60 * 1000;

      if (xhr.upload && onProgress) {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const percent = Math.round((e.loaded / e.total) * 100);
            onProgress(percent);
          }
        };
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error('رفضت خدمة الملفات عملية الرفع. تحقق من إعدادات الرفع ثم حاول مرة أخرى.'));
        }
      };

      xhr.onerror = () => reject(new Error('تعذّر الاتصال بخدمة رفع الملفات. تأكد من إعداد النطاق المسموح للرفع ثم حاول مرة أخرى.'));
      xhr.ontimeout = () => reject(new Error('استغرق رفع الملف وقتًا طويلًا. تحقق من الاتصال وحاول مرة أخرى.'));
      xhr.onabort = () => reject(new Error('تم إلغاء رفع الملف.'));

      xhr.send(fileToUpload);
    });

    // 3. Let the server verify R2 and atomically publish the metadata.
    const { data: completed, error: completeErr } = await supabase.functions.invoke('hr-r2-storage', {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
      body: { action: 'complete_upload', file_id },
    });

    if (completeErr || !completed?.success || !completed?.file) {
      throw new Error('تم رفع الملف لكن تعذّر اعتماده. حاول رفعه مرة أخرى.');
    }

    return completed.file as HRTaskFile;
  } catch (uploadError) {
    // The reservation gives cleanup a real file_id, so failed uploads cannot leave
    // an untracked object behind.
    try {
      await supabase.functions.invoke('hr-r2-storage', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: { action: 'delete_file', file_id },
      });
    } catch (cleanupErr) {
      console.warn('Orphan file cleanup failed:', cleanupErr);
    }
    throw uploadError;
  }
}

/**
 * Retrieves a short-lived Presigned Download URL for a task file.
 */
export async function getFileDownloadUrl(fileId: string): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  const headers = session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined;

  const { data, error } = await supabase.functions.invoke('hr-r2-storage', {
    headers,
    body: {
      action: 'get_download_url',
      file_id: fileId,
    },
  });

  if (error || !data?.download_url) {
    throw new Error('تعذّر تجهيز رابط الملف. حاول مرة أخرى.');
  }

  return data.download_url;
}

/**
 * Deletes a file from Cloudflare R2 and removes its database record.
 */
export async function deleteTaskFile(fileId: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  const headers = session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined;

  const { data, error } = await supabase.functions.invoke('hr-r2-storage', {
    headers,
    body: {
      action: 'delete_file',
      file_id: fileId,
    },
  });

  if (error || !data?.success) {
    throw new Error('تعذّر حذف الملف. حاول مرة أخرى.');
  }
}
