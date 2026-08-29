package com.aceleralock.device;

import com.aceleralock.AbstractIntegrationTest;
import com.aceleralock.account.Account;
import com.aceleralock.auth.AuthService;
import com.aceleralock.profile.BlockProfileController;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.http.HttpHeaders.AUTHORIZATION;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class DeviceProfileTargetIntegrationTest extends AbstractIntegrationTest {

    private record Fixture(AuthService.DeviceSession sessionA, AuthService.DeviceSession sessionB,
                           UUID targetA, UUID targetB, UUID profileId) {
    }

    private Fixture setUpTwoDevicesSharingOneProfile() throws Exception {
        Account account = newAccount("owner-multi-" + UUID.randomUUID());
        Device deviceA = newDevice(account, "install-A-" + UUID.randomUUID(), DevicePlatform.IOS);
        Device deviceB = newDevice(account, "install-B-" + UUID.randomUUID(), DevicePlatform.ANDROID);
        AuthService.DeviceSession sessionA = authService.issueDeviceSession(deviceA);
        AuthService.DeviceSession sessionB = authService.issueDeviceSession(deviceB);

        UUID targetA = registerTarget(sessionA, "ref-A");
        UUID targetB = registerTarget(sessionB, "ref-B");
        UUID profileId = createProfile(sessionA);

        attachTargets(sessionA, profileId, List.of(targetA));
        attachTargets(sessionB, profileId, List.of(targetB));
        return new Fixture(sessionA, sessionB, targetA, targetB, profileId);
    }

    private UUID registerTarget(AuthService.DeviceSession session, String clientRef) throws Exception {
        String body = mockMvc.perform(post("/v1/devices/{id}/targets", session.deviceId())
                        .header(AUTHORIZATION, bearer(session.accessToken()))
                        .contentType(APPLICATION_JSON)
                        .content(json(new BlockTargetController.RegisterTargetsRequest(
                                List.of(new BlockTargetController.TargetSpec(clientRef, "Instagram"))))))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return UUID.fromString(objectMapper.readTree(body).get("targets").get(0).get("targetId").asString());
    }

    private UUID createProfile(AuthService.DeviceSession session) throws Exception {
        String body = mockMvc.perform(post("/v1/profiles")
                        .header(AUTHORIZATION, bearer(session.accessToken()))
                        .contentType(APPLICATION_JSON)
                        .content(json(new BlockProfileController.ProfileRequest("Foco", true,
                                "America/Sao_Paulo", 30, List.of()))))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return UUID.fromString(objectMapper.readTree(body).get("profileId").asString());
    }

    private void attachTargets(AuthService.DeviceSession session, UUID profileId, List<UUID> targetIds)
            throws Exception {
        mockMvc.perform(put("/v1/devices/{d}/profiles/{p}/targets", session.deviceId(), profileId)
                        .header(AUTHORIZATION, bearer(session.accessToken()))
                        .contentType(APPLICATION_JSON)
                        .content(json(new BlockProfileController.DeviceTargetsRequest(targetIds))))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("regressao: sync do device B nao devolve targetId do device A")
    void syncOfDeviceBNeverExposesTargetsOfDeviceA() throws Exception {
        Fixture fixture = setUpTwoDevicesSharingOneProfile();

        String body = mockMvc.perform(get("/v1/devices/{id}/sync", fixture.sessionB().deviceId())
                        .header(AUTHORIZATION, bearer(fixture.sessionB().accessToken())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.profiles", hasSize(1)))
                .andReturn().getResponse().getContentAsString();

        assertThat(body).contains(fixture.targetB().toString());
        assertThat(body).doesNotContain(fixture.targetA().toString());
    }

    @Test
    @DisplayName("regressao: PUT de alvos no device A nao apaga os alvos do device B no mesmo perfil")
    void replacingTargetsOnDeviceADoesNotWipeDeviceB() throws Exception {
        Fixture fixture = setUpTwoDevicesSharingOneProfile();

        attachTargets(fixture.sessionA(), fixture.profileId(), List.of());

        mockMvc.perform(get("/v1/devices/{id}/sync", fixture.sessionB().deviceId())
                        .header(AUTHORIZATION, bearer(fixture.sessionB().accessToken())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.profiles[0].targetIds", hasSize(1)))
                .andExpect(jsonPath("$.profiles[0].targetIds[0]").value(fixture.targetB().toString()));

        mockMvc.perform(get("/v1/devices/{id}/sync", fixture.sessionA().deviceId())
                        .header(AUTHORIZATION, bearer(fixture.sessionA().accessToken())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.profiles[0].targetIds", hasSize(0)));
    }

    @Test
    @DisplayName("erro: associar alvo de outro device ao perfil responde 404")
    void attachingForeignTargetIsNotFound() throws Exception {
        Fixture fixture = setUpTwoDevicesSharingOneProfile();

        mockMvc.perform(put("/v1/devices/{d}/profiles/{p}/targets",
                        fixture.sessionA().deviceId(), fixture.profileId())
                        .header(AUTHORIZATION, bearer(fixture.sessionA().accessToken()))
                        .contentType(APPLICATION_JSON)
                        .content(json(new BlockProfileController.DeviceTargetsRequest(
                                List.of(fixture.targetB())))))
                .andExpect(status().isNotFound());
    }
}
