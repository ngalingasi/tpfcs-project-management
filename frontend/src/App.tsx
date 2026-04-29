import { BrowserRouter as Router, Routes, Route } from "react-router";
import { ScrollToTop } from "./components/common/ScrollToTop";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/tpfcs/ProtectedRoute";
import AppLayout from "./layout/AppLayout";

// Auth pages
import SignIn          from "./pages/AuthPages/SignIn";
import ResetPassword   from "./pages/AuthPages/ResetPassword";
import ChangePassword  from "./pages/AuthPages/ChangePassword";

// TPFCS pages
import TpfcsDashboard  from "./pages/Dashboard/TpfcsDashboard";
import ProjectList     from "./pages/Projects/ProjectList";
import ProjectDetail   from "./pages/Projects/ProjectDetail";
import ActivityList    from "./pages/Activities/ActivityList";
import BudgetRevisions from "./pages/Budget/BudgetRevisions";

// Generic pages
import NotFound        from "./pages/OtherPage/NotFound";
import UserProfiles    from "./pages/UserProfiles";

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <ScrollToTop />
        <Routes>

          {/* ── Public (no auth needed) ───────────────────────────── */}
          <Route path="/signin"         element={<SignIn />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* ── Change password — auth required, no app shell ─────── */}
          <Route element={<ProtectedRoute />}>
            <Route path="/change-password" element={<ChangePassword />} />
          </Route>

          {/* ── Protected app routes ──────────────────────────────── */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route index path="/"                  element={<TpfcsDashboard />} />
              <Route path="/projects"                element={<ProjectList />} />
              <Route path="/projects/:id"            element={<ProjectDetail />} />
              <Route path="/activities"              element={<ActivityList />} />
              <Route path="/budget/revisions"        element={<BudgetRevisions />} />
              <Route path="/profile"                 element={<UserProfiles />} />
            </Route>
          </Route>

          {/* ── Admin-only routes ─────────────────────────────────── */}
          <Route element={<ProtectedRoute allowedRoles={["admin"]} />}>
            <Route element={<AppLayout />}>
              {/* users, lookups — coming next */}
            </Route>
          </Route>

          {/* ── Fallback ──────────────────────────────────────────── */}
          <Route path="*" element={<NotFound />} />

        </Routes>
      </Router>
    </AuthProvider>
  );
}
