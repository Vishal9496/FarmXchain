package com.farmxchain.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.io.DecodingException;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;

/**
 * Issues and parses the application's JSON Web Tokens.
 *
 * <p><b>Key management.</b> The signing key is supplied by the {@code JWT_SECRET} environment
 * variable via {@code jwt.secret} in {@code application.properties}. It is never present in source
 * control. The value is expected to be Base64 and must decode to at least 256 bits, which is the
 * minimum HMAC key length RFC 7518 §3.2 mandates for HS256. Both conditions are checked once at
 * startup so a misconfigured deployment fails immediately rather than issuing weak tokens.
 *
 * <p><b>Claim validation.</b> Every parse verifies the signature, the expiry, the issuer and the
 * audience. A token minted by another service that happens to share the key will be rejected.
 */
@Component
public class JwtUtil {

    private static final Logger log = LoggerFactory.getLogger(JwtUtil.class);

    private static final String ROLE_CLAIM = "role";

    /** RFC 7518 §3.2: an HS256 key must be at least 256 bits (32 bytes). */
    private static final int MIN_KEY_BITS = 256;
    private static final int MIN_KEY_BYTES = MIN_KEY_BITS / 8;

    private final SecretKey key;
    private final long expirationMs;
    private final String issuer;
    private final String audience;
    private final long clockSkewSeconds;

    /**
     * @param secret           Base64-encoded signing key, from {@code JWT_SECRET}
     * @param expirationMs     token lifetime in milliseconds (default 15 minutes)
     * @param issuer           value written to and required in the {@code iss} claim
     * @param audience         value written to and required in the {@code aud} claim
     * @param clockSkewSeconds tolerance for clock drift between servers when checking {@code exp}
     */
    public JwtUtil(@Value("${jwt.secret}") String secret,
                   @Value("${jwt.expiration-ms:900000}") long expirationMs,
                   @Value("${jwt.issuer:farmxchain-auth}") String issuer,
                   @Value("${jwt.audience:farmxchain-web}") String audience,
                   @Value("${jwt.clock-skew-seconds:60}") long clockSkewSeconds) {

        this.key = buildSigningKey(secret);
        this.expirationMs = expirationMs;
        this.issuer = issuer;
        this.audience = audience;
        this.clockSkewSeconds = clockSkewSeconds;

        log.info("JwtUtil initialised: issuer={}, audience={}, tokenLifetime={} minutes, clockSkew={}s",
                issuer, audience, expirationMs / 60_000, clockSkewSeconds);
    }

    // ============================================================================
    // KEY CONSTRUCTION
    // ============================================================================

    /**
     * Turns the configured secret into an HMAC-SHA key, failing fast if it is unusable.
     *
     * <p>Base64 is the expected encoding, because it lets an operator use the full byte range
     * rather than only printable characters — 32 bytes of Base64 carries a genuine 256 bits of
     * entropy, whereas a 32-character passphrase carries far less. If the value is not valid
     * Base64 it is accepted as raw text using an <b>explicit UTF-8</b> charset (never the platform
     * default, which would make the key depend on the machine's locale), and a warning is logged.
     *
     * @throws IllegalStateException if the secret is missing or shorter than 256 bits
     */
    private static SecretKey buildSigningKey(String secret) {
        if (secret == null || secret.isBlank()) {
            throw new IllegalStateException(
                    "jwt.secret is not configured. Set the JWT_SECRET environment variable. "
                  + "Generate one with:  openssl rand -base64 64");
        }

        String trimmed = secret.trim();
        byte[] keyBytes;

        try {
            keyBytes = Decoders.BASE64.decode(trimmed);
        } catch (DecodingException ex) {
            log.warn("jwt.secret is not valid Base64; using its raw UTF-8 bytes. "
                   + "A Base64-encoded random value is strongly preferred: openssl rand -base64 64");
            keyBytes = trimmed.getBytes(StandardCharsets.UTF_8);
        }

        if (keyBytes.length < MIN_KEY_BYTES) {
            throw new IllegalStateException(String.format(
                    "jwt.secret is too weak: %d bits after decoding, minimum is %d bits for HS256. "
                  + "Generate a compliant key with:  openssl rand -base64 64",
                    keyBytes.length * 8, MIN_KEY_BITS));
        }

        return Keys.hmacShaKeyFor(keyBytes);
    }

    // ============================================================================
    // TOKEN GENERATION
    // ============================================================================

    /**
     * Builds a signed token for an authenticated user.
     *
     * <p>The role is written from the value the caller read out of the database. It is never taken
     * from a request body, so a client cannot assert its own privileges.
     *
     * @param email user's email, becomes the {@code sub} claim
     * @param role  user's role, becomes the {@code role} claim
     */
    public String generateToken(String email, String role) {
        Date now = new Date();
        Date expiry = new Date(now.getTime() + expirationMs);

        return Jwts.builder()
                .setSubject(email)
                .claim(ROLE_CLAIM, role)
                .setIssuer(issuer)
                .setAudience(audience)
                .setIssuedAt(now)
                .setExpiration(expiry)
                .signWith(key, SignatureAlgorithm.HS256)
                .compact();
    }

    // ============================================================================
    // TOKEN PARSING
    // ============================================================================

    /** Extracts the email ({@code sub} claim) from a token. */
    public String extractEmail(String token) {
        return extractClaims(token).getSubject();
    }

    /**
     * Extracts the role claim. This is the authoritative source of a caller's role — the value is
     * covered by the signature, so it cannot be tampered with client-side.
     */
    public String extractRole(String token) {
        return extractClaims(token).get(ROLE_CLAIM, String.class);
    }

    /**
     * Returns true when the token is well formed, correctly signed, unexpired, carries the expected
     * issuer and audience, and belongs to the supplied email.
     *
     * <p>Currently unused by the application — {@link JwtAuthFilter} relies on {@link #extractClaims}
     * throwing — but retained as part of the public API.
     */
    public boolean validateToken(String token, String email) {
        if (token == null || email == null) {
            return false;
        }
        try {
            return email.equals(extractClaims(token).getSubject());
        } catch (JwtException | IllegalArgumentException e) {
            return false;
        }
    }

    /**
     * Parses and fully validates a token, returning its claims.
     *
     * <p>{@code parseClaimsJws} verifies the signature and rejects an expired token;
     * {@code requireIssuer} and {@code requireAudience} reject a correctly signed token that was
     * minted for a different service or client.
     *
     * @throws IllegalArgumentException if the token is absent, malformed, expired, wrongly signed,
     *                                  or carries an unexpected issuer or audience
     */
    private Claims extractClaims(String token) {
        try {
            return Jwts.parserBuilder()
                       .setSigningKey(key)
                       .requireIssuer(issuer)
                       .requireAudience(audience)
                       .setAllowedClockSkewSeconds(clockSkewSeconds)
                       .build()
                       .parseClaimsJws(token)
                       .getBody();
        } catch (JwtException e) {
            // Preserves the original contract: callers catch IllegalArgumentException.
            throw new IllegalArgumentException("Invalid JWT token", e);
        }
    }
}
