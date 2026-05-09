import { BrowserRouter as Router, Routes, Route } from "react-router";
import { ScrollToTop }    from "./components/common/ScrollToTop";
import { AuthProvider }   from "./context/AuthContext";
import ProtectedRoute     from "./components/tpfcs/ProtectedRoute";
import AppLayout          from "./layout/AppLayout";

// Auth
import SignIn             from "./pages/AuthPages/SignIn";
import ResetPassword      from "./pages/AuthPages/ResetPassword";
import ChangePassword     from "./pages/AuthPages/ChangePassword";

// Dashboard
import TpfcsDashboard     from "./pages/Dashboard/TpfcsDashboard";
import AnalysisDashboard   from "./pages/Dashboard/AnalysisDashboard";
import FinancialDashboard from "./pages/Dashboard/FinancialDashboard";
import SuppliersPage    from "./pages/Inventory/SuppliersPage";
import ProductsPage     from "./pages/Inventory/ProductsPage";
import StoresPage       from "./pages/Inventory/StoresPage";
import OrdersPage       from "./pages/Inventory/OrdersPage";
import OrderForm        from "./pages/Inventory/OrderForm";
import OrderDetail      from "./pages/Inventory/OrderDetail";
import ChecklistsPage             from "./pages/Inspection/ChecklistsPage";
import InspectionRequestsPage     from "./pages/Inspection/InspectionRequestsPage";
import InspectionRequestForm      from "./pages/Inspection/InspectionRequestForm";
import InspectionRequestDetail    from "./pages/Inspection/InspectionRequestDetail";

// Projects
import ProjectList        from "./pages/Projects/ProjectList";
import ProjectDetail      from "./pages/Projects/ProjectDetail";
import ProjectForm        from "./pages/Projects/ProjectForm";

// Activities
import ActivityList       from "./pages/Activities/ActivityList";
import ActivityDetail     from "./pages/Activities/ActivityDetail";
import ActivityForm       from "./pages/Activities/ActivityForm";

// Budget
import BudgetRevisions    from "./pages/Budget/BudgetRevisions";

// Users
import UsersPage          from "./pages/Users/UsersPage";

// Lookups
import LookupsPage        from "./pages/Lookups/LookupsPage";

// Profile
import UserProfiles       from "./pages/UserProfiles";

// Fallback
import NotFound             from "./pages/OtherPage/NotFound";
import { ToastContainer }  from "./components/tpfcs/Toast";

export default function App() {
  return (
    <AuthProvider>
      <ToastContainer />
      <Router>
        <ScrollToTop />
        <Routes>

          {/* ── Public ───────────────────────────────────────────── */}
          <Route path="/signin"         element={<SignIn />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* ── Change password (auth required, no app shell) ─────── */}
          <Route element={<ProtectedRoute />}>
            <Route path="/change-password" element={<ChangePassword />} />
          </Route>

          {/* ── All authenticated users ───────────────────────────── */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>

              {/* Dashboard */}
              <Route index path="/"                    element={<TpfcsDashboard />} />
              <Route path="/analysis"                  element={<AnalysisDashboard />} />
              <Route path="/financial"                 element={<FinancialDashboard />} />
              <Route path="/inventory/suppliers"    element={<SuppliersPage />} />
              <Route path="/inventory/products"     element={<ProductsPage />} />
              <Route path="/inventory/stores"       element={<StoresPage />} />
              <Route path="/inventory/orders"       element={<OrdersPage />} />
              <Route path="/inventory/orders/new"   element={<OrderForm />} />
              <Route path="/inventory/orders/:id"   element={<OrderDetail />} />
              <Route path="/inventory/orders/:id/edit" element={<OrderForm />} />
              <Route path="/inspection/checklists"           element={<ChecklistsPage />} />
              <Route path="/inspection/requests"             element={<InspectionRequestsPage />} />
              <Route path="/inspection/requests/new"         element={<InspectionRequestForm />} />
              <Route path="/inspection/requests/:id"         element={<InspectionRequestDetail />} />
              <Route path="/inspection/requests/:id/edit"    element={<InspectionRequestForm />} />

              {/* Projects */}
              <Route path="/projects"                  element={<ProjectList />} />
              <Route path="/projects/new"              element={<ProjectForm />} />
              <Route path="/projects/:id"              element={<ProjectDetail />} />
              <Route path="/projects/:id/edit"         element={<ProjectForm />} />

              {/* Activities */}
              <Route path="/activities"                element={<ActivityList />} />
              <Route path="/activities/new"            element={<ActivityForm />} />
              <Route path="/activities/:id"            element={<ActivityDetail />} />
              <Route path="/activities/:id/edit"       element={<ActivityForm />} />

              {/* Budget */}
              <Route path="/budget/revisions"          element={<BudgetRevisions />} />

              {/* Profile */}
              <Route path="/profile"                   element={<UserProfiles />} />

            </Route>
          </Route>

          {/* ── Admin + Manager only ──────────────────────────────── */}
          <Route element={<ProtectedRoute allowedRoles={["admin", "manager"]} />}>
            <Route element={<AppLayout />}>
              <Route path="/users"                     element={<UsersPage />} />
              <Route path="/lookups"                   element={<LookupsPage />} />
            </Route>
          </Route>

          {/* ── Fallback ──────────────────────────────────────────── */}
          <Route path="*" element={<NotFound />} />

        </Routes>
      </Router>
    </AuthProvider>
  );
}
