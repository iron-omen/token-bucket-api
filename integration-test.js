const { app, server } = require('./server');

// Helper to wait
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runIntegrationTests() {
  console.log('--- Starting Express Integration Tests ---');
  const baseUrl = 'http://localhost:3000';

  // Helper to make fetch request
  const makeRequest = async (path) => {
    const res = await fetch(`${baseUrl}${path}`);
    const data = await res.json().catch(() => ({}));
    return {
      status: res.status,
      headers: Object.fromEntries(res.headers.entries()),
      data
    };
  };

  try {
    // 1. Test GET /api/ping (unlimited) - send many requests
    console.log('\nTesting GET /api/ping (unlimited)...');
    for (let i = 0; i < 10; i++) {
      const response = await makeRequest('/api/ping');
      if (response.status !== 200 || response.data.message !== 'pong') {
        throw new Error(`Ping failed on request ${i + 1}: status ${response.status}`);
      }
    }
    console.log('✔ GET /api/ping is unlimited and works perfectly.');

    // 2. Test GET /api/data (limited) - send 5 successful requests
    console.log('\nTesting GET /api/data (limited) - First 5 requests should pass...');
    for (let i = 1; i <= 5; i++) {
      const response = await makeRequest('/api/data');
      console.log(`Request ${i}: Status = ${response.status}, Remaining = ${response.headers['x-ratelimit-remaining']}`);
      if (response.status !== 200) {
        throw new Error(`Expected request ${i} to succeed with 200, got ${response.status}`);
      }
    }

    // 3. Request 6 should be rate-limited (HTTP 429)
    console.log('\nTesting GET /api/data (limited) - Request 6 should be rate-limited...');
    const response6 = await makeRequest('/api/data');
    console.log(`Request 6: Status = ${response6.status}, Retry-After = ${response6.headers['retry-after']}, Error = ${JSON.stringify(response6.data)}`);
    
    if (response6.status !== 429) {
      throw new Error(`Expected HTTP 429, got ${response6.status}`);
    }
    if (response6.data.error !== 'Too Many Requests') {
      throw new Error(`Expected error body to be { error: 'Too Many Requests' }, got ${JSON.stringify(response6.data)}`);
    }
    if (!response6.headers['retry-after'] || parseInt(response6.headers['retry-after']) <= 0) {
      throw new Error(`Expected Retry-After header to be a positive number, got ${response6.headers['retry-after']}`);
    }
    console.log('✔ GET /api/data was successfully rate-limited and returned Retry-After.');

    // 4. Wait for 1.1 seconds and make 1 successful request
    console.log('\nWaiting 1.1 seconds for 1 token to refill...');
    await sleep(1100);
    const response7 = await makeRequest('/api/data');
    console.log(`Request 7: Status = ${response7.status}, Remaining = ${response7.headers['x-ratelimit-remaining']}`);
    if (response7.status !== 200) {
      throw new Error(`Expected request 7 to succeed with 200 after waiting, got ${response7.status}`);
    }
    console.log('✔ Token refill and request consumed successfully after wait.');

    console.log('\n--- All Integration Tests Passed Successfully! ---');
  } finally {
    // Close server cleanly
    server.close();
  }
}

runIntegrationTests().catch((err) => {
  console.error('❌ Integration test failed:', err);
  if (server) server.close();
  process.exit(1);
});
