package com.mathlabpro.auth;

import com.mathlabpro.common.ApiException;
import java.time.Instant;
import java.util.Locale;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenService jwtTokenService;

    public AuthService(
        UserRepository userRepository,
        PasswordEncoder passwordEncoder,
        JwtTokenService jwtTokenService
    ) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtTokenService = jwtTokenService;
    }

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        String email = normalizeEmail(request.email());
        if (userRepository.existsByEmailIgnoreCaseOrUsernameIgnoreCase(email, request.username())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "User on this email or username already exists.");
        }

        UserAccount user = new UserAccount(
            "usr-" + UUID.randomUUID(),
            request.username().trim(),
            email,
            passwordEncoder.encode(request.password()),
            Instant.now()
        );
        userRepository.save(user);
        return authResponse(user);
    }

    @Transactional(readOnly = true)
    public AuthResponse login(LoginRequest request) {
        UserAccount user = userRepository.findByEmailIgnoreCase(normalizeEmail(request.email()))
            .orElseThrow(() -> invalidCredentials());

        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw invalidCredentials();
        }

        return authResponse(user);
    }

    @Transactional(readOnly = true)
    public UserDto currentUser(String userId) {
        UserAccount user = userRepository.findById(userId)
            .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Authentication required."));
        return UserDto.from(user);
    }

    private AuthResponse authResponse(UserAccount user) {
        return new AuthResponse(jwtTokenService.createToken(user), UserDto.from(user));
    }

    private static ApiException invalidCredentials() {
        return new ApiException(HttpStatus.UNAUTHORIZED, "Invalid email or credentials");
    }

    private static String normalizeEmail(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }
}
