const express = require('express');
const helmet = require('helmet');
const xss = require('xss-clean');
const compression = require('compression');
const cors = require('cors');
const passport = require('passport');
const httpStatus = require('http-status');
const path = require('path');

const config = require('./config/config');
const morgan = require('./config/morgan');
const { jwtStrategy } = require('./config/passport');
const { authLimiter } = require('./middlewares/rateLimiter');
const routes = require('./routes/v1');
const { errorConverter, errorHandler } = require('./middlewares/error');
const ApiError = require('./utils/ApiError');

const app = express();

// HTTP request logging
if (config.env !== 'test') {
  app.use(morgan.successHandler);
  app.use(morgan.errorHandler);
}

// Security headers
app.use(helmet());

// Parse JSON and URL-encoded bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// XSS sanitisation
app.use(xss());

// Gzip compression
app.use(compression());

// CORS
app.use(cors());
app.options('*', cors());

// JWT via Passport
app.use(passport.initialize());
passport.use('jwt', jwtStrategy);

// Serve uploaded files as static (optional, restrict in prod)
app.use('/uploads', express.static(path.join(process.cwd(), config.upload.dir)));

// Rate limiting on auth endpoints in production
if (config.env === 'production') {
  app.use('/v1/auth', authLimiter);
}

// API v1 routes
app.use('/v1', routes);

// Health-check
app.get('/health', (req, res) => res.send({ status: 'ok' }));

// 404 for everything else
app.use((req, res, next) => {
  next(new ApiError(httpStatus.NOT_FOUND, 'Not found'));
});

// Error handling
app.use(errorConverter);
app.use(errorHandler);

module.exports = app;
