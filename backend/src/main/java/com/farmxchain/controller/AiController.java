package com.farmxchain.controller;

import com.farmxchain.service.GeminiService;
import com.farmxchain.service.GeminiService.GeminiQualityResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/ai")
public class AiController {

    private final GeminiService geminiService;

    public AiController(GeminiService geminiService) {
        this.geminiService = geminiService;
    }

    @PostMapping("/quality-check")
    public ResponseEntity<?> analyzeImage(@RequestBody AnalyzeRequest request) {
        if (request == null || request.base64Image() == null || request.base64Image().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Image is required"));
        }

        try {
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
