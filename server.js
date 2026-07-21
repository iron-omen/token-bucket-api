const express = require('express');
const { createLimiter, redis } = require('./limiter');

const app = express();
const PORT = process.env.PORT || 3000;

// Configure the rate limiter with 5 capacity and 1 token/second refill rate
const limiter = createLimiter({
  capacity: 5,
  refillRate: 1,
  keyPrefix: 'rate_limit:test'
});

app.set('trust proxy', true);

// /api/test endpoint with the Redis-backed token bucket rate limiter
app.get('/api/test', limiter, (req, res) => {
  const authMethod = req.headers['x-api-key'] ? 'API Key' : 'IP Address';
  const clientIdentifier = req.headers['x-api-key'] || req.ip;

  res.json({
    message: "Success! Request processed.",
    client: clientIdentifier,
    authMethod: authMethod,
    timestamp: new Date().toISOString()
  });
});

// A ping route to check server availability (no rate limit)
app.get('/api/ping', (req, res) => {
  res.json({
    message: "pong",
    timestamp: new Date().toISOString()
  });
});

const server = app.listen(PORT, () => {
  console.log(`Express server listening on port ${PORT}`);
});

module.exports = { app, server, redis };
