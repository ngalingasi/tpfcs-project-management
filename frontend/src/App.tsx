import { BrowserRouter as Router, Routes, Route } from "react-router";
import { ScrollToTop }    from "./components/common/ScrollToTop";
import { AuthProvider }   from "./context/AuthContext";
import ProtectedRoute     from "./components/tpfcs/ProtectedRoute";
import AppLayout          from "./layout/AppLayout";

// Auth
import SignIn             from "./pages/AuthPages/SignIn";
import ResetPassword      from "./pages/AuthPages/ResetPassword";
import ChangePassword     from "./pages/AuthPages/ChangePassword";

// TPFCS pages
import TpfcsDashboard     from "./pages/Dashboard/TpfcsDashboard";
import ProjectList        from "./pages/Projects/ProjectList";
import ProjectDetail      from "./pages/Projects/ProjectDetail";
import ProjectForm        from "./pages/Projects/ProjectForm";
import ActivityList       from "./pages/Activities/ActivityList";
import BudgetRevisions    from "./pages/Budget/BudgetRevisions";
import UsersPage          from "./pages/Users/UsersPage";
import LookupsPage        from "./pages/Lookups/LookupsPage";
import UserProfiles       from "./pages/UserProfiles";

// Generic
import NotFound           from "./pages/OtherPage/NotFound";

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <ScrollToTop />
        <Routes>

          {/* ── Public ───────────────────────────────────────────── */}
          <Route path="/signin"         element={<SignIn />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* ── Change password (auth, no shell) ─────────────────── */}
          <Route element={<ProtectedRoute />}>
            <Route path="/change-password" element={<ChangePassword />} />
          </Route>

          {/* ── All authenticated users ───────────────────────────── */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route index path="/"              element={<TpfcsDashboard />} />
              <Route path="/projects"            element={<ProjectList />} />
              <Route path="/projects/new"        element={<ProjectForm />} />
              <Route path="/projects/:id"        element={<ProjectDetail />} />
              <Route path="/projects/:id/edit"   element={<ProjectForm />} />
              <Route path="/activities"          element={<ActivityList />} />
              <Route path="/budget/revisions"    element={<BudgetRevisions />} />
              <Route path="/profile"             element={<UserProfiles />} />
            </Route>
          </Route>

          {/* ── Admin + Manager ───────────────────────────────────── */}
          <Route element={<ProtectedRoute allowedRoles={["admin", "manager"]} />}>
            <Route element={<AppLayout />}>
              <Route path="/users"               element={<UsersPage />} />
            </Route>
          </Route>

          {/* ── Admin only ────────────────────────────────────────── */}
          <Route element={<ProtectedRoute allowedRoles={["admin"]} />}>
            <Route element={<AppLayout />}>
              <Route path="/lookups"             element={<LookupsPage />} />
            </Route>
          </Route>

          {/* ── Fallback ──────────────────────────────────────────── */}
          <Route path="*" element={<NotFound />} />

        </Routes>
      </Router>
    </AuthProvider>
  );
}
