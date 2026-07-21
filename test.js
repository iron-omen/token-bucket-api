const { TokenBucket } = require('./server');

// Helper to wait
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runTests() {
  console.log('--- Starting Token Bucket Unit Tests ---');

  // Test 1: Bucket initialization
  console.log('\nTest 1: Initializing Token Bucket...');
  const bucket = new TokenBucket(5, 1); // Capacity 5, refills 1/sec
  if (bucket.tokens !== 5) {
    throw new Error(`Expected initial tokens to be 5, got ${bucket.tokens}`);
  }
  console.log('✔ Initialized with full capacity.');

  // Test 2: Consumption
  console.log('\nTest 2: Consuming tokens...');
  for (let i = 1; i <= 5; i++) {
    const success = bucket.consume();
    if (!success) {
      throw new Error(`Expected consumption ${i} to succeed`);
    }
    console.log(`✔ Consumed 1 token. Remaining: ${bucket.tokens.toFixed(2)}`);
  }

  // Test 3: Rejection on empty bucket
  console.log('\nTest 3: Consuming from empty bucket...');
  const successOnEmpty = bucket.consume();
  if (successOnEmpty) {
    throw new Error('Expected consumption to fail on empty bucket');
  }
  const waitTime = bucket.getSecondsUntilNextToken();
  console.log(`✔ Successfully rejected when empty. Retry-After says: ${waitTime} seconds`);
  if (waitTime <= 0) {
    throw new Error(`Expected positive retry seconds, got ${waitTime}`);
  }

  // Test 4: Lazy Refill
  console.log('\nTest 4: Testing lazy refill (waiting 2.1 seconds)...');
  await sleep(2100);
  bucket.refill();
  console.log(`✔ Tokens after refill: ${bucket.tokens.toFixed(2)} (Expected around 2.1)`);
  if (bucket.tokens < 2.0 || bucket.tokens > 2.2) {
    throw new Error(`Expected tokens around 2.1, got ${bucket.tokens}`);
  }

  // Consume 2 tokens
  if (!bucket.consume() || !bucket.consume()) {
    throw new Error('Expected to be able to consume 2 tokens after refill');
  }
  console.log('✔ Successfully consumed refilled tokens.');

  // Test 5: Capacity Cap
  console.log('\nTest 5: Testing capacity cap (waiting 10 seconds)...');
  await sleep(6000); // 6 seconds is more than capacity 5
  bucket.refill();
  console.log(`✔ Tokens after overflow refill: ${bucket.tokens.toFixed(2)} (Expected to be capped at 5)`);
  if (bucket.tokens !== 5) {
    throw new Error(`Expected tokens to be capped at 5, got ${bucket.tokens}`);
  }

  console.log('\n--- All Unit Tests Passed! ---');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
