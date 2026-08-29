package com.aceleralock.auth;

import com.aceleralock.AbstractIntegrationTest;
import com.aceleralock.account.Account;
import com.aceleralock.device.Device;
import com.aceleralock.device.DeviceController;
import com.aceleralock.device.DevicePlatform;
import com.aceleralock.time.TimeAuthority;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.springframework.http.HttpHeaders.AUTHORIZATION;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class TokenScopeIntegrationTest extends AbstractIntegrationTest {

    @Test
    @DisplayName("feliz: primeiro login devolve bootstrap sem did e sem refresh token")
    void firstLoginReturnsBootstrapOnly() throws Exception {
        newAccount("bootstrap-" + UUID.randomUUID());

        mockMvc.perform(post("/v1/auth/sessions")
                        .contentType(APPLICATION_JSON)
                        .content(json(new AuthController.CreateSessionRequest(IdentityProvider.APPLE, "id-token"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.bootstrapToken").exists())
                .andExpect(jsonPath("$.accountId").exists())
                .andExpect(jsonPath("$.refreshToken").doesNotExist())
                .andExpect(jsonPath("$.accessToken").doesNotExist());
    }

    @Test
    @DisplayName("regressao: token bootstrap nao alcanca rota de device")
    void bootstrapTokenCannotReachDeviceRoutes() throws Exception {
        Account account = newAccount("scope-a-" + UUID.randomUUID());
        Device device = newDevice(account, "install-" + UUID.randomUUID(), DevicePlatform.IOS);
        AuthService.BootstrapSession bootstrap = authService.startSession(IdentityProvider.APPLE, "id-token");

        mockMvc.perform(get("/v1/devices/{id}/sync", device.getId())
                        .header(AUTHORIZATION, bearer(bootstrap.bootstrapToken())))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/v1/profiles").header(AUTHORIZATION, bearer(bootstrap.bootstrapToken())))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("regressao: token de sessao nao serve para registrar device")
    void sessionTokenCannotRegisterDevice() throws Exception {
        Account account = newAccount("scope-b-" + UUID.randomUUID());
        Device device = newDevice(account, "install-" + UUID.randomUUID(), DevicePlatform.IOS);
        AuthService.DeviceSession session = authService.issueDeviceSession(device);

        mockMvc.perform(post("/v1/devices")
                        .header(AUTHORIZATION, bearer(session.accessToken()))
                        .contentType(APPLICATION_JSON)
                        .content(json(new DeviceController.RegisterDeviceRequest("outro-install",
                                DevicePlatform.ANDROID, "Pixel", "America/Sao_Paulo", "1.0.0", "15"))))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("erro: sem token nenhuma rota responde, e a resposta negada ainda leva o header de tempo do servidor")
    void anonymousIsRejectedEverywhere() throws Exception {
        mockMvc.perform(get("/v1/profiles")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/v1/partners")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/v1/time"))
                .andExpect(status().isUnauthorized())
                .andExpect(header().exists(TimeAuthority.SERVER_TIME_HEADER));
    }

    @Test
    @DisplayName("erro: device de outra conta responde 404, nunca 403")
    void foreignDeviceIsNotFound() throws Exception {
        Account owner = newAccount("owner-" + UUID.randomUUID());
        Device ownerDevice = newDevice(owner, "install-owner-" + UUID.randomUUID(), DevicePlatform.IOS);

        Account intruder = newAccount("intruder-" + UUID.randomUUID());
        Device intruderDevice = newDevice(intruder, "install-intruder-" + UUID.randomUUID(), DevicePlatform.IOS);
        AuthService.DeviceSession intruderSession = authService.issueDeviceSession(intruderDevice);

        mockMvc.perform(get("/v1/devices/{id}/sync", ownerDevice.getId())
                        .header(AUTHORIZATION, bearer(intruderSession.accessToken())))
                .andExpect(status().isNotFound());
    }
}
