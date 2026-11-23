import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api';

const client = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

// ── Request interceptor — attach access token ─────────────────────────────────
client.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem('access_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Response interceptor — handle 401 / token refresh ────────────────────────
let isRefreshing = false;
let failedQueue: Array<{ resolve: (v: string) => void; reject: (e: unknown) => void }> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token!)));
  failedQueue = [];
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

client.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean; _retries?: number }) | undefined;
    if (!original) return Promise.reject(error);

    // Temporary server/proxy hiccup (503/502/504 or no response while PM2 reloads): retry safe GETs a couple of times.
    const status = error.response?.status;
    const transient = status === 502 || status === 503 || status === 504 || (!error.response && error.code !== 'ERR_CANCELED');
    if (transient && (original.method ?? 'get').toLowerCase() === 'get' && (original._retries ?? 0) < 2) {
      original._retries = (original._retries ?? 0) + 1;
      await sleep(700 * original._retries);
      return client(original);
    }

    if (status === 401 && !original._retry) {
      original._retry = true;
      const sentToken = (original.headers?.Authorization as string | undefined)?.replace('Bearer ', '');
      const currentToken = localStorage.getItem('access_token');

      // Another request or browser tab already refreshed the token: just retry with the new one.
      if (currentToken && sentToken && currentToken !== sentToken) {
        original.headers.Authorization = `Bearer ${currentToken}`;
        return client(original);
      }

      if (isRefreshing) {
        return new Promise<string>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          original.headers.Authorization = `Bearer ${token}`;
          return client(original);
        });
      }

      isRefreshing = true;
      const refreshToken = localStorage.getItem('refresh_token');
      if (!refreshToken) {
        isRefreshing = false;
        window.location.href = '/signin';
        return Promise.reject(error);
      }

      try {
        const { data } = await axios.post(`${BASE_URL}/auth/refresh-tokens`, { refreshToken });
        localStorage.setItem('access_token', data.access.token);
        localStorage.setItem('refresh_token', data.refresh.token);
        processQueue(null, data.access.token);
        original.headers.Authorization = `Bearer ${data.access.token}`;
        return client(original);
      } catch (refreshError) {
        processQueue(refreshError, null);
        const rs = (refreshError as AxiosError).response?.status;
        // Sign out only when the server says the refresh token is invalid. A 5xx / network error is
        // temporary, so keep the session and let the user retry.
        if (rs === 401 || rs === 400 || rs === 403) {
          // Another tab may have rotated the tokens meanwhile.
          const latest = localStorage.getItem('refresh_token');
          if (latest && latest !== refreshToken) {
            isRefreshing = false;
            original.headers.Authorization = `Bearer ${localStorage.getItem('access_token')}`;
            return client(original);
          }
          localStorage.clear();
          window.location.href = '/signin';
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default client;
