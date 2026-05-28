package com.mathlabpro.auth;

import com.mathlabpro.config.JwtProperties;
import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.stereotype.Service;

@Service
public class JwtTokenService {

    private final JwtEncoder jwtEncoder;
    private final JwtProperties jwtProperties;

    public JwtTokenService(JwtEncoder jwtEncoder, JwtProperties jwtProperties) {
        this.jwtEncoder = jwtEncoder;
        this.jwtProperties = jwtProperties;
    }

    public String createToken(UserAccount user) {
        Instant issuedAt = Instant.now();
        Instant expiresAt = issuedAt.plus(parseDuration(jwtProperties.expiresIn()));
        JwtClaimsSet claims = JwtClaimsSet.builder()
            .issuer("mathlab-pro")
            .issuedAt(issuedAt)
            .expiresAt(expiresAt)
            .subject(user.getId())
            .claim("username", user.getUsername())
            .claim("email", user.getEmail())
            .build();

        JwsHeader header = JwsHeader.with(MacAlgorithm.HS256).build();
        return jwtEncoder.encode(JwtEncoderParameters.from(header, claims)).getTokenValue();
    }

    private static Duration parseDuration(String value) {
        if (value == null || value.isBlank()) {
            return Duration.ofDays(7);
        }
        String normalized = value.trim().toLowerCase(Locale.ROOT);
        if (normalized.startsWith("p")) {
            return Duration.parse(normalized.toUpperCase(Locale.ROOT));
        }

        char unit = normalized.charAt(normalized.length() - 1);
        long amount = Character.isDigit(unit)
            ? Long.parseLong(normalized)
            : Long.parseLong(normalized.substring(0, normalized.length() - 1));

        return switch (unit) {
            case 's' -> Duration.ofSeconds(amount);
            case 'm' -> Duration.ofMinutes(amount);
            case 'h' -> Duration.ofHours(amount);
            case 'd' -> Duration.ofDays(amount);
            default -> Duration.ofSeconds(amount);
        };
    }
}
