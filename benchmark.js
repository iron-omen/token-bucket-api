const autocannon = require('autocannon');

console.log('Starting benchmark... Firing 500 concurrent connections for 10 seconds.');

const instance = autocannon({
  url: 'http://localhost:3000/api/test',
  connections: 500,
  duration: 10,
}, (err, result) => {
  if (err) {
    console.error('Benchmark failed:', err);
  } else {
    console.log('\n--- Benchmark Results ---');
    console.log(`Total Requests: ${result.requests.total}`);
    console.log(`Successful (2xx): ${result.non2xx === 0 ? result.requests.total : result.requests.total - result.non2xx}`);
    console.log(`Rate Limited/Failed (Non-2xx): ${result.non2xx}`);
  }
});

autocannon.track(instance, { renderProgressBar: true });