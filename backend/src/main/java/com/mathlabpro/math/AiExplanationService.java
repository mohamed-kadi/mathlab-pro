package com.mathlabpro.math;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.mathlabpro.common.ApiException;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class AiExplanationService {

    private static final String SYSTEM_PROMPT = """
        You are "MathLab Pro AI", a symbolic mathematics specialist and pedagogical tutor.
        Return strict JSON with keys explanation, steps, and latex. Use concise step-by-step math reasoning.
        """;

    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;
    private final String apiKey;
    private final String baseUrl;
    private final String model;

    public AiExplanationService(
        ObjectMapper objectMapper,
        @Value("${mathlab.ai.provider.api-key:${AI_PROVIDER_API_KEY:}}") String apiKey,
        @Value("${mathlab.ai.provider.base-url:${AI_PROVIDER_BASE_URL:}}") String baseUrl,
        @Value("${mathlab.ai.provider.model:${AI_PROVIDER_MODEL:}}") String model
    ) {
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        this.baseUrl = trimTrailingSlash(baseUrl == null ? "" : baseUrl.trim());
        this.model = model == null ? "" : model.trim();
    }

    public Map<String, Object> explain(Map<String, Object> request) {
        String query = requiredString(request.get("query"), "query", 1, 4000);
        String category = optionalString(request.get("category"), "category", 120, "general math");

        if (!isProviderConfigured()) {
            return offlineExplanation(query);
        }

        try {
            return providerExplanation(query, category);
        } catch (IOException | InterruptedException | RuntimeException exception) {
            if (exception instanceof InterruptedException) Thread.currentThread().interrupt();
            return failedProviderExplanation(exception);
        }
    }

    private Map<String, Object> providerExplanation(String query, String category) throws IOException, InterruptedException {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("model", model);
        payload.put("temperature", 0.1);
        payload.put("response_format", Map.of("type", "json_object"));
        payload.put("messages", List.of(
            Map.of("role", "system", "content", SYSTEM_PROMPT),
            Map.of("role", "user", "content", "Solve and explain this " + category + " query: " + query)
        ));

        HttpRequest httpRequest = HttpRequest.newBuilder(URI.create(baseUrl + "/chat/completions"))
            .timeout(Duration.ofSeconds(20))
            .header("Authorization", "Bearer " + apiKey)
            .header("Content-Type", "application/json")
            .header("User-Agent", "mathlab-pro")
            .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(payload)))
            .build();

        HttpResponse<String> response = httpClient.send(httpRequest, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw new IllegalStateException("AI provider request failed with status " + response.statusCode() + ".");
        }

        String text = extractProviderText(objectMapper.readTree(response.body()));
        if (text.isBlank()) {
            throw new IllegalStateException("AI provider returned an empty explanation.");
        }
        return parseProviderJson(text);
    }

    private Map<String, Object> parseProviderJson(String text) throws JsonProcessingException {
        JsonNode parsed = objectMapper.readTree(text.trim());
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("explanation", parsed.path("explanation").asText("No explanation provided."));
        result.put("steps", stringArray(parsed.path("steps")));
        result.put("latex", parsed.path("latex").asText(""));
        return result;
    }

    private String extractProviderText(JsonNode payload) {
        JsonNode content = payload.path("choices").path(0).path("message").path("content");
        if (content.isMissingNode() || content.isNull()) content = payload.path("output_text");
        if (content.isMissingNode() || content.isNull()) content = payload.path("text");
        if (content.isTextual()) return content.asText();
        if (content.isArray()) {
            StringBuilder builder = new StringBuilder();
            for (JsonNode item : content) {
                if (item.isTextual()) builder.append(item.asText());
                else if (item.has("text")) builder.append(item.path("text").asText());
            }
            return builder.toString();
        }
        return "";
    }

    private Map<String, Object> offlineExplanation(String query) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("explanation", """
            **[Local Offline Mode]** This explanation is generated offline because the backend AI provider is not configured.

            To solve **%s**, parse the expression, identify the algebraic or calculus rule, apply the rule step by step, and verify the result by substitution or differentiation when possible.

            Configure AI_PROVIDER_BASE_URL, AI_PROVIDER_API_KEY, and AI_PROVIDER_MODEL to enable live AI tutoring.
            """.formatted(query));
        result.put("steps", List.of(
            "Check expression terms and variables.",
            "Select the matching symbolic, numeric, or calculus method.",
            "Apply the method step by step and verify the final expression."
        ));
        result.put("latex", "f(x) = \\int g(x) dx");
        return result;
    }

    private Map<String, Object> failedProviderExplanation(Exception exception) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("explanation", "Failed to contact the AI math service: " + exception.getMessage());
        result.put("steps", List.of("Check backend AI provider configuration and telemetry logs."));
        result.put("latex", "");
        return result;
    }

    private boolean isProviderConfigured() {
        return !apiKey.isBlank() && !baseUrl.isBlank() && !model.isBlank();
    }

    private static List<String> stringArray(JsonNode node) {
        if (!node.isArray()) return List.of();
        java.util.ArrayList<String> values = new java.util.ArrayList<>();
        for (JsonNode item : node) {
            if (item.isTextual()) values.add(item.asText());
            else values.add(item.toString());
        }
        return values;
    }

    private static String requiredString(Object value, String field, int min, int max) {
        if (!(value instanceof String string)) throw badRequest(field + " is required.");
        String trimmed = string.trim();
        if (trimmed.length() < min || trimmed.length() > max) throw badRequest(field + " length is invalid.");
        return trimmed;
    }

    private static String optionalString(Object value, String field, int max, String fallback) {
        if (value == null) return fallback;
        return requiredString(value, field, 1, max);
    }

    private static String trimTrailingSlash(String value) {
        return value.replaceAll("/+$", "");
    }

    private static ApiException badRequest(String message) {
        return new ApiException(HttpStatus.BAD_REQUEST, message);
    }
}
