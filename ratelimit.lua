local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local refill_rate = tonumber(ARGV[2]) -- tokens per second
local now = tonumber(ARGV[3]) -- current time in milliseconds
local requested = tonumber(ARGV[4]) -- tokens to consume, e.g. 1

-- Fetch existing data
local data = redis.call('HMGET', key, 'tokens', 'last_refill')
local tokens = tonumber(data[1])
local last_refill = tonumber(data[2])

if not tokens then
    -- Bucket doesn't exist, initialize
    tokens = capacity
    last_refill = now
else
    -- Calculate elapsed time and refilled tokens
    local elapsed_seconds = (now - last_refill) / 1000.0
    if elapsed_seconds > 0 then
        local refill_tokens = elapsed_seconds * refill_rate
        tokens = math.min(capacity, tokens + refill_tokens)
        last_refill = now
    end
end

-- Check if we have enough tokens
local allowed = 0
if tokens >= requested then
    tokens = tokens - requested
    allowed = 1
end

-- Save updated bucket state back to Redis
redis.call('HMSET', key, 'tokens', tostring(tokens), 'last_refill', tostring(last_refill))

-- Set key expiration to avoid leakage
local ttl = math.ceil(2 * (capacity / refill_rate))
if ttl < 60 then ttl = 60 end -- Minimum 60 seconds TTL
redis.call('EXPIRE', key, ttl)

-- Return result: allowed flag (1 or 0), remaining tokens, and time to wait for next token
local wait_seconds = 0
if allowed == 0 then
    wait_seconds = math.ceil((requested - tokens) / refill_rate)
end

return {allowed, tokens, wait_seconds}
