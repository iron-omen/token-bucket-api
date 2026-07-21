const fs = require('fs');
const path = require('path');
const Redis = require('ioredis');

// Initialize ioredis client
// IMPORTANT: Paste your copied Upstash URL inside the quotes below!
const upstashUrl = process.env.REDIS_URL || 'redis://default:gQAAAAAAAuTOAAIgcDJlMTM1YjM1MjcyZTQ0MjFhOTg0OTg0NDM4Y2E0MzYzZQ@renewed-sawfish-189646.upstash.io:6379';

const redis = new Redis(upstashUrl, {
  maxRetriesPerRequest: 1, // Fail fast to handle fail-open cleanly
  connectTimeout: 2000,
  retryStrategy: (times) => {
    // Stop retrying after 3 attempts to allow system to operate in fail-open mode without high latency
    if (times > 3) {
      return null;
    }
    return Math.min(times * 100, 1000);
  }
});

let isRedisReady = false;

redis.on('connect', () => {
  console.log('Successfully connected to Redis.');
  isRedisReady = true;
});

redis.on('ready', () => {
  isRedisReady = true;
});

redis.on('error', (error) => {
  console.warn('Redis connection issue:', error.message);
  isRedisReady = false;
});

redis.on('close', () => {
  console.warn('Redis connection closed.');
  isRedisReady = false;
});

// Load and define Lua rate limit script
const luaScriptPath = path.join(__dirname, 'ratelimit.lua');
const luaScript = fs.readFileSync(luaScriptPath, 'utf8');

redis.defineCommand('performRateLimit', {
  numberOfKeys: 1,
  lua: luaScript
});

/**
 * Creates a rate limiter middleware instance.
 * @param {Object} options Configuration options
 * @param {number} options.capacity Max tokens the bucket can hold
 * @param {number} options.refillRate Refill rate in tokens per second
 * @param {string} [options.keyPrefix] Prefix for Redis keys
 */
const createLimiter = (options = {}) => {
  const capacity = options.capacity || 5;
  const refillRate = options.refillRate || 1;
  const keyPrefix = options.keyPrefix || 'rate_limit';

  return async (req, res, next) => {
    // Identify clients by x-api-key header or fallback to IP address
    const apiKey = req.headers['x-api-key'];
    const clientIp = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    
    const identifier = apiKey ? `key:${apiKey}` : `ip:${clientIp}`;
    const redisKey = `${keyPrefix}:${identifier}`;

    // Fail Open: If Redis is down, log a warning and proceed without blocking the user
    if (!isRedisReady) {
      console.warn(`[RateLimiter] Redis is down. Fail-open mode active. Allowing request for ${identifier}`);
      res.setHeader('X-RateLimit-Limit', capacity);
      res.setHeader('X-RateLimit-Remaining', capacity); // Fail open assumes full capacity is available
      return next();
    }

    try {
      const now = Date.now(); // Milliseconds timestamp
      const requested = 1;

      // Execute atomic Lua script
      // KEYS[1] = redisKey
      // ARGV[1] = capacity, ARGV[2] = refillRate, ARGV[3] = now, ARGV[4] = requested
      const [allowed, remainingTokens, waitSeconds] = await redis.performRateLimit(
        redisKey,
        capacity,
        refillRate,
        now,
        requested
      );

      res.setHeader('X-RateLimit-Limit', capacity);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, Math.floor(remainingTokens)));

      if (allowed === 1) {
        next();
      } else {
        res.setHeader('Retry-After', waitSeconds);
        res.status(429).json({ error: 'Too Many Requests' });
      }
    } catch (error) {
      // Fail Open: Catch execution errors (e.g. command timeouts) and let the request proceed
      console.error(`[RateLimiter] Error running rate limiter Lua script. Failing open:`, error.message);
      res.setHeader('X-RateLimit-Limit', capacity);
      res.setHeader('X-RateLimit-Remaining', capacity);
      next();
    }
  };
};

module.exports = {
  createLimiter,
  redis
};
