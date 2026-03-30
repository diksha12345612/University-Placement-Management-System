/**
 * Global error handling middleware for the University Placement System.
 * Standardizes error responses and prevents sensitive information disclosure in production.
 */
const errorHandler = (err, req, res, next) => {
  // Generate a unique ID for request tracing if not already present
  const errorId = req.id || `ERR_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 5)}`.toUpperCase();
  
  // Log full error server-side for debugging
  console.error(`[${errorId}] Error: ${err.stack || err.message}`);
  
  // Default status code
  const statusCode = err.statusCode || err.status || 500;
  
  // Build consistent error response
  const errorResponse = {
    success: false,
    message: 'An error occurred processing your request',
    status: statusCode,
    errorId: errorId
  };

  // Safe error message mapping based on error type or status
  if (err.name === 'ValidationError') {
    errorResponse.message = 'Validation failed. Please check required fields.';
  } else if (err.name === 'CastError') {
    errorResponse.message = 'Invalid request parameters (ID format error)';
  } else if (err.name === 'MongooseError' || err.name === 'MongoError' || err.name === 'MongoServerError') {
    errorResponse.message = 'Database operation failed';
    if (err.code === 11000) {
      errorResponse.message = 'Duplicate entry detected';
      errorResponse.status = 400;
    }
  } else if (statusCode === 401) {
    errorResponse.message = 'Authentication required. Please log in.';
  } else if (statusCode === 403) {
    errorResponse.message = 'Access denied. You do not have sufficient permissions.';
  } else if (statusCode === 404) {
    errorResponse.message = 'The requested resource was not found';
  } else if (statusCode === 429) {
    errorResponse.message = err.message || 'Too many requests. Please try again later.';
  } else if (statusCode >= 400 && statusCode < 500) {
    // For other client errors, use the original message if safe
    errorResponse.message = err.message || 'Invalid request';
  }

  // In development mode, include the full stack trace for easier debugging
  if (process.env.NODE_ENV === 'development') {
    errorResponse.details = err.stack;
  }

  // Final response
  res.status(errorResponse.status || statusCode).json(errorResponse);
};

/**
 * Handler for 404 Not Found errors.
 */
const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.originalUrl}`,
    status: 404
  });
};

module.exports = {
  errorHandler,
  notFoundHandler
};
