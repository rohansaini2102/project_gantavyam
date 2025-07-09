// middleware/requestLogger.js
const { createContextLogger } = require('../config/logger');

const logger = createContextLogger('RequestLogger');

const requestLogger = (req, res, next) => {
  const startTime = Date.now();
  
  // Log incoming request
  logger.info('Incoming request', {
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    ip: req.ip || req.connection.remoteAddress,
    timestamp: new Date().toISOString()
  });

  // Override res.json to log response
  const originalJson = res.json;
  res.json = function(data) {
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    logger.info('Response sent', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      success: res.statusCode >= 200 && res.statusCode < 400
    });
    
    return originalJson.call(this, data);
  };

  next();
};

module.exports = requestLogger;