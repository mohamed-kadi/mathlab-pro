package com.mathlabpro.math;

import com.mathlabpro.workspace.AuditService;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.function.Supplier;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/math")
public class MathController {

    private final MathEngineService mathEngineService;
    private final AiExplanationService aiExplanationService;
    private final CalculationCacheService calculationCacheService;
    private final AuditService auditService;

    public MathController(
        MathEngineService mathEngineService,
        AiExplanationService aiExplanationService,
        CalculationCacheService calculationCacheService,
        AuditService auditService
    ) {
        this.mathEngineService = mathEngineService;
        this.aiExplanationService = aiExplanationService;
        this.calculationCacheService = calculationCacheService;
        this.auditService = auditService;
    }

    @PostMapping("/polynomial")
    public ResponseEntity<Map<String, Object>> polynomial(@AuthenticationPrincipal Jwt jwt, @RequestBody Map<String, Object> request) {
        return cachedCalculation("/api/math/polynomial", jwt, "math.polynomial", request, () -> mathEngineService.polynomial(request));
    }

    @PostMapping("/algebra")
    public ResponseEntity<Map<String, Object>> algebra(@AuthenticationPrincipal Jwt jwt, @RequestBody Map<String, Object> request) {
        return cachedCalculation("/api/math/algebra", jwt, "math.algebra", request, () -> mathEngineService.algebra(request));
    }

    @PostMapping("/matrix")
    public ResponseEntity<Map<String, Object>> matrix(@AuthenticationPrincipal Jwt jwt, @RequestBody Map<String, Object> request) {
        return cachedCalculation("/api/math/matrix", jwt, "math.matrix", request, () -> mathEngineService.matrix(request));
    }

    @PostMapping("/numerical")
    public ResponseEntity<Map<String, Object>> numerical(@AuthenticationPrincipal Jwt jwt, @RequestBody Map<String, Object> request) {
        return cachedCalculation("/api/math/numerical", jwt, "math.numerical", request, () -> mathEngineService.numerical(request));
    }

    @PostMapping("/calculus")
    public ResponseEntity<Map<String, Object>> calculus(@AuthenticationPrincipal Jwt jwt, @RequestBody Map<String, Object> request) {
        return cachedCalculation("/api/math/calculus", jwt, "math.calculus", request, () -> mathEngineService.calculus(request));
    }

    @PostMapping("/statistics")
    public ResponseEntity<Map<String, Object>> statistics(@AuthenticationPrincipal Jwt jwt, @RequestBody Map<String, Object> request) {
        return cachedCalculation("/api/math/statistics", jwt, "math.statistics", request, () -> mathEngineService.statistics(request));
    }

    @PostMapping("/ai-explain")
    public Map<String, Object> aiExplain(@AuthenticationPrincipal Jwt jwt, @RequestBody Map<String, Object> request) {
        Map<String, Object> response = aiExplanationService.explain(request);
        recordCalculation(jwt, "math.ai-explain", request, response);
        return response;
    }

    private ResponseEntity<Map<String, Object>> cachedCalculation(
        String pathname,
        Jwt jwt,
        String resource,
        Map<String, Object> request,
        Supplier<Map<String, Object>> calculation
    ) {
        String cacheKey = calculationCacheService.key(pathname, request);
        return calculationCacheService.get(cacheKey)
            .map(response -> {
                recordCalculation(jwt, resource, request, response);
                return response("HIT", cacheKey, response);
            })
            .orElseGet(() -> {
                Map<String, Object> response = calculation.get();
                calculationCacheService.set(cacheKey, response);
                recordCalculation(jwt, resource, request, response);
                return response("MISS", cacheKey, response);
            });
    }

    private static ResponseEntity<Map<String, Object>> response(String cacheStatus, String cacheKey, Map<String, Object> body) {
        HttpHeaders headers = new HttpHeaders();
        headers.set("X-MathLab-Cache", cacheStatus);
        headers.set("X-MathLab-Cache-Key", cacheKey);
        return ResponseEntity.ok().headers(headers).body(body);
    }

    private void recordCalculation(Jwt jwt, String resource, Map<String, Object> request, Map<String, Object> response) {
        if (jwt == null) return;
        Map<String, Object> metadata = new LinkedHashMap<>();
        metadata.put("operation", request.getOrDefault("operation", request.getOrDefault("method", resource.substring(resource.lastIndexOf('.') + 1))));
        if (request.containsKey("expression")) metadata.put("expression", request.get("expression"));
        if (response.containsKey("output")) metadata.put("output", response.get("output"));
        auditService.record(jwt.getSubject(), "calculate", resource, null, metadata);
    }
}
