package com.mathlabpro.auth;

public record AuthResponse(String token, UserDto user) {
}
