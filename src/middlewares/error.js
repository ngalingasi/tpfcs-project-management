const httpStatus = require('http-status');
const config = require('../config/config');
const logger = require('../config/logger');
const ApiError = require('../utils/ApiError');

const errorConverter = (err, req, res, next) => {
  let error = err;
  if (!(error instanceof ApiError)) {
    if (error.name === 'MulterError') {
      // Give a clear, actionable message instead of a generic 500 — most
      // commonly hit when a file exceeds MAX_FILE_SIZE.
      const maxMb = Math.round((config.upload.maxSize / (1024 * 1024)) * 10) / 10;
      const message = error.code === 'LIMIT_FILE_SIZE'
        ? `File is too large. Maximum allowed size is ${maxMb}MB.`
        : `Upload error: ${error.message}`;
      error = new ApiError(httpStatus.BAD_REQUEST, message, true);
    } else {
      const statusCode = error.statusCode || httpStatus.INTERNAL_SERVER_ERROR;
      const message = error.message || httpStatus[statusCode];
      error = new ApiError(statusCode, message, false, err.stack);
    }
  }
  next(error);
};

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  let { statusCode, message } = err;
  if (config.env === 'production' && !err.isOperational) {
    statusCode = httpStatus.INTERNAL_SERVER_ERROR;
    message = httpStatus[httpStatus.INTERNAL_SERVER_ERROR];
  }

  res.locals.errorMessage = err.message;

  const response = {
    code: statusCode,
    message,
    ...(config.env === 'development' && { stack: err.stack }),
  };

  if (config.env === 'development') {
    logger.error(err);
  }

  res.status(statusCode).send(response);
};

module.exports = { errorConverter, errorHandler };
