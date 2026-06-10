import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "swiper/swiper-bundle.css";
import "simplebar-react/dist/simplebar.min.css";
import "flatpickr/dist/flatpickr.css";
import App from "./App.tsx";
import { AppWrapper } from "./components/common/PageMeta.tsx";
import { ThemeProvider } from "./context/ThemeContext.tsx";

// ── ERP Portal redirect handler ───────────────────────────────────────────────
// In production the ERP portal redirects here with:
//   ?token=<accessToken>&refreshToken=<refreshToken>
//
// Tokens are stored in localStorage BEFORE React mounts so AuthContext
// finds them on first render — user lands on dashboard, not login page.

const IS_PROD = import.meta.env.VITE_IS_PRODUCTION === 'true';

const handleErpRedirect = (): void => {
  const params       = new URLSearchParams(window.location.search);
  const token        = params.get('token');
  const refreshToken = params.get('refreshToken');

  if (!token) return;

  // Validate it's a real unexpired JWT
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (payload.exp * 1000 < Date.now()) return;
  } catch {
    return;
  }

  // Store tokens — keys must match what AuthContext reads
  localStorage.setItem('access_token',  token);
  localStorage.setItem('refresh_token', refreshToken ?? '');

  // Store a complete minimal tpfcs_user so AuthContext doesn't block on /auth/me
  // before allowing the render. AuthContext will enrich this in the background.
  try {
    const p = JSON.parse(atob(token.split('.')[1]));
    // Only write if nothing stored or if stored user is stale/different
    const existing = localStorage.getItem('tpfcs_user');
    const existingParsed = existing ? JSON.parse(existing) : null;
    if (!existingParsed || existingParsed.user_id !== Number(p.sub)) {
      localStorage.setItem('tpfcs_user', JSON.stringify({
        user_id:              Number(p.sub) || 0,
        full_name:            p.email ?? 'User',
        username:             p.email ?? 'user',
        email:                p.email ?? '',
        role:                 p.role  ?? 'user',
        status:               'active',
        must_change_password: 0,
      }));
    }
  } catch { /* silent */ }

  // Clean URL — remove token params without reload
  params.delete('token');
  params.delete('refreshToken');
  const clean = window.location.pathname +
    (params.toString() ? `?${params.toString()}` : '') +
    window.location.hash;
  window.history.replaceState({}, '', clean);
};

// In production: handle ERP redirect params if present
if (IS_PROD) {
  handleErpRedirect();
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <AppWrapper>
        <App />
      </AppWrapper>
    </ThemeProvider>
  </StrictMode>
);
