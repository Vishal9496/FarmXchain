package com.farmxchain.model;

import jakarta.persistence.*;
import java.time.Instant;

/**
 * A single-use, time-limited password reset credential.
 *
 * <p>SECURITY: the {@code token} column stores the SHA-256 HEX DIGEST of the token that was
 * emailed to the user — never the token itself. A leaked database or SQL dump therefore contains
 * no usable reset credential.
 */
@Entity
@Table(name = "password_reset_tokens",
       indexes = @Index(name = "idx_prt_expires_at", columnList = "expiresAt"))
public class PasswordResetToken {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** SHA-256 hex digest of the emailed token. Always exactly 64 characters. */
    @Column(nullable = false, unique = true, length = 64)
    private String token;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false)
    private Instant expiresAt;

    public PasswordResetToken() {}

    /**
     * @param token      SHA-256 hex digest of the raw token, NOT the raw token
     * @param user       account the token belongs to
     * @param expiresAt  absolute expiry instant (15 minutes after issue)
     */
    public PasswordResetToken(String token, User user, Instant expiresAt) {
        this.token = token;
        this.user = user;
        this.expiresAt = expiresAt;
    }

    public Long getId() { return id; }
    public String getToken() { return token; }
    public void setToken(String token) { this.token = token; }
    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }
    public Instant getExpiresAt() { return expiresAt; }
    public void setExpiresAt(Instant expiresAt) { this.expiresAt = expiresAt; }
}
