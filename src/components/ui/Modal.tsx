import React from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl';
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = 'md',
}) => {
  const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
  }[maxWidth];

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-sm transition-opacity data-open:animate-in data-open:fade-in data-closed:animate-out data-closed:fade-out" />
        <Dialog.Viewport className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <Dialog.Popup
            className={`flex max-h-[90vh] w-full ${maxWidthClasses} flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl outline-none data-open:animate-in data-open:fade-in data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out data-closed:zoom-out-95 dark:border-slate-800 dark:bg-slate-900`}
          >
            <header className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
              <div>
                <Dialog.Title className="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</Dialog.Title>
                {subtitle && <Dialog.Description className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{subtitle}</Dialog.Description>}
              </div>
              <Dialog.Close className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200" aria-label="إغلاق">
                <X className="size-5" />
              </Dialog.Close>
            </header>
            <div className="flex-1 overflow-y-auto p-6">{children}</div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
