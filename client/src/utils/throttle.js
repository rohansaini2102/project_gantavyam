// Throttling and debouncing utilities for API calls
export class ApiThrottler {
  constructor(options = {}) {
    this.requests = new Map(); // Track pending requests
    this.lastRequestTime = new Map(); // Track last request time per key
    this.defaultOptions = {
      minInterval: 5000, // Minimum 5 seconds between requests
      debounceDelay: 1000, // 1 second debounce delay
      maxRetries: 3, // Maximum retry attempts
      backoffMultiplier: 2, // Exponential backoff multiplier
      ...options
    };
  }

  // Throttle API calls with minimum interval
  throttle(key, fn, options = {}) {
    const config = { ...this.defaultOptions, ...options };
    const now = Date.now();
    const lastRequest = this.lastRequestTime.get(key) || 0;
    const timeSinceLastRequest = now - lastRequest;

    if (timeSinceLastRequest < config.minInterval) {
      const remainingTime = config.minInterval - timeSinceLastRequest;
      console.log(`[ApiThrottler] Throttling ${key} for ${remainingTime}ms`);
      return Promise.resolve({ 
        throttled: true, 
        remainingTime,
        message: `Request throttled. Try again in ${Math.ceil(remainingTime / 1000)} seconds.`
      });
    }

    this.lastRequestTime.set(key, now);
    return fn();
  }

  // Debounce API calls to prevent rapid successive calls
  debounce(key, fn, options = {}) {
    const config = { ...this.defaultOptions, ...options };
    
    // Clear existing timeout
    if (this.requests.has(key)) {
      clearTimeout(this.requests.get(key));
    }

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(async () => {
        this.requests.delete(key);
        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      }, config.debounceDelay);

      this.requests.set(key, timeoutId);
    });
  }

  // Combine throttling and debouncing
  throttleAndDebounce(key, fn, options = {}) {
    return this.throttle(key, () => this.debounce(`${key}_debounced`, fn, options), options);
  }

  // Exponential backoff for failed requests
  async withBackoff(key, fn, options = {}) {
    const config = { ...this.defaultOptions, ...options };
    let retries = 0;
    let delay = 1000; // Start with 1 second

    while (retries < config.maxRetries) {
      try {
        const result = await fn();
        return result;
      } catch (error) {
        retries++;
        if (retries >= config.maxRetries) {
          console.error(`[ApiThrottler] Max retries reached for ${key}:`, error);
          throw error;
        }

        console.log(`[ApiThrottler] Retry ${retries}/${config.maxRetries} for ${key} in ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= config.backoffMultiplier;
      }
    }
  }

  // Rate limiting with sliding window
  isRateLimited(key, maxRequests = 10, windowMs = 60000) {
    const now = Date.now();
    const windowKey = `${key}_window`;
    
    if (!this.requests.has(windowKey)) {
      this.requests.set(windowKey, []);
    }

    const requests = this.requests.get(windowKey);
    
    // Remove old requests outside the window
    const validRequests = requests.filter(timestamp => now - timestamp < windowMs);
    
    if (validRequests.length >= maxRequests) {
      console.log(`[ApiThrottler] Rate limit exceeded for ${key}: ${validRequests.length}/${maxRequests} requests in ${windowMs}ms`);
      return true;
    }

    // Add current request
    validRequests.push(now);
    this.requests.set(windowKey, validRequests);
    return false;
  }

  // Clear all throttling data for a key
  clearThrottling(key) {
    this.lastRequestTime.delete(key);
    this.requests.delete(key);
    this.requests.delete(`${key}_debounced`);
    this.requests.delete(`${key}_window`);
  }

  // Clear all throttling data
  clearAll() {
    this.lastRequestTime.clear();
    this.requests.clear();
  }

  // Get throttling status for a key
  getThrottlingStatus(key) {
    const now = Date.now();
    const lastRequest = this.lastRequestTime.get(key) || 0;
    const timeSinceLastRequest = now - lastRequest;
    const isThrottled = timeSinceLastRequest < this.defaultOptions.minInterval;
    
    return {
      key,
      isThrottled,
      lastRequestTime: lastRequest,
      timeSinceLastRequest,
      remainingTime: isThrottled ? this.defaultOptions.minInterval - timeSinceLastRequest : 0
    };
  }
}

// Create singleton instance for driver state sync
export const driverStateThrottler = new ApiThrottler({
  minInterval: 15000, // 15 seconds between state sync requests
  debounceDelay: 2000, // 2 second debounce delay
  maxRetries: 2, // Only retry twice
  backoffMultiplier: 1.5 // Gentler backoff
});

// Simple throttle function for quick use
export const throttle = (fn, delay) => {
  let timeoutId;
  let lastExecTime = 0;
  
  return function (...args) {
    const currentTime = Date.now();
    
    if (currentTime - lastExecTime > delay) {
      lastExecTime = currentTime;
      return fn.apply(this, args);
    } else {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        lastExecTime = Date.now();
        fn.apply(this, args);
      }, delay - (currentTime - lastExecTime));
    }
  };
};

// Simple debounce function for quick use
export const debounce = (fn, delay) => {
  let timeoutId;
  
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), delay);
  };
};

// Export default throttler
export default driverStateThrottler;