package com.farmxchain.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

/**
 * Outbound mail for FarmXChain.
 *
 * <p>Delivery is best-effort and never blocks the calling request:
 * <ul>
 *   <li>If {@code app.mail.enabled=true} and a {@link JavaMailSender} bean exists, the mail is sent
 *       over SMTP.</li>
 *   <li>Otherwise, or if SMTP delivery throws, the link is written to the server log ONLY.
 *       It is never returned to an HTTP client.</li>
 * </ul>
 *
 * <p>The method is {@code @Async} for two reasons: SMTP latency must not be added to the
 * forgot-password response (which would make the response time a user-enumeration oracle),
 * and a slow or dead SMTP host must not hold a Tomcat request thread.
 */
@Service
public class MailService {

    private static final Logger log = LoggerFactory.getLogger(MailService.class);

    private final ObjectProvider<JavaMailSender> mailSenderProvider;
    private final String fromAddress;
    private final boolean mailEnabled;

    public MailService(ObjectProvider<JavaMailSender> mailSenderProvider,
                       @Value("${app.mail.from:no-reply@farmxchain.local}") String fromAddress,
                       @Value("${app.mail.enabled:false}") boolean mailEnabled) {
        this.mailSenderProvider = mailSenderProvider;
        this.fromAddress = fromAddress;
        this.mailEnabled = mailEnabled;
    }

    /**
     * Sends the password reset link to the account owner.
     *
     * @param recipientEmail verified account email, taken from the database
     * @param resetLink      absolute URL containing the RAW (unhashed) token
     */
    @Async
    public void sendPasswordResetLink(String recipientEmail, String resetLink) {
        JavaMailSender sender = mailEnabled ? mailSenderProvider.getIfAvailable() : null;

        if (sender == null) {
            logToConsoleOnly(recipientEmail, resetLink,
                    mailEnabled ? "no JavaMailSender bean configured" : "app.mail.enabled=false");
            return;
        }

        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(fromAddress);
            message.setTo(recipientEmail);
            message.setSubject("FarmXChain - Password reset request");
            message.setText(buildBody(resetLink));

            sender.send(message);
            log.info("[Password Reset] Reset email dispatched to {}", mask(recipientEmail));

        } catch (Exception ex) {
            // Never rethrow: the caller has already returned a generic 200 to the browser.
            log.warn("[Password Reset] SMTP delivery failed for {} ({}). Falling back to console log.",
                    mask(recipientEmail), ex.getMessage());
            logToConsoleOnly(recipientEmail, resetLink, "SMTP delivery failed");
        }
    }

    private String buildBody(String resetLink) {
        return """
               Hello,

               We received a request to reset your FarmXChain password.

               Open the link below to choose a new password. The link expires in 15 minutes
               and can only be used once:

               %s

               If you did not request a password reset you can safely ignore this email -
               your password will not change.

               - The FarmXChain Team
               """.formatted(resetLink);
    }

    /**
     * Writes the link to the server log only. This is the development fallback and is the ONLY
     * place a reset link may appear outside the recipient's inbox.
     */
    private void logToConsoleOnly(String recipientEmail, String resetLink, String reason) {
        log.warn("[Password Reset] Mail not sent ({}). Reset link for {} (SERVER LOG ONLY): {}",
                reason, mask(recipientEmail), resetLink);
    }

    /**
     * Masks an email for logging so full addresses do not accumulate in log files.
     * {@code raju.kumar@example.com} becomes {@code r***r@example.com}.
     */
    private String mask(String email) {
        if (email == null || email.isBlank()) {
            return "<unknown>";
        }
        int at = email.indexOf('@');
        if (at <= 1) {
            return "***" + (at >= 0 ? email.substring(at) : "");
        }
        return email.charAt(0) + "***" + email.charAt(at - 1) + email.substring(at);
    }
}
