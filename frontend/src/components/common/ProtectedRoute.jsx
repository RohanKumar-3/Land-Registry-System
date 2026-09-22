import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import LoadingSpinner from './LoadingSpinner';

// Redirects to home if not logged in
export const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const location          = useLocation();

  if (loading) return <LoadingSpinner text="Loading..." />;

  if (!user) {
    return <Navigate to="/" state={{ from: location, requiresAuth: true }} replace />;
  }

  return children;
};

// Redirects to dashboard if role doesn't match
export const RoleRoute = ({ children, roles = [] }) => {
  const { user, loading } = useAuth();

  if (loading) return <LoadingSpinner text="Loading..." />;

  if (!user) return <Navigate to="/" replace />;

  if (roles.length > 0 && !roles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

export default ProtectedRoute;