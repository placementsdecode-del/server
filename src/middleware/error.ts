function notFound(req, res, next) {
  const error = new Error(`Route not found: ${req.originalUrl}`);
  (error as Error & { statusCode: number }).statusCode = 404;
  next(error);
}

function errorHandler(error, req, res, next) {
  const statusCode = error.statusCode || 500;

  res.status(statusCode).json({
    message: error.message || "Internal server error",
    ...(process.env.NODE_ENV !== "production" && { stack: error.stack }),
  });
}

export { notFound, errorHandler };
