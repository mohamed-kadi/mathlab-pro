package com.mathlabpro.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "mathlab.jwt")
public record JwtProperties(String secret, String expiresIn) {

    public JwtProperties {
        if (secret == null || secret.isBlank()) {
            secret = "mathlab-pro-local-dev-secret-change-me-at-least-32-chars";
        }
        if (expiresIn == null || expiresIn.isBlank()) {
            expiresIn = "7d";
        }
    }
}
