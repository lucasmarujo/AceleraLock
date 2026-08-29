package com.aceleralock.device;

import com.aceleralock.AbstractIntegrationTest;
import com.aceleralock.account.Account;
import com.aceleralock.auth.AuthService;
import com.aceleralock.push.PushProvider;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.http.HttpHeaders.AUTHORIZATION;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class PushTokenPersistenceTest extends AbstractIntegrationTest {

    @Test
    @DisplayName("regressao: PUT de push-token realmente persiste no banco")
    void pushTokenIsPersisted() throws Exception {
        Account account = newAccount("pushtok-" + UUID.randomUUID());
        AuthService.DeviceSession session = authService.issueDeviceSession(
                newDevice(account, "install-" + UUID.randomUUID(), DevicePlatform.ANDROID));

        mockMvc.perform(put("/v1/devices/{id}/push-token", session.deviceId())
                        .header(AUTHORIZATION, freshBearer(session))
                        .contentType(APPLICATION_JSON)
                        .content(json(new DeviceController.PushTokenRequest("tok-123", PushProvider.FCM))))
                .andExpect(status().isNoContent());

        assertThat(deviceRepository.findById(session.deviceId()).orElseThrow().getPushToken())
                .isEqualTo("tok-123");
    }

    @Test
    @DisplayName("regressao: last_seen_at e realmente atualizado a cada requisicao autenticada")
    void lastSeenAtIsPersisted() throws Exception {
        Account account = newAccount("lastseen-" + UUID.randomUUID());
        AuthService.DeviceSession session = authService.issueDeviceSession(
                newDevice(account, "install-" + UUID.randomUUID(), DevicePlatform.IOS));

        clock.advance(java.time.Duration.ofHours(5));

        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .get("/v1/devices/{id}/sync", session.deviceId())
                        .header(AUTHORIZATION, freshBearer(session)))
                .andExpect(status().isOk());

        assertThat(deviceRepository.findById(session.deviceId()).orElseThrow().getLastSeenAt())
                .isEqualTo(T0.plus(java.time.Duration.ofHours(5)));
    }
}
