import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ConfirmProvider } from './context/ConfirmContext';
import { Layout } from './components/layout/Layout';
import { Loader2 } from 'lucide-react';

const LoginPage = lazy(() => import('./pages/LoginPage').then((module) => ({ default: module.LoginPage })));
const ForbiddenPage = lazy(() => import('./pages/ForbiddenPage').then((module) => ({ default: module.ForbiddenPage })));
const ChangePasswordPage = lazy(() => import('./pages/ChangePasswordPage').then((module) => ({ default: module.ChangePasswordPage })));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard').then((module) => ({ default: module.AdminDashboard })));
const ProjectsList = lazy(() => import('./pages/admin/ProjectsList').then((module) => ({ default: module.ProjectsList })));
const ProjectDetail = lazy(() => import('./pages/admin/ProjectDetail').then((module) => ({ default: module.ProjectDetail })));
const EmployeesList = lazy(() => import('./pages/admin/EmployeesList').then((module) => ({ default: module.EmployeesList })));
const TasksList = lazy(() => import('./pages/admin/TasksList').then((module) => ({ default: module.TasksList })));
const DailyUploads = lazy(() => import('./pages/admin/DailyUploads').then((module) => ({ default: module.DailyUploads })));
const EmployeeDashboard = lazy(() => import('./pages/employee/EmployeeDashboard').then((module) => ({ default: module.EmployeeDashboard })));
const TaskDetailDrawer = lazy(() => import('./components/tasks/TaskDetailDrawer').then((module) => ({ default: module.TaskDetailDrawer })));

const LoadingScreen = () => (
  <div className="min-h-screen bg-slate-950 flex items-center justify-center font-sans" dir="rtl">
    <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
  </div>
);

const ProtectedRoute: React.FC<{ children: React.ReactNode; requiredRole?: 'admin' | 'employee' }> = ({
  children,
  requiredRole,
}) => {
  const { user, hrUser, loading, isForbidden } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center font-sans" dir="rtl">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          <span className="text-xs font-bold text-slate-400">جاري تحميل نظام الموارد البشرية...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (isForbidden || !hrUser) {
    return <Navigate to="/forbidden" replace />;
  }

  if (hrUser.must_change_password) {
    return <Navigate to="/change-password" replace />;
  }

  if (requiredRole === 'admin' && hrUser.role !== 'admin') {
    return <Navigate to="/employee" replace />;
  }

  if (requiredRole === 'employee' && hrUser.role !== 'employee') {
    return <Navigate to="/admin" replace />;
  }

  return (
    <Layout>
      {children}
      <TaskDetailDrawer />
    </Layout>
  );
};

const RootRedirect: React.FC = () => {
  const { user, hrUser, loading, isForbidden } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center font-sans" dir="rtl">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (isForbidden || !hrUser) return <Navigate to="/forbidden" replace />;
  if (hrUser.must_change_password) return <Navigate to="/change-password" replace />;
  return <Navigate to={hrUser.role === 'admin' ? '/admin' : '/employee'} replace />;
};

const PasswordRoute: React.FC = () => {
  const { user, hrUser, loading, isForbidden } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (isForbidden || !hrUser) return <Navigate to="/forbidden" replace />;
  return <ChangePasswordPage />;
};

export default function App() {
  return (
    <AuthProvider>
      <ConfirmProvider>
        <BrowserRouter>
          <Suspense fallback={<LoadingScreen />}>
          <Routes>
            {/* Public / Guest Routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/forbidden" element={<ForbiddenPage />} />
            <Route path="/change-password" element={<PasswordRoute />} />

            {/* Root Redirect */}
            <Route path="/" element={<RootRedirect />} />

            {/* Admin Routes */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/projects"
              element={
                <ProtectedRoute requiredRole="admin">
                  <ProjectsList />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/projects/:id"
              element={
                <ProtectedRoute requiredRole="admin">
                  <ProjectDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/tasks"
              element={
                <ProtectedRoute requiredRole="admin">
                  <TasksList />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/employees"
              element={
                <ProtectedRoute requiredRole="admin">
                  <EmployeesList />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/uploads"
              element={
                <ProtectedRoute requiredRole="admin">
                  <DailyUploads />
                </ProtectedRoute>
              }
            />

            {/* Employee Routes */}
            <Route
              path="/employee"
              element={
                <ProtectedRoute requiredRole="employee">
                  <EmployeeDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/employee/projects"
              element={<Navigate to="/employee" replace />}
            />
            <Route
              path="/employee/projects/:id"
              element={<Navigate to="/employee" replace />}
            />
            <Route
              path="/employee/tasks"
              element={<Navigate to="/employee" replace />}
            />

            {/* Fallback Wildcard */}
            <Route path="*" element={<RootRedirect />} />
          </Routes>
          </Suspense>
        </BrowserRouter>
      </ConfirmProvider>
    </AuthProvider>
  );
}
