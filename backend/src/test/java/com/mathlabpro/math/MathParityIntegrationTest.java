package com.mathlabpro.math;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.matchesPattern;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class MathParityIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void mathCalculationsExposeStableCacheHeaders() throws Exception {
        String coefficient = Integer.toString(Math.abs(UUID.randomUUID().hashCode() % 1000) + 10);

        Map<String, Object> firstRequest = new LinkedHashMap<>();
        firstRequest.put("expression", "x^2 + " + coefficient + "*x + 1");
        firstRequest.put("operation", "derivative");
        firstRequest.put("variable", "x");

        mockMvc.perform(post("/api/math/polynomial")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(firstRequest)))
            .andExpect(status().isOk())
            .andExpect(header().string("X-MathLab-Cache", "MISS"))
            .andExpect(header().string("X-MathLab-Cache-Key", matchesPattern("^mathlab:calc:[0-9a-f]{64}$")))
            .andExpect(jsonPath("$.output").isString());

        Map<String, Object> reorderedRequest = new LinkedHashMap<>();
        reorderedRequest.put("variable", "x");
        reorderedRequest.put("operation", "derivative");
        reorderedRequest.put("expression", "x^2 + " + coefficient + "*x + 1");

        mockMvc.perform(post("/api/math/polynomial")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(reorderedRequest)))
            .andExpect(status().isOk())
            .andExpect(header().string("X-MathLab-Cache", "HIT"))
            .andExpect(header().string("X-MathLab-Cache-Key", matchesPattern("^mathlab:calc:[0-9a-f]{64}$")))
            .andExpect(jsonPath("$.output").isString());
    }

    @Test
    void aiExplainUsesValidationAndLocalFallback() throws Exception {
        mockMvc.perform(post("/api/math/ai-explain")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("category", "calculus"))))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error").isString());

        mockMvc.perform(post("/api/math/ai-explain")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of(
                    "query", "Explain the derivative of x^2.",
                    "category", "calculus"
                ))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.explanation").isString())
            .andExpect(jsonPath("$.steps").isArray())
            .andExpect(jsonPath("$.latex").isString());
    }

    @Test
    void algebraUsesSymjaForExpandedSymbolicCoverage() throws Exception {
        mockMvc.perform(post("/api/math/algebra")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of(
                    "operation", "expand",
                    "expression", "(x + y)^2",
                    "variable", "x"
                ))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.output").value("x^2+2*x*y+y^2"))
            .andExpect(jsonPath("$.steps[2]").value("Computed symbolic result with Symja."));

        mockMvc.perform(post("/api/math/algebra")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of(
                    "operation", "simplify",
                    "expression", "(x^2 - 1)/(x - 1)",
                    "variable", "x"
                ))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.output").value("1+x"));

        mockMvc.perform(post("/api/math/algebra")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of(
                    "operation", "factor",
                    "expression", "x^3 - 1",
                    "variable", "x"
                ))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.output").value("(-1+x)*(1+x+x^2)"));
    }
}
