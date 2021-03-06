package com.marklogic.hub.central.controllers.steps;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.access.AccessDeniedException;

import javax.ws.rs.core.MediaType;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

public class MappingStepControllerTest extends AbstractStepControllerTest {

    private final static String PATH = "/api/steps/mapping";

    public static class MappingStep {
        public String name;
        public String description;
        public String selectedSource;
        public String sourceQuery;
        public String targetEntityType;
    }

    public static MappingStep newDefaultMappingStep(String name) {
        MappingStep step = new MappingStep();
        step.name = name;
        step.description = "optional";
        step.selectedSource = "collection";
        step.sourceQuery = "cts.collectionQuery('test')";
        step.targetEntityType = "http://example.org/Customer-0.0.1/Customer";
        return step;
    }

    @Test
    void test() throws Exception {
        installOnlyReferenceModelEntities();
        loginAsTestUserWithRoles("hub-central-mapping-writer");
        verifyCommonStepEndpoints(PATH, objectMapper.valueToTree(newDefaultMappingStep("myMapper")), "entity-services-mapping", "mapping");
    }

    @Test
    void getMappingStepsByEntity() throws Exception {
        installOnlyReferenceModelEntities();
        loginAsTestUserWithRoles("hub-central-mapping-writer");

        postJson(PATH + "/firstStep", newDefaultMappingStep("firstStep")).andExpect(status().isOk());
        postJson(PATH + "/secondStep", newDefaultMappingStep("secondStep")).andExpect(status().isOk());

        getJson(PATH).andExpect(status().isOk())
            .andDo(result -> {
                ArrayNode array = (ArrayNode) parseJsonResponse(result);
                assertEquals(2, array.size(), "Should have an entry for Customer and an entry for Order");
                if (array.get(0).get("entityType").asText().equals("Order")) {
                    verifyOrderMappings(array.get(0));
                    verifyCustomerMappings(array.get(1));
                } else {
                    verifyOrderMappings(array.get(1));
                    verifyCustomerMappings(array.get(0));
                }
            });
    }

    @Test
    void permittedReadUser() throws Exception {
        loginAsTestUserWithRoles("hub-central-mapping-reader");

        getJson(PATH)
            .andDo(result -> {
                MockHttpServletResponse response = result.getResponse();
                assertEquals(MediaType.APPLICATION_JSON, response.getContentType());
                assertEquals(HttpStatus.OK.value(), response.getStatus());
            });
        getJson("/api/artifacts/mapping/functions")
            .andDo(result -> {
                MockHttpServletResponse response = result.getResponse();
                assertEquals(MediaType.APPLICATION_JSON, response.getContentType());
                assertEquals(HttpStatus.OK.value(), response.getStatus());
                JsonNode functionsJson = parseJsonResponse(result);
                assertTrue(functionsJson.has("parseDateTime"), "List of functions should contain parseDateTime");
            });
    }

    @Test
    void forbiddenReadUser() throws Exception {
        loginAsTestUserWithRoles("hub-central-user");
        mockMvc.perform(get(PATH).session(mockHttpSession))
            .andDo(result -> {
                assertTrue(result.getResolvedException() instanceof AccessDeniedException);
            });
    }

    @Test
    void forbiddenWriteUser() throws Exception {
        loginAsTestUserWithRoles("hub-central-mapping-reader");
        mockMvc.perform(post(PATH + "/{artifactName}", "TestCustomerMapping")
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.valueToTree(MappingStepControllerTest.newDefaultMappingStep("TestCustomerMapping")).toString())
            .session(mockHttpSession))
            .andDo(result -> {
                assertTrue(result.getResolvedException() instanceof AccessDeniedException);
            });
    }

    private void verifyOrderMappings(JsonNode node) {
        assertEquals("Order", node.get("entityType").asText());
        assertEquals("http://marklogic.com/example/Order-0.0.1/Order", node.get("entityTypeId").asText());
        assertEquals(0, node.get("artifacts").size());
    }

    private void verifyCustomerMappings(JsonNode node) {
        assertEquals("Customer", node.get("entityType").asText());
        assertEquals("http://example.org/Customer-0.0.1/Customer", node.get("entityTypeId").asText());
        assertEquals(2, node.get("artifacts").size(), "Expecting the 2 mappings created by this test");
    }
}
