package com.aceleralock.device;

import com.aceleralock.AbstractIntegrationTest;
import com.aceleralock.account.Account;
import com.aceleralock.auth.AuthService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.http.HttpHeaders.AUTHORIZATION;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class OpaqueTargetContractTest extends AbstractIntegrationTest {

    private AuthService.DeviceSession session() {
        Account account = newAccount("opaque-" + UUID.randomUUID());
        return authService.issueDeviceSession(
                newDevice(account, "install-" + UUID.randomUUID(), DevicePlatform.IOS));
    }

    @Test
    @DisplayName("regressao: payload com bundleId e recusado com 400")
    void bundleIdIsRejected() throws Exception {
        AuthService.DeviceSession session = session();

        mockMvc.perform(post("/v1/devices/{id}/targets", session.deviceId())
                        .header(AUTHORIZATION, bearer(session.accessToken()))
                        .contentType(APPLICATION_JSON)
                        .content("{\"targets\":[{\"clientRef\":\"a1\",\"label\":\"Instagram\","
                                + "\"bundleId\":\"com.burbn.instagram\"}]}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("regressao: payload com packageName e recusado com 400")
    void packageNameIsRejected() throws Exception {
        AuthService.DeviceSession session = session();

        mockMvc.perform(post("/v1/devices/{id}/targets", session.deviceId())
                        .header(AUTHORIZATION, bearer(session.accessToken()))
                        .contentType(APPLICATION_JSON)
                        .content("{\"targets\":[{\"clientRef\":\"a1\",\"label\":\"Instagram\","
                                + "\"packageName\":\"com.instagram.android\"}]}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("regressao: nenhuma resposta da API contem bundleId ou packageName")
    void noResponseEverLeaksAppIdentity() throws Exception {
        AuthService.DeviceSession session = session();

        String registerBody = mockMvc.perform(post("/v1/devices/{id}/targets", session.deviceId())
                        .header(AUTHORIZATION, bearer(session.accessToken()))
                        .contentType(APPLICATION_JSON)
                        .content(json(new BlockTargetController.RegisterTargetsRequest(
                                List.of(new BlockTargetController.TargetSpec("ref-1", "Instagram"))))))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        String syncBody = mockMvc.perform(get("/v1/devices/{id}/sync", session.deviceId())
                        .header(AUTHORIZATION, bearer(session.accessToken())))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        assertThat(registerBody).doesNotContain("bundleId").doesNotContain("packageName");
        assertThat(syncBody).doesNotContain("bundleId").doesNotContain("packageName");
    }

    @Test
    @DisplayName("borda: mesmo clientRef duas vezes e idempotente")
    void sameClientRefIsIdempotent() throws Exception {
        AuthService.DeviceSession session = session();
        String payload = json(new BlockTargetController.RegisterTargetsRequest(
                List.of(new BlockTargetController.TargetSpec("ref-dup", "Instagram"))));

        String first = mockMvc.perform(post("/v1/devices/{id}/targets", session.deviceId())
                        .header(AUTHORIZATION, bearer(session.accessToken()))
                        .contentType(APPLICATION_JSON).content(payload))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        String second = mockMvc.perform(post("/v1/devices/{id}/targets", session.deviceId())
                        .header(AUTHORIZATION, bearer(session.accessToken()))
                        .contentType(APPLICATION_JSON).content(payload))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();

        String firstId = objectMapper.readTree(first).get("targets").get(0).get("targetId").asString();
        String secondId = objectMapper.readTree(second).get("targets").get(0).get("targetId").asString();
        assertThat(secondId).isEqualTo(firstId);

        mockMvc.perform(get("/v1/devices/{id}/sync", session.deviceId())
                        .header(AUTHORIZATION, bearer(session.accessToken())))
                .andExpect(jsonPath("$.targets.length()").value(1));
    }
}
