package com.mathlabpro.workspace;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.emptyOrNullString;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class WorkspaceIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void workspaceHistoryAndAuditEndpointsMatchPortableContract() throws Exception {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        String primaryEmail = "primary-" + suffix + "@example.com";
        String secondaryEmail = "secondary-" + suffix + "@example.com";
        String primaryToken = register("primary-" + suffix, primaryEmail);
        String secondaryToken = register("secondary-" + suffix, secondaryEmail);

        mockMvc.perform(get("/api/projects"))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.error").isString());

        mockMvc.perform(get("/api/history"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$").isArray());

        mockMvc.perform(get("/api/history")
                .header("Authorization", "Bearer invalid.token.value"))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.error").isString());

        JsonNode expression = postJson("/api/saved-expressions", primaryToken, Map.of(
            "name", "Contract Quadratic",
            "rawExpression", "x^2 + 2*x + 1",
            "latexExpression", "x^2 + 2x + 1"
        ));
        String expressionId = expression.path("id").asText();

        mockMvc.perform(put("/api/saved-expressions/{id}", expressionId)
                .header("Authorization", bearer(primaryToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("name", "Updated Contract Quadratic"))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.name").value("Updated Contract Quadratic"));

        mockMvc.perform(delete("/api/saved-expressions/{id}", expressionId)
                .header("Authorization", bearer(secondaryToken)))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.error").isString());

        JsonNode project = postJson("/api/projects", primaryToken, Map.of(
            "name", "Contract Workspace",
            "description", "Project created by portable API contract tests.",
            "sheets", java.util.List.of(Map.of(
                "id", "sheet-contract",
                "name", "Inputs",
                "cells", Map.of("A1", "2", "B1", "3", "C1", "=A1+B1")
            ))
        ));
        String projectId = project.path("id").asText();

        mockMvc.perform(put("/api/projects/{id}", projectId)
                .header("Authorization", bearer(primaryToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("description", "Updated by contract tests."))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.description").value("Updated by contract tests."));

        mockMvc.perform(post("/api/graph-configurations")
                .header("Authorization", bearer(secondaryToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of(
                    "projectId", projectId,
                    "name", "Unauthorized Graph",
                    "config", Map.of("expressions", java.util.List.of("sin(x)"))
                ))))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.error").isString());

        JsonNode graph = postJson("/api/graph-configurations", primaryToken, Map.of(
            "projectId", projectId,
            "name", "Contract Graph",
            "config", Map.of("expressions", java.util.List.of("sin(x)"))
        ));
        String graphId = graph.path("id").asText();

        JsonNode share = postJson("/api/shared-workspaces", primaryToken, Map.of(
            "projectId", projectId,
            "sharedWithEmail", secondaryEmail,
            "role", "viewer"
        ));
        String shareId = share.path("id").asText();

        mockMvc.perform(get("/api/shared-workspaces/incoming")
                .header("Authorization", bearer(secondaryToken)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$", hasSize(1)))
            .andExpect(jsonPath("$[0].id").value(shareId))
            .andExpect(jsonPath("$[0].projectId").value(projectId));

        mockMvc.perform(post("/api/history")
                .header("Authorization", bearer(primaryToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("type", "polynomial", "input", "x^2", "output", "2*x"))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.input").value("x^2"));

        mockMvc.perform(get("/api/history")
                .header("Authorization", bearer(primaryToken)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].input").value("x^2"));

        mockMvc.perform(post("/api/math/polynomial")
                .header("Authorization", bearer(primaryToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of(
                    "expression", "x^2 + 2*x + 1",
                    "operation", "derivative",
                    "variable", "x"
                ))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.output").isString());

        JsonNode auditLogs = objectMapper.readTree(mockMvc.perform(get("/api/audit-logs")
                    .header("Authorization", bearer(primaryToken)))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString());

        assertTrue(hasAuditLog(auditLogs, "saved-expressions", "create"));
        assertTrue(hasAuditLog(auditLogs, "math.polynomial", "calculate"));

        mockMvc.perform(delete("/api/shared-workspaces/{id}", shareId)
                .header("Authorization", bearer(primaryToken)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.success").value(true));

        mockMvc.perform(delete("/api/graph-configurations/{id}", graphId)
                .header("Authorization", bearer(primaryToken)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.success").value(true));

        mockMvc.perform(delete("/api/saved-expressions/{id}", expressionId)
                .header("Authorization", bearer(primaryToken)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.success").value(true));

        mockMvc.perform(delete("/api/projects/{id}", projectId)
                .header("Authorization", bearer(primaryToken)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.success").value(true));
    }

    private String register(String username, String email) throws Exception {
        String body = mockMvc.perform(post("/api/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of(
                    "username", username,
                    "email", email,
                    "password", "contract-password-123"
                ))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.token", not(emptyOrNullString())))
            .andReturn()
            .getResponse()
            .getContentAsString();
        return objectMapper.readTree(body).path("token").asText();
    }

    private JsonNode postJson(String path, String token, Object request) throws Exception {
        String response = mockMvc.perform(post(path)
                .header("Authorization", bearer(token))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();
        return objectMapper.readTree(response);
    }

    private static boolean hasAuditLog(JsonNode logs, String resource, String action) {
        for (JsonNode log : logs) {
            if (resource.equals(log.path("resource").asText()) && action.equals(log.path("action").asText())) {
                return true;
            }
        }
        return false;
    }

    private static String bearer(String token) {
        return "Bearer " + token;
    }
}
