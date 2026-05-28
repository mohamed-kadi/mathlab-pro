package com.mathlabpro.math;

import com.mathlabpro.workspace.AuditService;
import java.util.LinkedHashMap;
import java.util.Map;
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
    private final AuditService auditService;

    public MathController(MathEngineService mathEngineService, AuditService auditService) {
        this.mathEngineService = mathEngineService;
        this.auditService = auditService;
    }

    @PostMapping("/polynomial")
    public Map<String, Object> polynomial(@AuthenticationPrincipal Jwt jwt, @RequestBody Map<String, Object> request) {
        Map<String, Object> response = mathEngineService.polynomial(request);
        recordCalculation(jwt, "math.polynomial", request, response);
        return response;
    }

    @PostMapping("/algebra")
    public Map<String, Object> algebra(@AuthenticationPrincipal Jwt jwt, @RequestBody Map<String, Object> request) {
        Map<String, Object> response = mathEngineService.algebra(request);
        recordCalculation(jwt, "math.algebra", request, response);
        return response;
    }

    @PostMapping("/matrix")
    public Map<String, Object> matrix(@AuthenticationPrincipal Jwt jwt, @RequestBody Map<String, Object> request) {
        Map<String, Object> response = mathEngineService.matrix(request);
        recordCalculation(jwt, "math.matrix", request, response);
        return response;
    }

    @PostMapping("/numerical")
    public Map<String, Object> numerical(@AuthenticationPrincipal Jwt jwt, @RequestBody Map<String, Object> request) {
        Map<String, Object> response = mathEngineService.numerical(request);
        recordCalculation(jwt, "math.numerical", request, response);
        return response;
    }

    @PostMapping("/calculus")
    public Map<String, Object> calculus(@AuthenticationPrincipal Jwt jwt, @RequestBody Map<String, Object> request) {
        Map<String, Object> response = mathEngineService.calculus(request);
        recordCalculation(jwt, "math.calculus", request, response);
        return response;
    }

    @PostMapping("/statistics")
    public Map<String, Object> statistics(@AuthenticationPrincipal Jwt jwt, @RequestBody Map<String, Object> request) {
        Map<String, Object> response = mathEngineService.statistics(request);
        recordCalculation(jwt, "math.statistics", request, response);
        return response;
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
