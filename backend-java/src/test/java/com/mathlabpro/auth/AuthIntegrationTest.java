package com.mathlabpro.auth;

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

import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.emptyOrNullString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AuthIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void registerLoginAndCurrentUserUseJwtContract() throws Exception {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        String username = "contract-" + suffix;
        String email = username + "@example.com";
        String password = "contract-password-123";

        String registerJson = objectMapper.writeValueAsString(Map.of(
            "username", username,
            "email", email,
            "password", password
        ));

        String registerBody = mockMvc.perform(post("/api/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(registerJson))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.token", not(emptyOrNullString())))
            .andExpect(jsonPath("$.user.email").value(email))
            .andExpect(jsonPath("$.user.passwordHash").doesNotExist())
            .andReturn()
            .getResponse()
            .getContentAsString();

        JsonNode registerNode = objectMapper.readTree(registerBody);
        String token = registerNode.get("token").asText();

        mockMvc.perform(post("/api/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(registerJson))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.error").isString());

        mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of(
                    "email", email,
                    "password", "wrong-password"
                ))))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.error").isString());

        mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of(
                    "email", email,
                    "password", password
                ))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.token", not(emptyOrNullString())))
            .andExpect(jsonPath("$.user.email").value(email));

        mockMvc.perform(get("/api/auth/me")
                .header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.user.email").value(email))
            .andExpect(jsonPath("$.user.passwordHash").doesNotExist());

        mockMvc.perform(get("/api/cache/status"))
            .andExpect(status().isUnauthorized());

        mockMvc.perform(get("/api/cache/status")
                .header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.provider").isString())
            .andExpect(jsonPath("$.enabled").value(true))
            .andExpect(jsonPath("$.ttlSeconds").isNumber());
    }
}
