import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { AlertTriangle, AlertCircle, HelpCircle, Info } from 'lucide-react';

export type ConfirmVariant = 'danger' | 'warning' | 'info' | 'default';

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmVariant;
}

export interface AlertOptions {
  title?: string;
  message: string;
  buttonText?: string;
  variant?: 'error' | 'warning' | 'info' | 'success';
}

interface ConfirmContextType {
  confirm: (options: ConfirmOptions | string) => Promise<boolean>;
  showAlert: (options: AlertOptions | string) => Promise<void>;
}

const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined);

export const ConfirmProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Confirm state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState<ConfirmOptions>({
    title: 'تأكيد الإجراء',
    message: '',
    confirmText: 'تأكيد',
    cancelText: 'إلغاء',
    variant: 'danger',
  });
  const resolveConfirmRef = useRef<((value: boolean) => void) | null>(null);

  // Alert state
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertConfig, setAlertConfig] = useState<AlertOptions>({
    title: 'تنبيه',
    message: '',
    buttonText: 'حسناً',
    variant: 'info',
  });
  const resolveAlertRef = useRef<(() => void) | null>(null);

  const confirm = useCallback((options: ConfirmOptions | string): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      resolveConfirmRef.current = resolve;
      if (typeof options === 'string') {
        setConfirmConfig({
          title: 'تأكيد الإجراء',
          message: options,
          confirmText: 'تأكيد',
          cancelText: 'إلغاء',
          variant: options.includes('حذف') ? 'danger' : 'warning',
        });
      } else {
        setConfirmConfig({
          title: options.title || (options.variant === 'danger' ? 'تأكيد الحذف' : 'تأكيد الإجراء'),
          message: options.message,
          confirmText: options.confirmText || (options.variant === 'danger' ? 'حذف' : 'تأكيد'),
          cancelText: options.cancelText || 'إلغاء',
          variant: options.variant || (options.message.includes('حذف') ? 'danger' : 'warning'),
        });
      }
      setConfirmOpen(true);
    });
  }, []);

  const showAlert = useCallback((options: AlertOptions | string): Promise<void> => {
    return new Promise<void>((resolve) => {
      resolveAlertRef.current = resolve;
      if (typeof options === 'string') {
        const isErr = options.includes('فشل') || options.includes('خطأ') || options.includes('تعذّر');
        setAlertConfig({
          title: isErr ? 'حدث خطأ' : 'تنبيه',
          message: options,
          buttonText: 'حسناً',
          variant: isErr ? 'error' : 'info',
        });
      } else {
        setAlertConfig({
          title: options.title || (options.variant === 'error' ? 'حدث خطأ' : 'تنبيه'),
          message: options.message,
          buttonText: options.buttonText || 'حسناً',
          variant: options.variant || 'info',
        });
      }
      setAlertOpen(true);
    });
  }, []);

  const handleConfirmAction = (result: boolean) => {
    setConfirmOpen(false);
    if (resolveConfirmRef.current) {
      resolveConfirmRef.current(result);
      resolveConfirmRef.current = null;
    }
  };

  const handleAlertClose = () => {
    setAlertOpen(false);
    if (resolveAlertRef.current) {
      resolveAlertRef.current();
      resolveAlertRef.current = null;
    }
  };

  // Helper styles based on variant
  const getConfirmIcon = () => {
    switch (confirmConfig.variant) {
      case 'danger':
        return (
          <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200/60 dark:border-rose-900/40">
            <AlertTriangle className="size-5" />
          </div>
        );
      case 'warning':
        return (
          <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200/60 dark:border-amber-900/40">
            <AlertCircle className="size-5" />
          </div>
        );
      default:
        return (
          <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-200/60 dark:border-blue-900/40">
            <HelpCircle className="size-5" />
          </div>
        );
    }
  };

  const getConfirmBtnClass = () => {
    switch (confirmConfig.variant) {
      case 'danger':
        return 'bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-600/20';
      case 'warning':
        return 'bg-amber-600 hover:bg-amber-500 text-white shadow-md shadow-amber-600/20';
      default:
        return 'bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/20';
    }
  };

  const getAlertIcon = () => {
    switch (alertConfig.variant) {
      case 'error':
        return (
          <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200/60 dark:border-rose-900/40">
            <AlertTriangle className="size-5" />
          </div>
        );
      case 'warning':
        return (
          <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200/60 dark:border-amber-900/40">
            <AlertCircle className="size-5" />
          </div>
        );
      default:
        return (
          <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-200/60 dark:border-blue-900/40">
            <Info className="size-5" />
          </div>
        );
    }
  };

  return (
    <ConfirmContext.Provider value={{ confirm, showAlert }}>
      {children}

      {/* Confirmation Dialog */}
      <Dialog.Root open={confirmOpen} onOpenChange={(open) => !open && handleConfirmAction(false)}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-[70] bg-slate-950/65 backdrop-blur-sm transition-opacity data-open:animate-in data-open:fade-in data-closed:animate-out data-closed:fade-out" />
          <Dialog.Viewport className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <Dialog.Popup
              className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl outline-none data-open:animate-in data-open:fade-in data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out data-closed:zoom-out-95 dark:border-slate-800 dark:bg-slate-900 text-right font-sans"
              dir="rtl"
            >
              <div className="flex items-start gap-4">
                {getConfirmIcon()}
                <div className="min-w-0 flex-1 pt-1">
                  <Dialog.Title className="text-base font-bold text-slate-900 dark:text-slate-100">
                    {confirmConfig.title}
                  </Dialog.Title>
                  <Dialog.Description className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300 whitespace-pre-line">
                    {confirmConfig.message}
                  </Dialog.Description>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => handleConfirmAction(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  {confirmConfig.cancelText}
                </button>
                <button
                  type="button"
                  onClick={() => handleConfirmAction(true)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${getConfirmBtnClass()}`}
                >
                  {confirmConfig.confirmText}
                </button>
              </div>
            </Dialog.Popup>
          </Dialog.Viewport>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Alert / Notice Dialog */}
      <Dialog.Root open={alertOpen} onOpenChange={(open) => !open && handleAlertClose()}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-[70] bg-slate-950/65 backdrop-blur-sm transition-opacity data-open:animate-in data-open:fade-in data-closed:animate-out data-closed:fade-out" />
          <Dialog.Viewport className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <Dialog.Popup
              className="flex max-h-[90vh] w-full max-w-sm flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl outline-none data-open:animate-in data-open:fade-in data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out data-closed:zoom-out-95 dark:border-slate-800 dark:bg-slate-900 text-right font-sans"
              dir="rtl"
            >
              <div className="flex items-start gap-3.5">
                {getAlertIcon()}
                <div className="min-w-0 flex-1 pt-1">
                  <Dialog.Title className="text-base font-bold text-slate-900 dark:text-slate-100">
                    {alertConfig.title}
                  </Dialog.Title>
                  <Dialog.Description className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300 whitespace-pre-line">
                    {alertConfig.message}
                  </Dialog.Description>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={handleAlertClose}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/20 transition-all"
                >
                  {alertConfig.buttonText}
                </button>
              </div>
            </Dialog.Popup>
          </Dialog.Viewport>
        </Dialog.Portal>
      </Dialog.Root>
    </ConfirmContext.Provider>
  );
};

export const useConfirm = () => {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error('useConfirm must be used within a ConfirmProvider');
  }
  return context;
};
