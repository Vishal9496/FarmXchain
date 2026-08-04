package com.farmxchain.exception;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Translates Bean Validation failures into the response shape the React client already expects.
 *
 * <p><b>Why this is required rather than optional.</b> Without it, a {@code @Valid} failure produces
 * Spring Boot's default error body, which has no {@code "message"} key. {@code Register.js:84} reads
 * {@code error.response?.data?.message} and falls through to {@code error.message}, so the user
 * would see "Registration Failed: Request failed with status code 400" instead of
 * "Password must be between 8 and 72 characters". Adding {@code @Valid} without this handler would
 * be a visible UX regression.
 *
 * <p><b>Deliberately narrow.</b> This advice handles only validation and malformed-JSON failures.
 * It does NOT add a catch-all {@code Exception} handler, because that would change the error
 * behaviour of every other controller in the application — out of scope for P0-4.
 */
@RestControllerAdvice
public class ValidationExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(ValidationExceptionHandler.class);

    /**
     * Fires when a {@code @Valid @RequestBody} argument fails its constraints.
     *
     * @return 400 with a human-readable {@code message} plus a per-field {@code errors} map
     */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> onValidationFailure(MethodArgumentNotValidException ex) {

        // LinkedHashMap preserves declaration order, so the message reads in field order.
        Map<String, String> fieldErrors = new LinkedHashMap<>();
        for (FieldError fe : ex.getBindingResult().getFieldErrors()) {
            fieldErrors.putIfAbsent(
                    fe.getField(),
                    fe.getDefaultMessage() == null ? "is invalid" : fe.getDefaultMessage());
        }

        String summary = String.join(" ", fieldErrors.values());

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("timestamp", Instant.now().toString());
        body.put("status", HttpStatus.BAD_REQUEST.value());
        body.put("message", summary);   // consumed by Register.js / api.js
        body.put("errors", fieldErrors);

        log.debug("Validation failed on {}: {}", ex.getParameter().getExecutable().getName(), fieldErrors);

        return ResponseEntity.badRequest().body(body);
    }

    /**
     * Fires when the request body is absent or is not parseable JSON.
     * Previously this produced a bare 400 with no usable message.
     */
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<Map<String, Object>> onUnreadableBody(HttpMessageNotReadableException ex) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("timestamp", Instant.now().toString());
        body.put("status", HttpStatus.BAD_REQUEST.value());
        body.put("message", "Request body is missing or malformed.");

        log.debug("Unreadable request body: {}", ex.getMessage());

        return ResponseEntity.badRequest().body(body);
    }
}
