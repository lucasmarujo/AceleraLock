package com.aceleralock.profile;

import com.aceleralock.AbstractIntegrationTest;
import com.aceleralock.account.Account;
import com.aceleralock.auth.AuthService;
import com.aceleralock.device.BlockTargetController;
import com.aceleralock.device.DevicePlatform;
import com.aceleralock.unlock.UnlockRequestController;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.util.List;
import java.util.UUID;

import static org.springframework.http.HttpHeaders.AUTHORIZATION;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class CooldownLockIntegrationTest extends AbstractIntegrationTest {

    private AuthService.DeviceSession session;
    private UUID targetId;
    private UUID profileId;

    private void setUpProfileWithTarget(int cooldownMinutes) throws Exception {
        Account account = newAccount("cooldown-" + UUID.randomUUID());
        session = authService.issueDeviceSession(
                newDevice(account, "install-" + UUID.randomUUID(), DevicePlatform.IOS));

        String targetBody = mockMvc.perform(post("/v1/devices/{id}/targets", session.deviceId())
                        .header(AUTHORIZATION, freshBearer(session))
                        .contentType(APPLICATION_JSON)
                        .content(json(new BlockTargetController.RegisterTargetsRequest(
                                List.of(new BlockTargetController.TargetSpec("ref", "Instagram"))))))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        targetId = UUID.fromString(objectMapper.readTree(targetBody).get("targets").get(0).get("targetId").asString());

        String profileBody = mockMvc.perform(post("/v1/profiles")
                        .header(AUTHORIZATION, freshBearer(session))
                        .contentType(APPLICATION_JSON)
                        .content(json(new BlockProfileController.ProfileRequest("Foco", true,
                                "America/Sao_Paulo", cooldownMinutes, List.of()))))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        profileId = UUID.fromString(objectMapper.readTree(profileBody).get("profileId").asString());

        mockMvc.perform(put("/v1/devices/{d}/profiles/{p}/targets", session.deviceId(), profileId)
                        .header(AUTHORIZATION, freshBearer(session))
                        .contentType(APPLICATION_JSON)
                        .content(json(new BlockProfileController.DeviceTargetsRequest(List.of(targetId)))))
                .andExpect(status().isOk());
    }

    private void changeCooldown(int minutes) throws Exception {
        mockMvc.perform(put("/v1/profiles/{id}", profileId)
                        .header(AUTHORIZATION, freshBearer(session))
                        .contentType(APPLICATION_JSON)
                        .content(json(new BlockProfileController.ProfileRequest("Foco", true,
                                "America/Sao_Paulo", minutes, List.of()))))
                .andExpect(status().isOk());
    }

    private String requestUnlockAndReadCooldownEnd() throws Exception {
        String body = mockMvc.perform(post("/v1/devices/{id}/unlock-requests", session.deviceId())
                        .header(AUTHORIZATION, freshBearer(session))
                        .contentType(APPLICATION_JSON)
                        .content(json(new UnlockRequestController.CreateUnlockRequest(targetId, null))))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(body).get("cooldownEndsAt").asString();
    }

    @Test
    @DisplayName("regressao: reducao de cooldown nao vale para pedido novo antes de decorrido o vigente")
    void decreasedCooldownDoesNotApplyToNewRequestBeforeCurrentElapses() throws Exception {
        setUpProfileWithTarget(60);

        changeCooldown(1);

        String cooldownEndsAt = requestUnlockAndReadCooldownEnd();
        assertThatCooldownIs(cooldownEndsAt, Duration.ofMinutes(60));
    }

    @Test
    @DisplayName("feliz: reducao passa a valer depois de decorrido o cooldown vigente")
    void decreasedCooldownAppliesAfterCurrentElapses() throws Exception {
        setUpProfileWithTarget(60);
        changeCooldown(1);

        clock.advance(Duration.ofMinutes(60));

        String cooldownEndsAt = requestUnlockAndReadCooldownEnd();
        assertThatCooldownIs(cooldownEndsAt, Duration.ofMinutes(1));
    }

    @Test
    @DisplayName("feliz: aumento de cooldown vale imediatamente (assimetria)")
    void increasedCooldownAppliesImmediately() throws Exception {
        setUpProfileWithTarget(30);

        changeCooldown(120);

        String cooldownEndsAt = requestUnlockAndReadCooldownEnd();
        assertThatCooldownIs(cooldownEndsAt, Duration.ofMinutes(120));
    }

    @Test
    @DisplayName("feliz: perfil expoe vigente, pendente e a partir de quando")
    void profileExposesAllThreeCooldownValues() throws Exception {
        setUpProfileWithTarget(60);
        changeCooldown(5);

        mockMvc.perform(get("/v1/profiles").header(AUTHORIZATION, freshBearer(session)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].cooldownMinutes").value(60))
                .andExpect(jsonPath("$[0].pendingCooldownMinutes").value(5))
                .andExpect(jsonPath("$[0].cooldownEffectiveAt")
                        .value(T0.plus(Duration.ofMinutes(60)).toString()));
    }

    @Test
    @DisplayName("regressao: cooldown do pedido em andamento nao encurta quando o perfil muda")
    void inFlightRequestKeepsItsFrozenCooldown() throws Exception {
        setUpProfileWithTarget(60);
        String beforeChange = requestUnlockAndReadCooldownEnd();

        changeCooldown(1);
        clock.advance(Duration.ofMinutes(70));

        mockMvc.perform(get("/v1/devices/{id}/sync", session.deviceId())
                        .header(AUTHORIZATION, freshBearer(session)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pendingUnlockRequests[0].cooldownEndsAt").value(beforeChange));
    }

    private void assertThatCooldownIs(String cooldownEndsAt, Duration expected) {
        org.assertj.core.api.Assertions.assertThat(java.time.Instant.parse(cooldownEndsAt))
                .isEqualTo(clock.instant().plus(expected));
    }

    @Test
    @DisplayName("validacao: cooldown negativo e recusado com 400")
    void negativeCooldownIsRejected() throws Exception {
        setUpProfileWithTarget(30);

        mockMvc.perform(put("/v1/profiles/{id}", profileId)
                        .header(AUTHORIZATION, freshBearer(session))
                        .contentType(APPLICATION_JSON)
                        .content(json(new BlockProfileController.ProfileRequest("Foco", true,
                                "America/Sao_Paulo", -5, List.of()))))
                .andExpect(status().isBadRequest());
    }
}
