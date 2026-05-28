package com.mathlabpro.ops;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record CacheStatusResponse(String provider, boolean enabled, int ttlSeconds, String redisUrl) {
}
