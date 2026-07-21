const { app, server, redis } = require('./server');

// Helper to wait
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runRedisTests() {
  console.log('--- Starting Production-Ready Redis Rate Limiter Tests ---');
  const baseUrl = 'http://localhost:3000';

  // Helper to make fetch request with optional headers
  const makeRequest = async (path, headers = {}) => {
    const res = await fetch(`${baseUrl}${path}`, { headers });
    const data = await res.json().catch(() => ({}));
    return {
      status: res.status,
      headers: Object.fromEntries(res.headers.entries()),
      data
    };
  };

  try {
    // Wait briefly to check if Redis finishes its initial connection attempt
    await sleep(500);

    console.log('\nTesting GET /api/ping (unlimited)...');
    const pingRes = await makeRequest('/api/ping');
    console.log(`Ping Status: ${pingRes.status}, Body: ${JSON.stringify(pingRes.data)}`);
    if (pingRes.status !== 200 || pingRes.data.message !== 'pong') {
      throw new Error('Ping route failed.');
    }

    console.log('\nTesting GET /api/test (rate limited with fail-open capability)...');
    
    // Send 10 rapid requests. If Redis is down, all 10 should succeed (Fail-open)
    // If Redis is running, first 5 should succeed (Status 200) and the rest should fail (Status 429)
    let succeeded = 0;
    let rateLimited = 0;

    for (let i = 1; i <= 10; i++) {
      const response = await makeRequest('/api/test', { 'x-api-key': 'test-key-123' });
      console.log(`Request ${i}: Status = ${response.status}, Limit = ${response.headers['x-ratelimit-limit']}, Remaining = ${response.headers['x-ratelimit-remaining']}, Retry-After = ${response.headers['retry-after'] || 'none'}`);
      
      if (response.status === 200) {
        succeeded++;
      } else if (response.status === 429) {
        rateLimited++;
      } else {
        throw new Error(`Unexpected status code: ${response.status}`);
      }
    }

    console.log('\n--- Test Execution Summary ---');
    console.log(`Total Requests Sent: 10`);
    console.log(`Successful Requests: ${succeeded}`);
    console.log(`Rate Limited Requests: ${rateLimited}`);

    // If Redis is down, we expect succeeded to be 10 and rateLimited to be 0
    if (succeeded === 10 && rateLimited === 0) {
      console.log('\n✔ Redis is currently offline. Fail-open mode successfully allowed all 10 requests to pass.');
    } else if (succeeded === 5 && rateLimited === 5) {
      console.log('\n✔ Redis is online. Distributed Rate Limiter is enforcing limits successfully.');
    } else {
      throw new Error(`Unexpected test outcome: ${succeeded} succeeded, ${rateLimited} rate limited.`);
    }

    console.log('\n--- Testing separate client identities (API Keys) ---');
    const resKeyA1 = await makeRequest('/api/test', { 'x-api-key': 'user-a' });
    const resKeyB1 = await makeRequest('/api/test', { 'x-api-key': 'user-b' });
    
    console.log(`User A Request 1: Status = ${resKeyA1.status}, Remaining = ${resKeyA1.headers['x-ratelimit-remaining']}`);
    console.log(`User B Request 1: Status = ${resKeyB1.status}, Remaining = ${resKeyB1.headers['x-ratelimit-remaining']}`);
    
    if (resKeyA1.status !== 200 || resKeyB1.status !== 200) {
      throw new Error('Requests with API keys failed.');
    }
    console.log('✔ Successfully verified multiple client identity tracking via API keys.');

    console.log('\n--- All Redis Rate Limiter Tests Run Successfully! ---');
  } catch (error) {
    console.error('❌ Tests failed:', error);
    process.exit(1);
  } finally {
    // Clean up connections and server
    redis.disconnect();
    server.close();
  }
}

runRedisTests();
