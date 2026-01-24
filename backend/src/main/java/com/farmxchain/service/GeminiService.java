package com.farmxchain.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import java.time.Duration;
import java.util.List;
import java.util.Map;

@Service
public class GeminiService {

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;
    private final String apiKey;
    private final String model;

    public GeminiService(RestTemplateBuilder restTemplateBuilder,
                         ObjectMapper objectMapper,
                         @Value("${gemini.api.key:}") String apiKey,
                         @Value("${gemini.model:gemini-2.5-flash}") String model) {
        this.restTemplate = restTemplateBuilder
                .setConnectTimeout(Duration.ofSeconds(10))
                .setReadTimeout(Duration.ofSeconds(30))
                .build();
        this.objectMapper = objectMapper;
        this.apiKey = apiKey;
        this.model = model;
    }

    public GeminiQualityResponse analyzeImage(String product, String base64Image) {
        if (apiKey == null || apiKey.isBlank()) {
            throw new IllegalStateException("Gemini API key is not configured. Set GEMINI_API_KEY in the environment.");
        }
        if (base64Image == null || base64Image.isBlank()) {
            throw new IllegalArgumentException("Image payload is required.");
        }

        String endpoint = "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + apiKey;

        Map<String, Object> payload = Map.of(
                "contents", List.of(
                        Map.of(
                                "role", "user",
                                "parts", List.of(
                                        Map.of("text", buildPrompt(product)),
                                        Map.of("inlineData", Map.of(
                                                "mimeType", "image/jpeg",
                                                "data", base64Image
                                        ))
                                )
                        )
                ),
                "generationConfig", Map.of(
                        "responseMimeType", "application/json",
                        "responseSchema", Map.of(
                                "type", "OBJECT",
                                "properties", Map.of(
                                        "productName", Map.of("type", "STRING"),
                                        "freshnessStatus", Map.of("type", "STRING"),
                                        "overallQuality", Map.of("type", "STRING"),
                                        "confidence", Map.of("type", "NUMBER", "format", "float"),
                                        "justification", Map.of("type", "STRING")
                                ),
                                "propertyOrdering", List.of("productName", "freshnessStatus", "overallQuality", "confidence", "justification")
                        )
                )
        );

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        ResponseEntity<String> response = restTemplate.exchange(
                endpoint,
                HttpMethod.POST,
                new HttpEntity<>(payload, headers),
                String.class
        );

        if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
            throw new IllegalStateException("Gemini API request failed with status: " + response.getStatusCode());
        }

        return mapResponse(product, response.getBody());
    }

    private GeminiQualityResponse mapResponse(String product, String rawBody) {
        try {
            JsonNode root = objectMapper.readTree(rawBody);
            JsonNode textNode = root.path("candidates").path(0).path("content").path("parts").path(0).path("text");
            String textPayload = textNode.asText("");
            if (textPayload.isBlank()) {
                throw new IllegalStateException("Gemini returned an empty response.");
            }

            JsonNode modelJson = objectMapper.readTree(textPayload);
            String productName = modelJson.path("productName").asText(product == null ? "Product" : product);
            String freshnessStatus = modelJson.path("freshnessStatus").asText("Unknown");
            String overallQuality = modelJson.path("overallQuality").asText("Unknown");
            double confidenceScore = modelJson.path("confidence").asDouble(0.75);
            String justification = modelJson.path("justification").asText("No justification provided.");

            double rating = qualityToRating(overallQuality);
            boolean consumable = isConsumable(overallQuality);
            int confidence = (int) Math.round(Math.min(Math.max(confidenceScore, 0.0), 1.0) * 100);
            int freshnessPercent = deriveFreshnessPercent(freshnessStatus, rating);

            return new GeminiQualityResponse(
                    productName,
                    overallQuality,
                    rating,
                    consumable,
                    justification,
                    confidence,
                    freshnessPercent
            );
        } catch (Exception ex) {
            throw new IllegalStateException("Unable to parse Gemini response", ex);
        }
    }

    private String buildPrompt(String product) {
        String safeProduct = (product == null || product.isBlank()) ? "product" : product;
        return "Analyze the provided image of a " + safeProduct + " for its quality. " +
                "Determine its freshness (e.g., Fresh, Stale, Ripe), assign a quality grade (e.g., A, B, C, or D), " +
                "and provide a brief justification. Give an estimated confidence score between 0.5 and 1.0. " +
                "Respond ONLY with a JSON object following this schema.";
    }

    private double qualityToRating(String overallQuality) {
        if (overallQuality == null) {
            return 3.5;
        }
        return switch (overallQuality.toUpperCase()) {
            case "A" -> 4.7;
            case "B" -> 4.1;
            case "C" -> 3.3;
            case "D" -> 2.3;
            default -> 3.8;
        };
    }

    private boolean isConsumable(String overallQuality) {
        if (overallQuality == null) {
            return true;
        }
        String normalized = overallQuality.toUpperCase();
        return !("D".equals(normalized) || "POOR".equals(normalized));
    }

    private int deriveFreshnessPercent(String freshnessStatus, double rating) {
        if (freshnessStatus == null) {
            freshnessStatus = "Unknown";
        }
        String normalized = freshnessStatus.toUpperCase();
        return switch (normalized) {
            case "FRESH" -> 90;
            case "RIPE" -> 85;
            case "STALE", "SPOILED" -> 35;
            default -> (int) Math.round(Math.min(Math.max(rating, 1.0), 5.0) / 5.0 * 100);
        };
    }

    public record GeminiQualityResponse(
            String detectedProduct,
            String quality,
            double rating,
            boolean consumable,
            String analysis,
            int confidence,
            int freshnessPercent
    ) {
    }
}
