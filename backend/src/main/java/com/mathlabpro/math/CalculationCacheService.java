package com.mathlabpro.math;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.mathlabpro.ops.CacheStatusResponse;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class CalculationCacheService {

    private final ConcurrentHashMap<String, CacheEntry> entries = new ConcurrentHashMap<>();
    private final ObjectMapper objectMapper;
    private final Clock clock;
    private final int ttlSeconds;
    private final int maxEntries;

    @Autowired
    public CalculationCacheService(
        ObjectMapper objectMapper,
        @Value("${mathlab.cache.ttl-seconds:900}") int ttlSeconds,
        @Value("${mathlab.cache.max-entries:1000}") int maxEntries
    ) {
        this(objectMapper, Clock.systemUTC(), ttlSeconds, maxEntries);
    }

    CalculationCacheService(ObjectMapper objectMapper, Clock clock, int ttlSeconds, int maxEntries) {
        this.objectMapper = objectMapper;
        this.clock = clock;
        this.ttlSeconds = Math.max(1, ttlSeconds);
        this.maxEntries = Math.max(1, maxEntries);
    }

    public String key(String pathname, Map<String, Object> body) {
        try {
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("pathname", pathname);
            payload.put("body", canonicalize(body));
            String serialized = objectMapper.writeValueAsString(payload);
            return "mathlab:calc:" + sha256(serialized);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Unable to serialize calculation cache key.", exception);
        }
    }

    public Optional<Map<String, Object>> get(String key) {
        CacheEntry entry = entries.get(key);
        if (entry == null) return Optional.empty();
        if (entry.expiresAtMillis() <= clock.millis()) {
            entries.remove(key);
            return Optional.empty();
        }
        return Optional.of(entry.value());
    }

    public void set(String key, Map<String, Object> value) {
        evictIfNeeded();
        entries.put(key, new CacheEntry(value, clock.millis() + ttlSeconds * 1000L));
    }

    public CacheStatusResponse status() {
        return new CacheStatusResponse("memory", true, ttlSeconds, null);
    }

    private Object canonicalize(Object value) {
        if (value instanceof Map<?, ?> map) {
            Map<String, Object> result = new LinkedHashMap<>();
            map.entrySet().stream()
                .sorted(Comparator.comparing(entry -> String.valueOf(entry.getKey())))
                .forEach(entry -> result.put(String.valueOf(entry.getKey()), canonicalize(entry.getValue())));
            return result;
        }
        if (value instanceof List<?> list) {
            List<Object> result = new ArrayList<>(list.size());
            for (Object item : list) result.add(canonicalize(item));
            return result;
        }
        return value;
    }

    private void evictIfNeeded() {
        if (entries.size() < maxEntries) return;
        long now = clock.millis();
        entries.entrySet().removeIf(entry -> entry.getValue().expiresAtMillis() <= now);
        if (entries.size() < maxEntries) return;
        entries.entrySet().stream()
            .min(Comparator.comparingLong(entry -> entry.getValue().expiresAtMillis()))
            .ifPresent(entry -> entries.remove(entry.getKey()));
    }

    private static String sha256(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
            StringBuilder builder = new StringBuilder(digest.length * 2);
            for (byte b : digest) builder.append(String.format("%02x", b));
            return builder.toString();
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is required for calculation cache keys.", exception);
        }
    }

    private record CacheEntry(Map<String, Object> value, long expiresAtMillis) {
    }
}
