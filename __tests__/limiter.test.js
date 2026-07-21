const request = require('supertest');
const { app, server, redis } = require('../server');

describe('Token Bucket Rate Limiter Middleware', () => {
  afterAll((done) => {
    redis.disconnect();
    server.close(done);
  });

  test('forces rate limiting behavior when Redis is online', async () => {
    // 1. Force the limiter's ready state by emitting the connect event
    redis.emit('connect');

    // 2. Mock performRateLimit to simulate actual Token Bucket behavior in Redis
    let callCount = 0;
    redis.performRateLimit = jest.fn().mockImplementation((key, capacity, refillRate, now, requested) => {
      callCount++;
      if (callCount <= 5) {
        return Promise.resolve([1, 5 - callCount, 0]); // [allowed, remaining, waitSeconds]
      } else {
        return Promise.resolve([0, 0, 1]); // blocked, 0 remaining, 1s retry-after
      }
    });

    // 3. Send 5 successful requests
    for (let i = 1; i <= 5; i++) {
      const response = await request(app)
        .get('/api/test')
        .set('x-api-key', 'jest-test-client');

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Success! Request processed.');
      expect(response.headers['x-ratelimit-limit']).toBe('5');
      expect(response.headers['x-ratelimit-remaining']).toBe(String(5 - i));
    }

    // 4. Send the 6th request which should be blocked
    const blockedResponse = await request(app)
      .get('/api/test')
      .set('x-api-key', 'jest-test-client');

    expect(blockedResponse.status).toBe(429);
    expect(blockedResponse.body.error).toBe('Too Many Requests');
    expect(blockedResponse.headers['x-ratelimit-limit']).toBe('5');
    expect(blockedResponse.headers['x-ratelimit-remaining']).toBe('0');
    expect(blockedResponse.headers['retry-after']).toBe('1');
  });

  test('fails open and allows requests if Redis is offline', async () => {
    // 1. Force the limiter's offline state by emitting close/error event
    redis.emit('close');

    // 2. Request should succeed even though Redis is down (Fail Open)
    const response = await request(app)
      .get('/api/test')
      .set('x-api-key', 'jest-test-client-offline');

    expect(response.status).toBe(200);
    expect(response.headers['x-ratelimit-limit']).toBe('5');
    expect(response.headers['x-ratelimit-remaining']).toBe('5');
    expect(response.body.message).toBe('Success! Request processed.');
  });
});
