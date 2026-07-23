const express    = require('express');
const helmet     = require('helmet');
const compression = require('compression');
const cors       = require('cors');
const passport   = require('passport');
const httpStatus = require('http-status');
const path       = require('path');
const fs         = require('fs');

const config              = require('./config/config');
const morgan              = require('./config/morgan');
const { jwtStrategy }     = require('./config/passport');
const { authLimiter }     = require('./middlewares/rateLimiter');
const routes              = require('./routes/v1');
const { errorConverter, errorHandler } = require('./middlewares/error');
const ApiError            = require('./utils/ApiError');

const app = express();
app.disable('etag');

// ── Logging ───────────────────────────────────────────────────────────────────
if (config.env !== 'test') {
  app.use(morgan.successHandler);
  app.use(morgan.errorHandler);
}

// ── Security headers ──────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false, // Disabled — SPA loads its own assets
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: true,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  dnsPrefetchControl: { allow: false },
  frameguard: { action: 'DENY' },
  hidePoweredBy: true,
  hsts: { maxAge: 63072000, includeSubDomains: true, preload: true },
  ieNoOpen: true,
  noSniff: true,
  referrerPolicy: { policy: 'no-referrer' },
  xssFilter: true,
}));

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// NOTE: previously used `xss-clean` here, applied globally to every request
// body. That HTML-escapes ALL string fields indiscriminately — which
// corrupts intentional rich-text HTML (from RichTextEditor) into literal
// "&lt;b&gt;" text that gets stored as-is and never un-corrupts itself. It's
// also a deprecated/unmaintained package. Removed in favor of a targeted
// allowlist sanitizer (see utils/sanitizeRichText.js) applied only to the
// specific rich-text fields (descriptions, project_background) at the model
// layer, so real HTML-injection protection stays in place without breaking
// legitimate formatting.
app.use(compression());

// ── CORS ──────────────────────────────────────────────────────────────────────
const rawOrigins = (process.env.ALLOWED_ORIGINS || '').trim();
const corsOrigin = rawOrigins === '*'
  ? '*'
  : rawOrigins.split(',').map(o => o.trim()).filter(Boolean);

const corsOptions = {
  origin: corsOrigin.length ? corsOrigin : false,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: rawOrigins !== '*',
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// ── Auth ──────────────────────────────────────────────────────────────────────
app.use(passport.initialize());
passport.use('jwt', jwtStrategy);

// ── Static: uploaded files ────────────────────────────────────────────────────
// The global helmet frameguard (DENY) below would otherwise block the in-app
// WhatsApp-style <object>/<iframe> preview for PDFs — direct download/open in
// another app is unaffected since X-Frame-Options only applies to framed
// embedding, which is why "works everywhere else but not in-app preview" happens.
app.use('/uploads', (req, res, next) => {
  res.removeHeader('X-Frame-Options');
  next();
});
app.use('/uploads', express.static(path.join(process.cwd(), config.upload.dir)));

// ── Rate limiting on auth ─────────────────────────────────────────────────────
if (config.env === 'production') {
  app.use('/api/auth', authLimiter);
}

// ── API routes at /api/v1 ─────────────────────────────────────────────────────
app.use('/api', routes);

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok', env: config.env }));

// ── Serve React dashboard from /dist ─────────────────────────────────────────
// Place the Vite build output (npm run build) in a /dist folder
// next to this API, or symlink it.
// Look for dist/ next to the api/ folder (../dist) first,
// then fall back to dist/ inside the api/ folder
const distPath = fs.existsSync(path.join(process.cwd(), '..', 'dist'))
  ? path.join(process.cwd(), '..', 'dist')
  : path.join(process.cwd(), 'dist');
if (fs.existsSync(distPath)) {
  // Static assets (JS, CSS, images)
  app.use(express.static(distPath, {
    maxAge: config.env === 'production' ? '1y' : '0',
    etag: false,
  }));

  // SPA fallback — any route that isn't /api/* or /uploads/* → index.html
  app.get(/^(?!\/api|\/uploads).*$/, (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
} else {
  // Friendly message when dist doesn't exist yet
  app.get('/', (req, res) => {
    res.json({
      message: 'TPFCS API is running.',
      dashboard: 'Dashboard not built yet. Build it with: npm run build:dashboard',
      api: '/api/v1',
    });
  });
}

// ── 404 for unmatched API routes ──────────────────────────────────────────────
app.use((req, res, next) => {
  next(new ApiError(httpStatus.NOT_FOUND, 'Not found'));
});

// ── Error handling ────────────────────────────────────────────────────────────
app.use(errorConverter);
app.use(errorHandler);

module.exports = app;
