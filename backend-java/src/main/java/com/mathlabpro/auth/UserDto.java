package com.mathlabpro.auth;

import java.time.Instant;

public record UserDto(String id, String username, String email, Instant createdAt) {

    public static UserDto from(UserAccount user) {
        return new UserDto(user.getId(), user.getUsername(), user.getEmail(), user.getCreatedAt());
    }
}
