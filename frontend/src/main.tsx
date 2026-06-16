import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "swiper/swiper-bundle.css";
import "simplebar-react/dist/simplebar.min.css";
import "flatpickr/dist/flatpickr.css";
import App from "./App.tsx";
import { AppWrapper } from "./components/common/PageMeta.tsx";
import { ThemeProvider } from "./context/ThemeContext.tsx";

// ── ERP token handler ─────────────────────────────────────────────────────────
const handleErpRedirect = (): void => {
  const params       = new URLSearchParams(window.location.search);
  const token        = params.get('token');
  const refreshToken = params.get('refreshToken');
  if (!token) return;

  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (payload.exp * 1000 < Date.now()) return;

    localStorage.setItem('access_token',  token);
    localStorage.setItem('refresh_token', refreshToken ?? '');

    const existing = localStorage.getItem('tpfcs_user');
    const parsed   = existing ? JSON.parse(existing) : null;
    if (!parsed || parsed.user_id !== Number(payload.sub)) {
      localStorage.setItem('tpfcs_user', JSON.stringify({
        user_id:              Number(payload.sub) || 0,
        full_name:            payload.full_name ?? payload.email ?? 'User',
        username:             payload.username  ?? payload.email ?? 'user',
        email:                payload.email     ?? '',
        role:                 payload.role      ?? 'user',
        status:               'active',
        must_change_password: 0,
      }));
    }

    params.delete('token');
    params.delete('refreshToken');
    const clean = window.location.pathname +
      (params.toString() ? `?${params.toString()}` : '') +
      window.location.hash;
    window.history.replaceState({}, '', clean);
  } catch { /* invalid token — ignore */ }
};

handleErpRedirect();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <AppWrapper>
        <App />
      </AppWrapper>
    </ThemeProvider>
  </StrictMode>
);
