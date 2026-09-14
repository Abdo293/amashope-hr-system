import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, FolderKanban, Users, CheckSquare, FileCheck2, X } from 'lucide-react';

interface SidebarProps {
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isMobileOpen = false,
  onCloseMobile,
}) => {
  const { hrUser } = useAuth();
  const isAdmin = hrUser?.role === 'admin';

  const navItems = isAdmin
    ? [
        { path: '/admin', label: 'لوحة التحكم', icon: LayoutDashboard, end: true },
        { path: '/admin/projects', label: 'إدارة المشاريع', icon: FolderKanban },
        { path: '/admin/employees', label: 'إدارة الموظفين', icon: Users },
        { path: '/admin/uploads', label: 'تسليمات اليوم', icon: FileCheck2 },
      ]
    : [
        { path: '/employee', label: 'لوحة التحكم', icon: LayoutDashboard, end: true },
        { path: '/employee/projects', label: 'المشاريع المسندة لي', icon: FolderKanban },
        { path: '/employee/tasks', label: 'المهام المسندة لي', icon: CheckSquare },
      ];

  const content = (
    <div className="flex flex-col h-full py-4 px-3">
      <div className="px-3 mb-5 flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          قائمة التنقل
        </span>
        {onCloseMobile && (
          <button
            onClick={onCloseMobile}
            className="md:hidden p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <nav className="space-y-1.5 flex-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end}
              onClick={() => {
                if (onCloseMobile) onCloseMobile();
              }}
              className={({ isActive }) =>
                `w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-bold text-xs transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-100'
                }`
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Footer Info Badge */}
      <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800/60 text-xs text-right">
        <p className="font-bold text-slate-800 dark:text-slate-200">نظام محمي ومتكامل</p>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
          نوع الحساب: <span className="font-bold text-blue-600 dark:text-blue-400">{isAdmin ? 'أدمن النظام' : 'موظف'}</span>
        </p>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 flex-col glass-panel border-l border-slate-200 dark:border-slate-800 shrink-0 min-h-[calc(100vh-61px)]">
        {content}
      </aside>

      {/* Mobile Slide-over */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="fixed inset-y-0 right-0 w-72 bg-white dark:bg-slate-900 shadow-2xl border-l border-slate-200 dark:border-slate-800">
            {content}
          </div>
        </div>
      )}
    </>
  );
};
