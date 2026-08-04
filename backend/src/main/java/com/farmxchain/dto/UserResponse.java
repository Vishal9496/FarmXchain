package com.farmxchain.dto;

import com.farmxchain.model.User;

import java.util.List;

/**
 * Outbound representation of a {@link User}.
 *
 * <p>This is the ONLY shape in which user data may leave the API. It deliberately omits the
 * {@code password} field, so a BCrypt hash can never be serialised into a response, written into a
 * browser's localStorage, or captured in a proxy or access log.
 *
 * <p>Implemented as a Java record: immutable by construction, carries no JPA lifecycle or
 * lazy-loading behaviour, and cannot accidentally gain a password field through inheritance.
 */
public record UserResponse(
        Long id,
        String name,
        String username,
        String email,
        String role) {

    /**
     * Maps a persisted entity to its safe outbound form.
     *
     * @param user entity to convert; must not be null
     * @return a UserResponse containing no credential material
     */
    public static UserResponse from(User user) {
        return new UserResponse(
                user.getId(),
                user.getName(),
                user.getUsername(),
                user.getEmail(),
                user.getRole());
    }

    /** Convenience mapper for collection endpoints. */
    public static List<UserResponse> fromAll(List<User> users) {
        return users.stream().map(UserResponse::from).toList();
    }
}
