import React, { Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { SchoolProvider, useSchool } from './context/SchoolContext';
import Layout from './components/Layout'; // Imports from index.tsx
import { hasPermission } from './lib/permissions';
import { Loading } from './components/common/Loading';

// Lazy load pages for performance
const Login = React.lazy(() => import('./pages/Login'));
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const Classes = React.lazy(() => import('./pages/Classes'));
const Curriculum = React.lazy(() => import('./pages/Curriculum'));
const Subjects = React.lazy(() => import('./pages/Subjects'));
const Teachers = React.lazy(() => import('./pages/Teachers'));
const Students = React.lazy(() => import('./pages/Students'));
const GradeManagement = React.lazy(() => import('./pages/GradeManagement'));
const Reports = React.lazy(() => import('./pages/Reports'));
const Analytics = React.lazy(() => import('./pages/Analytics'));
const ClassCouncil = React.lazy(() => import('./pages/ClassCouncil'));
const Settings = React.lazy(() => import('./pages/Settings'));
const Users = React.lazy(() => import('./pages/Users'));
const PasswordSetup = React.lazy(() => import('./components/PasswordSetup'));

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useSchool();
  const location = useLocation();

  if (!currentUser) return <Login />;

  if (!hasPermission(currentUser.role, location.pathname)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

const AuthenticatedApp: React.FC = () => {
  const { currentUser, isSettingPassword } = useSchool();

  if (isSettingPassword) {
    return (
      <Suspense fallback={<Loading />}>
        <PasswordSetup />
      </Suspense>
    );
  }

  if (!currentUser) return <Login />;

  return (
    <Layout>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/curriculum" element={<ProtectedRoute><Curriculum /></ProtectedRoute>} />
          <Route path="/subjects" element={<ProtectedRoute><Subjects /></ProtectedRoute>} />
          <Route path="/classes" element={<ProtectedRoute><Classes /></ProtectedRoute>} />
          <Route path="/teachers" element={<ProtectedRoute><Teachers /></ProtectedRoute>} />
          <Route path="/students" element={<ProtectedRoute><Students /></ProtectedRoute>} />
          <Route path="/grades" element={<ProtectedRoute><GradeManagement /></ProtectedRoute>} />
          <Route path="/council" element={<ProtectedRoute><ClassCouncil /></ProtectedRoute>} />
          <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
          <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          <Route path="/users" element={<ProtectedRoute><Users /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Suspense>
    </Layout>
  );
};

const App: React.FC = () => {
  return (
    <SchoolProvider>
      <AuthenticatedApp />
    </SchoolProvider>
  );
};

export default App;