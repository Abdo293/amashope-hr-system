import React from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { X } from 'lucide-react';

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  width?: 'md' | 'lg' | 'xl';
}

export const Drawer: React.FC<DrawerProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  width = 'lg',
}) => {
  const widthClasses = {
    md: 'max-w-md',
    lg: 'max-w-xl',
    xl: 'max-w-2xl',
  }[width];

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-slate-950/55 backdrop-blur-sm transition-opacity data-open:animate-in data-open:fade-in data-closed:animate-out data-closed:fade-out" />
        <Dialog.Viewport dir="ltr" className="fixed inset-0 z-50 flex justify-end p-2 sm:p-4">
          <Dialog.Popup
            dir="rtl"
            className={`flex h-full w-full ${widthClasses} flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl outline-none data-open:animate-in data-open:slide-in-from-right data-open:fade-in data-closed:animate-out data-closed:slide-out-to-right data-closed:fade-out dark:border-slate-800 dark:bg-slate-900`}
          >
            <header className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-6 py-4 dark:border-slate-800 dark:bg-slate-900/50">
              <div>
                <Dialog.Title className="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</Dialog.Title>
                {subtitle && <Dialog.Description className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{subtitle}</Dialog.Description>}
              </div>
              <Dialog.Close className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-200/50 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200" aria-label="إغلاق">
                <X className="size-5" />
              </Dialog.Close>
            </header>
            <div className="flex-1 space-y-6 overflow-y-auto p-6">{children}</div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
