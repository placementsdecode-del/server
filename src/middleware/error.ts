function notFound(req, res, next) {
  const error = new Error(`Route not found: ${req.originalUrl}`);
  (error as Error & { statusCode: number }).statusCode = 404;
  next(error);
}

function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  const validation = error.name === 'ValidationError' || error.name === 'CastError';
  const statusCode = error.code === 11000 ? 409 : validation ? 400 : error.statusCode || error.status || 500;
  const message = error.code === 11000 ? 'A record with these unique details already exists' : error.message || 'Internal server error';

  res.status(statusCode).json({
    message: statusCode >= 500 && process.env.NODE_ENV === 'production' ? 'The server could not complete this request' : message,
    ...(process.env.NODE_ENV !== "production" && { stack: error.stack }),
  });
}

export { notFound, errorHandler };
