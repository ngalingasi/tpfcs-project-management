import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from '../../store/authStore';

// In production, unauthenticated users are sent to the ERP portal.
// In development, they see the local /signin page as normal.
const IS_PROD    = import.meta.env.VITE_IS_PRODUCTION === 'true';
const ERP_PORTAL = 'https://erp.tpfcs.co.tz';

interface Props {
  allowedRoles?: string[];
}

export default function ProtectedRoute({ allowedRoles }: Props) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  // Show spinner while rehydrating auth from localStorage
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    if (IS_PROD) {
      // Production — no local login page, send to ERP portal
      window.location.href = ERP_PORTAL;
      return null;
    }
    // Development — show local login page, preserve intended destination
    return <Navigate to="/signin" state={{ from: location }} replace />;
  }

  // Role check
  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
