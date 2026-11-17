// src/components/ProtectedRoute.tsx
import { Navigate } from '../shims/react-router-dom';
import { useAuth } from '../hooks/useAuth';

interface Props {
  children: React.ReactNode;
  roles?: string[];
  redirectTo?: string;
}

export default function ProtectedRoute({ children, roles, redirectTo = '/login' }: Props) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="page-center">
        <div className="spinner" style={{ width: 40, height: 40 }} />
      </div>
    );
  }

  if (!user) return <Navigate to={redirectTo} replace />;

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/status" replace />;
  }

  return <>{children}</>;
}
