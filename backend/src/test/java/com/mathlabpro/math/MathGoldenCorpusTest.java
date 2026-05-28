package com.mathlabpro.math;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class MathGoldenCorpusTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void springBackendPassesDeterministicMathGoldenCorpus() throws Exception {
        JsonNode cases = objectMapper.readTree(Files.readString(corpusPath())).path("cases");
        assertTrue(cases.isArray(), "Golden corpus cases must be an array.");

        for (JsonNode testCase : cases) {
            String id = testCase.path("id").asText();
            JsonNode expected = testCase.path("expected");
            MvcResult result = mockMvc.perform(post(testCase.path("endpoint").asText())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(testCase.path("request"))))
                .andReturn();

            assertEquals(expected.path("status").asInt(), result.getResponse().getStatus(), id + " status");

            JsonNode body = objectMapper.readTree(result.getResponse().getContentAsString());
            if (expected.has("outputIncludes")) {
                String output = body.path("output").asText();
                for (JsonNode expectedText : expected.path("outputIncludes")) {
                    assertTrue(output.contains(expectedText.asText()), id + " output should contain " + expectedText.asText());
                }
            }

            if (expected.has("stepsMin")) {
                assertTrue(body.path("steps").isArray(), id + " steps must be an array");
                assertTrue(body.path("steps").size() >= expected.path("stepsMin").asInt(), id + " steps length");
            }

            for (JsonNode numeric : expected.path("numeric")) {
                JsonNode actual = path(body, numeric.path("path").asText());
                assertNotNull(actual, id + " numeric path exists");
                assertTrue(actual.isNumber(), id + " numeric path must be a number");
                double delta = Math.abs(actual.asDouble() - numeric.path("value").asDouble());
                assertTrue(delta <= numeric.path("tolerance").asDouble(), id + " numeric mismatch at " + numeric.path("path").asText());
            }
        }
    }

    private static JsonNode path(JsonNode node, String dottedPath) {
        JsonNode current = node;
        for (String segment : dottedPath.split("\\.")) {
            current = current.isArray() ? current.path(Integer.parseInt(segment)) : current.path(segment);
        }
        return current.isMissingNode() ? null : current;
    }

    private static Path corpusPath() {
        Path fromBackend = Path.of("..", "tests", "math-engine-golden.json");
        if (Files.exists(fromBackend)) return fromBackend;
        return Path.of("tests", "math-engine-golden.json");
    }
}
