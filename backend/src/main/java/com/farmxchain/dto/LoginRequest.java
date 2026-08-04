package com.farmxchain.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Inbound payload for {@code POST /api/users/login}.
 *
 * <p><b>SECURITY (P0-4):</b> replaces {@code @RequestBody User}. Binding the entity here was less
 * dangerous than on register — nothing was persisted — but it still let a caller populate arbitrary
 * entity fields, and it kept the entity coupled to the wire format.
 *
 * <p>Validation is deliberately minimal. Login must not become a format oracle, and rejecting a
 * legacy account because its stored email does not match a strict pattern would lock a real user
 * out. Only presence is enforced; correctness is decided by the credential check.
 */
public record LoginRequest(

        @NotBlank(message = "Email is required")
        @Size(max = 255, message = "Email must be at most 255 characters")
        String email,

        @NotBlank(message = "Password is required")
        @Size(max = 72, message = "Password must be at most 72 characters")
        String password,

        /**
         * The role the user selected in the UI. The controller verifies it matches the role stored
         * in the database and rejects the login if it does not.
         */
        @NotBlank(message = "Role is required for login")
        String role) {
}
