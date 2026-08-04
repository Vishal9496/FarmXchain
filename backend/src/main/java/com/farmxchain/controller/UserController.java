package com.farmxchain.controller;

import com.farmxchain.dto.LoginRequest;
import com.farmxchain.dto.RegisterRequest;
import com.farmxchain.dto.UserResponse;
import com.farmxchain.model.PasswordResetToken;
import com.farmxchain.model.User;
import com.farmxchain.repository.PasswordResetTokenRepository;
import com.farmxchain.repository.UserRepository;
import com.farmxchain.security.JwtUtil;
import com.farmxchain.service.MailService;

import jakarta.validation.Valid;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Map;
import java.util.Optional;
import java.util.List;
import java.util.regex.Pattern;

@RestController
@RequestMapping("/api/users")
@CrossOrigin(origins = "http://localhost:3000")
public class UserController {

    private static final Logger log = LoggerFactory.getLogger(UserController.class);

    private static final Pattern BCRYPT_PATTERN =
            Pattern.compile("^\\$2[aby]\\$\\d{2}\\$[./A-Za-z0-9]{53}$");

    private static final int RESET_TOKEN_TTL_MINUTES = 15;
    private static final int RESET_TOKEN_BYTES = 32;
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JwtUtil jwtUtil;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private PasswordResetTokenRepository tokenRepository;

    @Autowired
    private MailService mailService;

    @Value("${app.frontend.base-url:http://localhost:3000}")
    private String frontendBaseUrl;

    // Test endpoint
    @GetMapping("/test")
    public String testApi() {
        return "Welcome to FarmXChain Auth!";
    }

    @PostMapping("/register")
    public ResponseEntity<?> registerUser(@Valid @RequestBody RegisterRequest request) {

        String email = request.email().trim();

        if (userRepository.findByEmail(email).isPresent()) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                                 .body(Map.of("message", "Email already exists!"));
        }

        User user = new User();
        user.setName(request.name().trim());
        user.setEmail(email);

        String username = request.username();
        if (username == null || username.isBlank()) {
            username = request.name().toLowerCase().replaceAll("\\s+", "") + System.currentTimeMillis();
        }
        user.setUsername(username.trim());

        user.setRole(whitelistRole(request.role()));

        user.setPassword(passwordEncoder.encode(request.password()));

