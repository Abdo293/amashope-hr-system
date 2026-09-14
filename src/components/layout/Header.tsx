import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Badge } from '../ui/Badge';
import { KeyRound, LogOut, User as UserIcon, Menu } from 'lucide-react';
import { Link } from 'react-router-dom';

interface HeaderProps {
  onOpenMobileMenu?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenMobileMenu }) => {
  const { hrUser, logout } = useAuth();
  const isAdmin = hrUser?.role === 'admin';

  return (
    <header className="sticky top-0 z-40 w-full glass-panel border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        {onOpenMobileMenu && (
          <button
            onClick={onOpenMobileMenu}
            className="md:hidden p-2 rounded-lg text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
        <Link to={isAdmin ? '/admin' : '/employee'} className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-black text-sm shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
            HR
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight leading-tight m-0">
              نظام الموارد البشرية
            </h1>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              منظومة إدارة المشاريع والمهام
            </span>
          </div>
        </Link>
      </div>

      {hrUser && (
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
            <div className="w-7 h-7 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xs">
              <UserIcon className="w-4 h-4" />
            </div>
            <div className="text-right">
              <p className="text-xs font-bold text-slate-900 dark:text-slate-100 leading-tight">
                {hrUser.full_name}
              </p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight truncate max-w-[140px]">
                {hrUser.email}
              </p>
            </div>
            <Badge variant={hrUser.role === 'admin' ? 'admin' : 'employee'} size="sm">
              {hrUser.role === 'admin' ? 'أدمن' : 'موظف'}
            </Badge>
          </div>

          <Link
            to="/change-password"
            title="تغيير كلمة المرور"
            className="p-2 rounded-xl text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 border border-transparent hover:border-blue-200 dark:hover:border-blue-900/50 transition-all"
          >
            <KeyRound className="w-4 h-4" />
          </Link>

          <button
            onClick={logout}
            title="تسجيل الخروج"
            className="p-2 rounded-xl text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-transparent hover:border-rose-200 dark:hover:border-rose-900/50 transition-all flex items-center gap-1.5 text-xs font-semibold"
          >
            <LogOut className="w-4 h-4 rotate-180" />
            <span className="hidden md:inline">تسجيل الخروج</span>
          </button>
        </div>
      )}
    </header>
  );
};
