package com.farmxchain.controller;

import com.farmxchain.model.PasswordResetToken;
import com.farmxchain.model.User;
import com.farmxchain.repository.PasswordResetTokenRepository;
import com.farmxchain.repository.UserRepository;
import com.farmxchain.service.MailService;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
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

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "http://localhost:3000")
public class AuthController {

    private static final Logger log = LoggerFactory.getLogger(AuthController.class);

    /** Reset links expire 15 minutes after issue. */
    private static final int RESET_TOKEN_TTL_MINUTES = 15;

    /** Number of random bytes behind each reset token (256 bits of entropy). */
    private static final int RESET_TOKEN_BYTES = 32;

    /**
     * Returned for EVERY forgot-password request, whether or not the email exists.
     * Identical wording and identical HTTP status is what prevents user enumeration.
     */
    private static final String GENERIC_RESET_MESSAGE =
            "If this email is registered, a reset link has been sent.";

    /** Returned for every reset failure so a caller cannot distinguish the reason. */
    private static final String INVALID_TOKEN_MESSAGE = "Invalid or expired token";

    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordResetTokenRepository tokenRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private MailService mailService;

    @Value("${app.frontend.base-url:http://localhost:3000}")
    private String frontendBaseUrl;

    // ============================================================================
    // POST /api/auth/forgot-password
    // ============================================================================

    /**
     * Issues a password reset link.
     *
     * <p>Security properties:
     * <ul>
     *   <li>The link is NEVER returned in the HTTP response. It is delivered by
     *       {@link MailService} only.</li>
     *   <li>The response body and status are byte-identical whether or not the email exists.</li>
     *   <li>Only the SHA-256 hash of the token is persisted. The raw token exists solely in
     *       memory and in the outgoing email.</li>
     *   <li>Any previously issued token for the same user is deleted, so only the newest link works.</li>
     *   <li>Expired tokens are purged on every call.</li>
     * </ul>
     */
    @PostMapping("/forgot-password")
    @Transactional
    public ResponseEntity<?> forgotPassword(@RequestBody Map<String, String> body) {
        String email = body.get("email");
        if (email == null || email.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Email is required"));
        }

        // Housekeeping: remove tokens that can no longer be used by anyone.
        int purged = tokenRepository.deleteAllExpiredBefore(Instant.now());
        if (purged > 0) {
            log.debug("[Password Reset] Purged {} expired token(s) during forgot-password", purged);
        }

        Optional<User> userOpt = userRepository.findByEmail(email.trim());

        if (userOpt.isPresent()) {
            User user = userOpt.get();

            // Only one live reset link per account.
            tokenRepository.deleteByUser(user);

            String rawToken  = generateRawToken();   // emailed, never persisted
            String tokenHash = sha256Hex(rawToken);  // persisted, never emailed
            Instant expiry   = Instant.now().plus(RESET_TOKEN_TTL_MINUTES, ChronoUnit.MINUTES);

            tokenRepository.save(new PasswordResetToken(tokenHash, user, expiry));

            String resetLink = frontendBaseUrl
                    + "/reset-password?token="
                    + URLEncoder.encode(rawToken, StandardCharsets.UTF_8);

            // Async: SMTP latency must not leak into the response time.
            mailService.sendPasswordResetLink(user.getEmail(), resetLink);
        }

        // Identical response on every path. No link, no hint about account existence.
        return ResponseEntity.ok(Map.of("message", GENERIC_RESET_MESSAGE));
    }

    // ============================================================================
    // POST /api/auth/reset-password
    // ============================================================================

    /**
     * Consumes a reset token and sets a new password.
     *
     * <p>The client submits the RAW token from the emailed link. The server hashes it and looks up
     * the hash, because the database only ever holds hashes. The token row is deleted on success
     * and on expiry, making every token strictly single-use.
     */
    @PostMapping("/reset-password")
    @Transactional
    public ResponseEntity<?> resetPassword(@RequestBody Map<String, String> body) {
        String rawToken   = body.get("token");
        String newPassword = body.get("password");

        if (rawToken == null || rawToken.isBlank() || newPassword == null || newPassword.isBlank()) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("message", "Invalid request"));
        }

        // The database stores hashes, so hash the submitted token before lookup.
        String tokenHash = sha256Hex(rawToken);

        Optional<PasswordResetToken> tokenOpt = tokenRepository.findByToken(tokenHash);
        if (tokenOpt.isEmpty()) {
            log.warn("[Password Reset] Reset attempted with an unknown token");
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("message", INVALID_TOKEN_MESSAGE));
        }

        PasswordResetToken prt = tokenOpt.get();

        if (prt.getExpiresAt().isBefore(Instant.now())) {
            tokenRepository.delete(prt);
            log.warn("[Password Reset] Reset attempted with an expired token (userId={})",
                    prt.getUser() != null ? prt.getUser().getId() : null);
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("message", INVALID_TOKEN_MESSAGE));
        }

        User user = prt.getUser();
        user.setPassword(passwordEncoder.encode(newPassword));
        userRepository.save(user);

        // Single-use: delete by entity identity, not by a second lookup.
        tokenRepository.delete(prt);

        log.info("[Password Reset] Password successfully updated for userId={}", user.getId());

        return ResponseEntity.ok(Map.of("message", "Password updated"));
    }

    // ============================================================================
    // TOKEN HELPERS
    // ============================================================================

    /**
     * Generates a cryptographically random, URL-safe reset token.
     *
     * <p>32 random bytes (256 bits) from {@link SecureRandom}, Base64URL encoded without padding,
     * so the value is safe to place in a query string without escaping surprises.
     */
    private static String generateRawToken() {
        byte[] bytes = new byte[RESET_TOKEN_BYTES];
        SECURE_RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    /**
     * SHA-256 of the supplied value, lowercase hex (64 characters).
     *
     * <p>A plain hash (not BCrypt) is correct here: the input is 256 bits of machine-generated
     * entropy, so there is nothing to brute force and no salt is needed. The purpose is only to
     * ensure that a leaked database — or a leaked SQL dump — contains no usable credential.
     */
    private static String sha256Hex(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hashed = digest.digest(value.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hashed);
        } catch (NoSuchAlgorithmException e) {
            // SHA-256 is mandatory on every conformant JVM; this cannot happen in practice.
            throw new IllegalStateException("SHA-256 algorithm not available", e);
        }
    }
}