        try {
            userRepository.save(user);
        } catch (DataIntegrityViolationException ex) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                                 .body(Map.of("message", "Email already exists!"));
        }

        return ResponseEntity.ok(Map.of("message", "User registered successfully!",
                                        "user", UserResponse.from(user)));
    }

    private String whitelistRole(String requestedRole) {
        if (requestedRole == null || requestedRole.isEmpty()) {
            return "customer";
        }
        String roleUpper = requestedRole.toUpperCase();
        if ("FARMER".equals(roleUpper)) {
            return "farmer";
        } else if ("DISTRIBUTOR".equals(roleUpper)) {
            return "distributor";
        } else if ("RETAILER".equals(roleUpper)) {
            return "retailer";
        } else if ("CUSTOMER".equals(roleUpper)) {
            return "customer";
        }
        log.warn("[SECURITY] Attempted role registration: {} -> defaulted to customer", requestedRole);
        return "customer";
    }

    /**
     * Authenticate and issue a JWT. BCrypt only; legacy plaintext accounts are
     * redirected into a forced password reset. See {@link #isBcryptHash} and
     * {@link #issueForcedPasswordReset}.
     */
    @PostMapping("/login")
    @Transactional
    public ResponseEntity<?> loginUser(@Valid @RequestBody LoginRequest request) {

        Optional<User> userOpt = userRepository.findByEmail(request.email().trim());

        if (userOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                                 .body(Map.of("message", "Invalid email or password!"));
        }

        User user = userOpt.get();
        String rawPassword = request.password();
        String storedPassword = user.getPassword();

        if (isBcryptHash(storedPassword)) {
            if (!passwordEncoder.matches(rawPassword, storedPassword)) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                                     .body(Map.of("message", "Invalid email or password!"));
            }

            if (user.getRole() == null || !user.getRole().equalsIgnoreCase(request.role())) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(Map.of("message", "Role mismatch for this account. Please select your assigned role."));
            }

            String token = jwtUtil.generateToken(user.getEmail(), user.getRole());

            return ResponseEntity.ok(Map.of(
                "message", "Login successful!",
                "user", UserResponse.from(user),
                "token", token
            ));
        }

        boolean legacyValueMatches = constantTimeEquals(rawPassword, storedPassword);

        if (!legacyValueMatches) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                                 .body(Map.of("message", "Invalid email or password!"));
        }

        issueForcedPasswordReset(user);

        log.info("[SECURITY] Legacy password detected for userId={} - login blocked, reset issued",
                user.getId());

        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of(
            "message", "For your security we've upgraded our password storage. "
                     + "We've sent a password reset link to your email - please reset your "
                     + "password to continue.",
            "passwordResetRequired", true
        ));
    }

    private boolean isBcryptHash(String storedPassword) {
        return storedPassword != null && BCRYPT_PATTERN.matcher(storedPassword).matches();
    }

    private boolean constantTimeEquals(String a, String b) {
        if (a == null || b == null) {
            return false;
        }
        byte[] x = a.getBytes(StandardCharsets.UTF_8);
        byte[] y = b.getBytes(StandardCharsets.UTF_8);
        return MessageDigest.isEqual(x, y);
    }

    private void issueForcedPasswordReset(User user) {
        tokenRepository.deleteByUser(user);

        String rawToken  = generateRawToken();
        String tokenHash = sha256Hex(rawToken);
        Instant expiry   = Instant.now().plus(RESET_TOKEN_TTL_MINUTES, ChronoUnit.MINUTES);

        tokenRepository.save(new PasswordResetToken(tokenHash, user, expiry));

        String resetLink = frontendBaseUrl
                + "/reset-password?token="
                + URLEncoder.encode(rawToken, StandardCharsets.UTF_8);

        mailService.sendPasswordResetLink(user.getEmail(), resetLink);
    }

    private static String generateRawToken() {
        byte[] bytes = new byte[RESET_TOKEN_BYTES];
        SECURE_RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private static String sha256Hex(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hashed = digest.digest(value.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hashed);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 algorithm not available", e);
        }
    }

    /**
     * Admin-only: list all users.
     *
     * ✅ SECURITY (P0-11): previously this method took
     * {@code @RequestHeader("Authorization") String authHeader}, manually stripped
     * the {@code "Bearer "} prefix, called {@code jwtUtil.extractRole(token)}, and
     * compared the result to {@code "admin"} by hand — logic identical to what
     * {@code JwtAuthFilter} already performs for every request, and identical to
     * the copy of it repeated in {@link #updateUserRole} and {@link #deleteUser}
     * below. {@code @PreAuthorize("hasRole('ADMIN')")} replaces all of it: Spring
     * Security evaluates the caller's granted authorities — already attached to
     * the request's {@code SecurityContext} by the filter — before this method
     * body ever runs, and rejects with 403 automatically via the
     * {@code AccessDeniedHandler} configured in {@code SecurityConfig} if the
     * check fails. No header, no token variable, no manual comparison.
     */
    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping
    public ResponseEntity<?> getAllUsers() {
        List<User> users = userRepository.findAll();
        return ResponseEntity.ok(UserResponse.fromAll(users));
    }

    /**
     * Admin-only: update a user's role.
     *
     * ✅ SECURITY (P0-11): same duplicate manual-parsing block removed as in
     * {@link #getAllUsers}. The {@code @RequestHeader} parameter is gone from the
     * method signature entirely — the method has no remaining use for the raw
     * token, since the only thing it was ever used for here was the role check
     * that {@code @PreAuthorize} now performs declaratively.
     */
    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping("/{id}/role")
    public ResponseEntity<?> updateUserRole(
            @PathVariable Long id,
            @RequestBody Map<String, String> body) {

        Optional<User> userOpt = userRepository.findById(id);
        if (!userOpt.isPresent()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                                 .body(Map.of("message", "User not found!"));
        }

        User user = userOpt.get();

        if (user.getRole().equalsIgnoreCase("admin")) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                                 .body(Map.of("message", "Admin role cannot be changed!"));
        }

        String role = body.get("role");
        if (role.equalsIgnoreCase("admin")) role = "customer";

        user.setRole(role);
        userRepository.save(user);

        return ResponseEntity.ok(Map.of("message", "Role updated successfully!",
                                        "user", UserResponse.from(user)));
    }

    /**
     * Admin-only: delete a user.
     *
     * ✅ SECURITY (P0-11): same pattern as {@link #getAllUsers} and
     * {@link #updateUserRole} — the third and final copy of the identical manual
     * header-parsing block in this file, now removed.
     */
    @PreAuthorize("hasRole('ADMIN')")
    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteUser(@PathVariable Long id) {

        Optional<User> userOpt = userRepository.findById(id);
        if (!userOpt.isPresent()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                                 .body(Map.of("message", "User not found!"));
        }

        User user = userOpt.get();

        if (user.getRole().equalsIgnoreCase("admin")) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                                 .body(Map.of("message", "Admin user cannot be deleted!"));
        }

        userRepository.deleteById(id);
        return ResponseEntity.ok(Map.of("message", "User deleted successfully!"));
    }

}
