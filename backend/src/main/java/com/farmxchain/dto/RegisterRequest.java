package com.farmxchain.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * Inbound payload for {@code POST /api/users/register}.
 *
 * <p><b>SECURITY (P0-4):</b> this record exists specifically so that the {@code User} JPA entity is
 * never bound from a request body. There is deliberately <b>no {@code id} field</b>. Previously the
 * controller accepted {@code @RequestBody User}, so a caller could send {@code {"id": 1, ...}} and
 * {@code userRepository.save(user)} would perform a JPA <i>merge</i> rather than an insert —
 * silently overwriting an existing account, including the administrator's.
 *
 * <p>A record cannot gain fields through inheritance and has no setters, so a future refactor
 * cannot accidentally re-open that hole.
 *
 * <p>The {@code role} field is accepted but NOT trusted: the controller whitelists it against the
 * four permitted values and falls back to {@code customer} for anything else, so "admin" cannot be
 * self-assigned.
 */
public record RegisterRequest(

        @NotBlank(message = "Name is required")
        @Size(max = 120, message = "Name must be at most 120 characters")
        String name,

        /**
         * Optional. When absent or blank the controller generates one from the name.
         * Constrained here only so a caller cannot submit something unusable.
         */
        @Size(max = 50, message = "Username must be at most 50 characters")
        @Pattern(regexp = "^$|^[a-zA-Z0-9._-]+$",
                 message = "Username may contain only letters, digits, dot, underscore or hyphen")
        String username,

        @NotBlank(message = "Email is required")
        @Email(message = "Please provide a valid email address")
        @Size(max = 255, message = "Email must be at most 255 characters")
        String email,

        /**
         * Minimum 8 characters. Maximum 72 because BCrypt operates on the first 72 BYTES of input
         * and silently ignores the rest — accepting longer would give users a false sense of
         * strength and make two different passwords hash identically.
         */
        @NotBlank(message = "Password is required")
        @Size(min = 8, max = 72, message = "Password must be between 8 and 72 characters")
        String password,

        /**
         * Requested role. Validated for shape only; the controller performs the real whitelist.
         * Blank is permitted and defaults to "customer".
         */
        @Pattern(regexp = "(?i)^$|^(farmer|distributor|retailer|customer)$",
                 message = "Role must be one of: farmer, distributor, retailer, customer")
        String role) {
}
