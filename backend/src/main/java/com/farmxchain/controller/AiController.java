package com.farmxchain.controller;

import com.farmxchain.service.GeminiService;
import com.farmxchain.service.GeminiService.GeminiQualityResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/ai")
public class AiController {

    /**
     * Hard cap on the base64 payload. 8 MB of base64 is roughly a 6 MB image.
     * Without this an anonymous — now authenticated — caller could post an arbitrarily large
     * string, which is held in memory twice (request body + outbound Gemini payload).
     */
    private static final int MAX_BASE64_LENGTH = 8 * 1024 * 1024;

    private final GeminiService geminiService;

    public AiController(GeminiService geminiService) {
        this.geminiService = geminiService;
    }

    /**
     * ✅ SECURITY (P0-5): "/api/ai/**" was permitAll, so anyone on the internet could POST here and
     * spend the project's Gemini quota — a direct, billable denial-of-wallet.
     *
     * <p>Now requires a valid JWT. {@code isAuthenticated()} rather than a specific role because
     * App.js currently exposes /ai-quality-check to allowedRoles={["customer"]} AND the customer
     * dashboard opens it in a modal. Narrowing this to FARMER would break that UI, so the role
     * decision belongs in App.js first — see the change document.
     */
    @PreAuthorize("isAuthenticated()")
    @PostMapping("/quality-check")
    public ResponseEntity<?> analyzeImage(@RequestBody AnalyzeRequest request,
                                          Authentication authentication) {
        if (request == null || request.base64Image() == null || request.base64Image().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Image is required"));
        }

        if (request.base64Image().length() > MAX_BASE64_LENGTH) {
            return ResponseEntity.badRequest()
                    .body(Map.of("message", "Image is too large. Maximum size is about 6 MB."));
        }

        try {
            // Audit trail: who is spending the quota.
            System.out.println("[AI] quality-check requested by " + authentication.getName());

            GeminiQualityResponse response = geminiService.analyzeImage(request.product(), request.base64Image());
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("message", ex.getMessage()));
        } catch (IllegalStateException ex) {
            return ResponseEntity.internalServerError().body(Map.of("message", ex.getMessage()));
        }
    }

    public record AnalyzeRequest(String product, String base64Image) {
    }
}
