package com.mathlabpro.ops;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class CacheStatusController {

    private final String redisUrl;
    private final int ttlSeconds;

    public CacheStatusController(
        @Value("${spring.data.redis.url:}") String redisUrl,
        @Value("${mathlab.cache.ttl-seconds:900}") int ttlSeconds
    ) {
        this.redisUrl = redisUrl;
        this.ttlSeconds = ttlSeconds;
    }

    @GetMapping("/api/cache/status")
    public CacheStatusResponse status() {
        boolean redisConfigured = redisUrl != null && !redisUrl.isBlank();
        return new CacheStatusResponse(
            redisConfigured ? "redis" : "memory",
            true,
            ttlSeconds,
            redisConfigured ? redact(redisUrl) : null
        );
    }

    private static String redact(String value) {
        return value.replaceAll("(?<=://)([^:@]+):([^@]+)@", "$1:***@");
    }
}
