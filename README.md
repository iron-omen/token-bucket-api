# 🚀 Distributed Token-Bucket Rate Limiter

A high-performance, distributed API rate limiter built with **Node.js, Express, and Redis**. 

This project implements the **Token Bucket algorithm** to strictly control API traffic while gracefully allowing bursts. It is designed for high availability, utilizing atomic Redis operations to prevent race conditions and a robust "fail-open" architecture to keep the API online during database outages.

## ✨ Key Features

* **Atomic Lua Processing:** Token calculation and deduction happen inside Redis via custom Lua scripts (`ratelimit.lua`), completely eliminating race conditions across concurrent API requests.
* **Fail-Open Fault Tolerance:** If the Redis cluster goes offline or times out, the middleware automatically defaults to allowing traffic, ensuring a caching failure does not cause a total API outage.
* **Distributed Architecture:** State is managed centrally in Redis (compatible with local Docker or cloud providers like Upstash), allowing multiple Node.js server instances to share the same rate limits seamlessly.
* **RFC-Compliant Headers:** Automatically attaches standard `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `Retry-After` headers to responses.

## 📊 Performance & Benchmarks

Subjected to a heavy load test using `autocannon` to simulate a DDoS event:
* **Load:** 500 concurrent connections for 10 seconds.
* **Throughput:** ~10,188 requests per second.
* **Resilience Test:** During the test, the cloud Redis connection was intentionally overloaded. The system instantly activated the **Fail-Open** mechanism, dropping `0` requests and successfully returning `2xx` responses for all **112,069** requests with an average latency of just 48ms.

## 🛠️ Tech Stack
* **Backend:** Node.js, Express.js
* **Database:** Redis (ioredis)
* **Testing:** Jest, Supertest
* **Benchmarking:** Autocannon

## 🚦 Quick Start

### 1. Clone the repository
```bash
git clone [https://github.com/YOUR_USERNAME/token-bucket-api.git](https://github.com/YOUR_USERNAME/token-bucket-api.git)
cd token-bucket-api
npm install
