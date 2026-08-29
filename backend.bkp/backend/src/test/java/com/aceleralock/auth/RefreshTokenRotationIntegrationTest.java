package com.aceleralock.auth;

import com.aceleralock.AbstractIntegrationTest;
import com.aceleralock.account.Account;
import com.aceleralock.audit.AuditEventRepository;
import com.aceleralock.audit.AuditEventType;
import com.aceleralock.device.Device;
import com.aceleralock.device.DevicePlatform;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.time.Duration;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class RefreshTokenRotationIntegrationTest extends AbstractIntegrationTest {

    @Autowired
    private RefreshTokenService refreshTokenService;

    @Autowired
    private AuditEventRepository auditEventRepository;

    private Device device;

    private AuthService.DeviceSession firstSession() {
        Account account = newAccount("refresh-" + UUID.randomUUID());
        device = newDevice(account, "install-" + UUID.randomUUID(), DevicePlatform.IOS);
        return authService.issueDeviceSession(device);
    }

    @Test
    @DisplayName("feliz: rotacao emite um par novo e invalida o anterior")
    void rotationIssuesNewPair() {
        AuthService.DeviceSession first = firstSession();

        AuthService.DeviceSession second = authService.refresh(first.refreshToken());

        assertThat(second.refreshToken()).isNotEqualTo(first.refreshToken());
        assertThat(second.deviceId()).isEqualTo(first.deviceId());
    }

    @Test
    @DisplayName("borda: retry dentro de 30s com sucessor nao usado nao desloga (rede instavel)")
    void retryWithinGraceKeepsSession() {
        AuthService.DeviceSession first = firstSession();
        AuthService.DeviceSession lostToNetwork = authService.refresh(first.refreshToken());

        clock.advance(Duration.ofSeconds(10));
        AuthService.DeviceSession retried = authService.refresh(first.refreshToken());

        assertThat(retried.refreshToken())
                .isNotEqualTo(first.refreshToken())
                .isNotEqualTo(lostToNetwork.refreshToken());
        assertThat(authService.refresh(retried.refreshToken())).isNotNull();
    }

    @Test
    @DisplayName("regressao: reuso apos o sucessor ter sido usado revoga a familia inteira")
    void reuseAfterSuccessorConsumedRevokesFamily() {
        AuthService.DeviceSession first = firstSession();
        AuthService.DeviceSession second = authService.refresh(first.refreshToken());
        AuthService.DeviceSession third = authService.refresh(second.refreshToken());

        assertThatThrownBy(() -> authService.refresh(first.refreshToken()))
                .hasMessageContaining("reuso");

        assertThatThrownBy(() -> authService.refresh(third.refreshToken()))
                .isInstanceOf(Exception.class);
        assertThat(auditEventRepository.findByAccountIdAndTypeOrderByReceivedAtDesc(
                device.getAccount().getId(), AuditEventType.REFRESH_REUSE_DETECTED)).isNotEmpty();
    }

    @Test
    @DisplayName("regressao: reuso fora da janela de 30s revoga a familia")
    void reuseOutsideGraceRevokesFamily() {
        AuthService.DeviceSession first = firstSession();
        authService.refresh(first.refreshToken());

        clock.advance(Duration.ofSeconds(31));

        assertThatThrownBy(() -> authService.refresh(first.refreshToken()))
                .hasMessageContaining("reuso");
    }

    @Test
    @DisplayName("erro: refresh token expirado e recusado")
    void expiredRefreshTokenIsRejected() {
        AuthService.DeviceSession first = firstSession();

        clock.advance(Duration.ofDays(61));

        assertThatThrownBy(() -> authService.refresh(first.refreshToken()))
                .hasMessageContaining("invalido");
    }

    @Test
    @DisplayName("regressao: revogar o device invalida o refresh token")
    void revokingDeviceInvalidatesRefresh() {
        AuthService.DeviceSession first = firstSession();

        refreshTokenService.revokeDevice(device);

        assertThatThrownBy(() -> authService.refresh(first.refreshToken()))
                .hasMessageContaining("invalido");
    }
}
