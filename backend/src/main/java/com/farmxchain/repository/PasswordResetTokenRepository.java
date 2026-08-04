package com.farmxchain.repository;

import java.time.Instant;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import com.farmxchain.model.PasswordResetToken;
import com.farmxchain.model.User;

public interface PasswordResetTokenRepository extends JpaRepository<PasswordResetToken, Long> {

    /**
     * Looks up a token row by its stored value.
     *
     * <p>NOTE: since the P0-1 fix, the stored value is the SHA-256 HEX of the emailed token,
     * never the emailed token itself. Callers must hash before calling this method.
     */
    Optional<PasswordResetToken> findByToken(String token);

    /**
     * Retained for backward compatibility. No longer used by AuthController, which deletes by
     * entity identity instead.
     *
     * <p>{@code @Transactional} is required: Spring Data derived delete queries inherit
     * {@code SimpleJpaRepository}'s class-level {@code @Transactional(readOnly = true)}, which puts
     * Hibernate into MANUAL flush mode. Without an explicit read-write transaction the delete can
     * silently fail to flush.
     */
    @Transactional
    void deleteByToken(String token);

    /**
     * Removes every outstanding reset token for a user, so that issuing a new link invalidates
     * all previous ones.
     */
    @Transactional
    void deleteByUser(User user);

    /**
     * Bulk-deletes every token whose expiry is in the past.
     *
     * <p>A bulk {@code @Modifying} JPQL statement rather than a derived {@code deleteBy...} method:
     * the derived form loads every matching entity into the persistence context before deleting
     * them one by one, which is wasteful for a housekeeping sweep.
     *
     * @param cutoff usually {@code Instant.now()}
     * @return number of rows removed
     */
    @Transactional
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("DELETE FROM PasswordResetToken t WHERE t.expiresAt < :cutoff")
    int deleteAllExpiredBefore(@Param("cutoff") Instant cutoff);
}
