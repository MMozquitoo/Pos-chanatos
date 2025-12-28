import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { RoleType } from '../types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles: RoleType[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div>Cargando...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
};

