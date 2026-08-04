package com.farmxchain.config;

import com.farmxchain.repository.PasswordResetTokenRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;

/**
 * Background sweep that removes expired password reset tokens.
 *
 * <p>{@link com.farmxchain.controller.AuthController#forgotPassword} already purges expired rows on
 * every call, so this is a safety net for installations that go long periods without a reset
 * request. Requires {@code @EnableScheduling} on the application class.
 */
@Component
public class PasswordResetTokenCleanupTask {

    private static final Logger log = LoggerFactory.getLogger(PasswordResetTokenCleanupTask.class);

    private final PasswordResetTokenRepository tokenRepository;

    public PasswordResetTokenCleanupTask(PasswordResetTokenRepository tokenRepository) {
        this.tokenRepository = tokenRepository;
    }

    /** Runs 15 minutes after the previous run finishes. Interval is configurable. */
    @Scheduled(fixedDelayString = "${app.password-reset.cleanup-interval-ms:900000}",
               initialDelayString = "${app.password-reset.cleanup-initial-delay-ms:60000}")
    public void purgeExpiredTokens() {
        try {
            int removed = tokenRepository.deleteAllExpiredBefore(Instant.now());
            if (removed > 0) {
                log.info("[Password Reset] Scheduled cleanup removed {} expired token(s)", removed);
            }
        } catch (Exception ex) {
            log.error("[Password Reset] Scheduled token cleanup failed", ex);
        }
    }
}
