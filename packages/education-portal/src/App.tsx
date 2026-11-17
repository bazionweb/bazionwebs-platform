import { Routes, Route, Navigate } from './shims/react-router-dom';

import { AuthProvider } from './hooks/useAuth';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import VerifyEmail from './pages/VerifyEmail';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import MfaSetup from './pages/MfaSetup';
import Apply from './pages/Apply';
import Status from './pages/Status';
import Recommend from './pages/Recommend';
import Settings from './pages/Settings';

import Dashboard from './pages/student/Dashboard';
import Academics from './pages/student/Academics';
import Finances from './pages/student/Finances';
import Support from './pages/student/Support';
import StudentSettings from './pages/student/Settings';
import Documents from './pages/student/Documents';
import Orientation from './pages/student/Orientation';
import Graduation from './pages/student/Graduation';
import ClaimAccount from './pages/claim/ClaimAccount';
import RegistrationWizard from './pages/registration/RegistrationWizard';
import DocumentRequest from './pages/documents/DocumentRequest';
import AlumniDashboard from './pages/alumni/AlumniDashboard';

import { SessionWarning } from './components/SessionWarning';
import { ErrorBoundary } from './components/ErrorBoundary';

import { useAuth } from './hooks/useAuth';
import { StudentLayout } from './components/StudentLayout';

function StudentRouteWrapper({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  return <StudentLayout user={user} onLogout={logout}>{children}</StudentLayout>;
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <SessionWarning />
        <Navbar />
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/verify" element={<VerifyEmail />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route
            path="/mfa/setup"
            element={
              <ProtectedRoute>
                <MfaSetup />
              </ProtectedRoute>
            }
          />
          <Route path="/recommend/:token" element={<Recommend />} />
          <Route
            path="/apply"
            element={
              <ProtectedRoute roles={['applicant', 'student', 'staff', 'admin']}>
                <Apply />
              </ProtectedRoute>
            }
          />
          <Route
            path="/status"
            element={
              <ProtectedRoute>
                <Status />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            }
          />
          {/* /admin redirects admin/staff to the UMS system (separate app) */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute roles={['admin', 'staff']}>
                <Navigate to="/status" replace />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/dashboard"
            element={
              <ProtectedRoute roles={['student']}>
                <StudentRouteWrapper><Dashboard /></StudentRouteWrapper>
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/documents"
            element={
              <ProtectedRoute roles={['student']}>
                <StudentRouteWrapper><Documents /></StudentRouteWrapper>
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/orientation"
            element={
              <ProtectedRoute roles={['student']}>
                <StudentRouteWrapper><Orientation /></StudentRouteWrapper>
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/academics"
            element={
              <ProtectedRoute roles={['student']}>
                <StudentRouteWrapper><Academics /></StudentRouteWrapper>
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/finances"
            element={
              <ProtectedRoute roles={['student']}>
                <StudentRouteWrapper><Finances /></StudentRouteWrapper>
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/support"
            element={
              <ProtectedRoute roles={['student']}>
                <StudentRouteWrapper><Support /></StudentRouteWrapper>
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/settings"
            element={
              <ProtectedRoute roles={['student']}>
                <StudentRouteWrapper><StudentSettings /></StudentRouteWrapper>
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/graduation"
            element={
              <ProtectedRoute roles={['student']}>
                <StudentRouteWrapper><Graduation /></StudentRouteWrapper>
              </ProtectedRoute>
            }
          />
          <Route
            path="/claim"
            element={<ClaimAccount />}
          />
          <Route
            path="/registration"
            element={
              <ProtectedRoute roles={['student']}>
                <RegistrationWizard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/documents"
            element={
              <ProtectedRoute roles={['student', 'alumni']}>
                <DocumentRequest />
              </ProtectedRoute>
            }
          />
          <Route
            path="/alumni"
            element={
              <ProtectedRoute roles={['alumni']}>
                <AlumniDashboard />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </ErrorBoundary>
  );
}
