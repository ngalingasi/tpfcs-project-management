import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from '../../store/authStore';

// In production, unauthenticated users are sent to the ERP portal.
// In development, they see the local /signin page as normal.
const IS_PROD    = import.meta.env.VITE_IS_PRODUCTION === 'true';
const ERP_PORTAL = 'https://erp.tpfcs.co.tz';

// Guests may only browse project/activity pages. Pages that edit things (or show budgets) are not reachable.
const GUEST_OK = /^\/(projects|activities|profile|change-password)(\/|$)/;
const GUEST_BLOCKED = /^\/(projects\/new|projects\/\d+\/(edit|overview)|activities\/new|activities\/\d+\/edit)(\/|$)/;

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
    // ERP SSO redirect disabled for now — always show the local /signin page,
    // even in production. Re-enable by uncommenting the block below once the
    // ERP round-trip is ready to go live.
    // if (IS_PROD) {
    //   // Production — no local login page, send to ERP portal
    //   window.location.href = ERP_PORTAL;
    //   return null;
    // }
    return <Navigate to="/signin" state={{ from: location }} replace />;
  }

  // Guests are kept inside the read-only project views
  if (user?.role === 'guest') {
    const path = location.pathname;
    if (!GUEST_OK.test(path) || GUEST_BLOCKED.test(path)) return <Navigate to="/projects" replace />;
  }

  // Role check
  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
