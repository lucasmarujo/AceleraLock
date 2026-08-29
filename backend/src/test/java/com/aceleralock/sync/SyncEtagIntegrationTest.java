package com.aceleralock.sync;

import com.aceleralock.AbstractIntegrationTest;
import com.aceleralock.account.Account;
import com.aceleralock.auth.AuthService;
import com.aceleralock.device.DevicePlatform;
import com.aceleralock.profile.BlockProfileController;
import com.aceleralock.time.TimeAuthority;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.http.HttpHeaders.AUTHORIZATION;
import static org.springframework.http.HttpHeaders.ETAG;
import static org.springframework.http.HttpHeaders.IF_NONE_MATCH;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class SyncEtagIntegrationTest extends AbstractIntegrationTest {

    private AuthService.DeviceSession session() {
        Account account = newAccount("sync-" + UUID.randomUUID());
        return authService.issueDeviceSession(
                newDevice(account, "install-" + UUID.randomUUID(), DevicePlatform.IOS));
    }

    @Test
    @DisplayName("feliz: If-None-Match casando devolve 304")
    void matchingEtagReturnsNotModified() throws Exception {
        AuthService.DeviceSession session = session();

        String etag = mockMvc.perform(get("/v1/devices/{id}/sync", session.deviceId())
                        .header(AUTHORIZATION, freshBearer(session)))
                .andExpect(status().isOk())
                .andExpect(header().exists(ETAG))
                .andReturn().getResponse().getHeader(ETAG);

        mockMvc.perform(get("/v1/devices/{id}/sync", session.deviceId())
                        .header(AUTHORIZATION, freshBearer(session))
                        .header(IF_NONE_MATCH, etag))
                .andExpect(status().isNotModified());
    }

    @Test
    @DisplayName("borda: resposta 304 ainda carrega server-time e clock-skew")
    void notModifiedStillCarriesTimeHeaders() throws Exception {
        AuthService.DeviceSession session = session();

        String etag = mockMvc.perform(get("/v1/devices/{id}/sync", session.deviceId())
                        .header(AUTHORIZATION, freshBearer(session)))
                .andReturn().getResponse().getHeader(ETAG);

        mockMvc.perform(get("/v1/devices/{id}/sync", session.deviceId())
                        .header(AUTHORIZATION, freshBearer(session))
                        .header(IF_NONE_MATCH, etag)
                        .header(TimeAuthority.DEVICE_TIME_HEADER, T0.plus(Duration.ofHours(2)).toString()))
                .andExpect(status().isNotModified())
                .andExpect(header().exists(TimeAuthority.SERVER_TIME_HEADER))
                .andExpect(header().string(TimeAuthority.CLOCK_SKEW_HEADER, "7200"));
    }

    @Test
    @DisplayName("feliz: escrita em perfil incrementa syncVersion e invalida o ETag")
    void writeBumpsSyncVersion() throws Exception {
        AuthService.DeviceSession session = session();

        String firstEtag = mockMvc.perform(get("/v1/devices/{id}/sync", session.deviceId())
                        .header(AUTHORIZATION, freshBearer(session)))
                .andReturn().getResponse().getHeader(ETAG);

        mockMvc.perform(post("/v1/profiles")
                        .header(AUTHORIZATION, freshBearer(session))
                        .contentType(APPLICATION_JSON)
                        .content(json(new BlockProfileController.ProfileRequest("Foco", true,
                                "America/Sao_Paulo", 30, List.of()))))
                .andExpect(status().isOk());

        String secondEtag = mockMvc.perform(get("/v1/devices/{id}/sync", session.deviceId())
                        .header(AUTHORIZATION, freshBearer(session))
                        .header(IF_NONE_MATCH, firstEtag))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.profiles.length()").value(1))
                .andReturn().getResponse().getHeader(ETAG);

        assertThat(secondEtag).isNotEqualTo(firstEtag);
    }

    @Test
    @DisplayName("feliz: sync expoe failsafeDays servido pelo servidor (J-S9)")
    void syncExposesFailsafeDays() throws Exception {
        AuthService.DeviceSession session = session();

        mockMvc.perform(get("/v1/devices/{id}/sync", session.deviceId())
                        .header(AUTHORIZATION, freshBearer(session)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.failsafeDays").value(7))
                .andExpect(jsonPath("$.serverTime").value(T0.toString()));
    }

    @Test
    @DisplayName("regressao: relogio do device adiantado nao altera o serverTime da resposta")
    void deviceClockDoesNotAffectServerTime() throws Exception {
        AuthService.DeviceSession session = session();

        mockMvc.perform(get("/v1/devices/{id}/sync", session.deviceId())
                        .header(AUTHORIZATION, freshBearer(session))
                        .header(TimeAuthority.DEVICE_TIME_HEADER, T0.plus(Duration.ofDays(30)).toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.serverTime").value(T0.toString()));
    }
}
