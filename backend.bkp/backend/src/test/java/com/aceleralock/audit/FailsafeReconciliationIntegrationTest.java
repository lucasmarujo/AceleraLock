package com.aceleralock.audit;

import com.aceleralock.AbstractIntegrationTest;
import com.aceleralock.account.Account;
import com.aceleralock.auth.AuthService;
import com.aceleralock.device.Device;
import com.aceleralock.device.DevicePlatform;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.time.Duration;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.http.HttpHeaders.AUTHORIZATION;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class FailsafeReconciliationIntegrationTest extends AbstractIntegrationTest {

    @Autowired
    private AuditEventRepository auditEventRepository;

    @Autowired
    private AuditService auditService;

    @Autowired
    private org.springframework.transaction.PlatformTransactionManager transactionManager;

    private record Scene(AuthService.DeviceSession session, Account account) {
    }

    private Scene scene() {
        Account account = newAccount("failsafe-" + UUID.randomUUID());
        Device device = newDevice(account, "install-" + UUID.randomUUID(), DevicePlatform.ANDROID);
        return new Scene(authService.issueDeviceSession(device), account);
    }

    private void report(Scene scene, AuditEventType type, UUID clientEventId) throws Exception {
        mockMvc.perform(post("/v1/devices/{id}/events", scene.session().deviceId())
                        .header(AUTHORIZATION, freshBearer(scene.session()))
                        .contentType(APPLICATION_JSON)
                        .content(json(new AuditController.IngestRequest(List.of(
                                new AuditController.EventSpec(clientEventId, type, T0, null))))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accepted").value(1));
    }

    @Test
    @DisplayName("feliz: failsafe reportado apos 7 dias reais de silencio e aceito como plausivel")
    void plausibleFailsafeIsAccepted() throws Exception {
        Scene scene = scene();

        clock.advance(Duration.ofDays(8));
        report(scene, AuditEventType.UNLOCK_GRANTED_OFFLINE_FAILSAFE, UUID.randomUUID());

        assertThat(auditEventRepository.findByAccountIdAndTypeOrderByReceivedAtDesc(
                scene.account().getId(), AuditEventType.UNLOCK_GRANTED_OFFLINE_FAILSAFE)).isNotEmpty();
        assertThat(auditEventRepository.findByAccountIdAndTypeOrderByReceivedAtDesc(
                scene.account().getId(), AuditEventType.PROTECTION_INTERRUPTED)).isEmpty();
    }

    @Test
    @DisplayName("regressao: failsafe alegado com gap menor que 7 dias vira PROTECTION_INTERRUPTED (J-S8)")
    void implausibleFailsafeIsFlagged() throws Exception {
        Scene scene = scene();

        clock.advance(Duration.ofDays(2));
        report(scene, AuditEventType.UNLOCK_GRANTED_OFFLINE_FAILSAFE, UUID.randomUUID());

        List<AuditEvent> interrupted = auditEventRepository.findByAccountIdAndTypeOrderByReceivedAtDesc(
                scene.account().getId(), AuditEventType.PROTECTION_INTERRUPTED);
        assertThat(interrupted).isNotEmpty();
        assertThat(interrupted.get(0).getDetails()).contains("failsafe_gap_implausible");
        assertThat(interrupted.get(0).getSource()).isEqualTo(AuditEventSource.SERVER);
    }

    @Test
    @DisplayName("regressao: evidencia de adulteracao sobrevive ao rollback da transacao externa")
    void tamperEvidenceSurvivesOuterRollback() {
        Scene scene = scene();
        org.springframework.transaction.support.TransactionTemplate template =
                new org.springframework.transaction.support.TransactionTemplate(transactionManager);

        template.executeWithoutResult(status -> {
            auditService.recordTamperEvidence(scene.account().getId(), scene.session().deviceId(),
                    AuditEventType.PROTECTION_INTERRUPTED, "{\"reason\":\"failsafe_gap_implausible\"}");
            status.setRollbackOnly();
        });

        assertThat(auditEventRepository.findByAccountIdAndTypeOrderByReceivedAtDesc(
                scene.account().getId(), AuditEventType.PROTECTION_INTERRUPTED)).isNotEmpty();
    }

    @Test
    @DisplayName("controle: evento comum nao sobrevive ao rollback, provando que o teste acima mede algo")
    void ordinaryEventDoesNotSurviveOuterRollback() {
        Scene scene = scene();
        org.springframework.transaction.support.TransactionTemplate template =
                new org.springframework.transaction.support.TransactionTemplate(transactionManager);

        template.executeWithoutResult(status -> {
            auditService.recordServerEvent(
                    accountRepository.findById(scene.account().getId()).orElseThrow(),
                    null, AuditEventType.BYPASS_ATTEMPT, null);
            status.setRollbackOnly();
        });

        assertThat(auditEventRepository.findByAccountIdAndTypeOrderByReceivedAtDesc(
                scene.account().getId(), AuditEventType.BYPASS_ATTEMPT)).isEmpty();
    }

    @Test
    @DisplayName("regressao: received_at do servidor prevalece sobre occurredAt absurdo do device")
    void serverReceivedAtWinsOverDeviceClaim() throws Exception {
        Scene scene = scene();
        UUID clientEventId = UUID.randomUUID();

        mockMvc.perform(post("/v1/devices/{id}/events", scene.session().deviceId())
                        .header(AUTHORIZATION, freshBearer(scene.session()))
                        .contentType(APPLICATION_JSON)
                        .content(json(new AuditController.IngestRequest(List.of(
                                new AuditController.EventSpec(clientEventId, AuditEventType.BYPASS_ATTEMPT,
                                        T0.plus(Duration.ofDays(3650)), null))))))
                .andExpect(status().isOk());

        AuditEvent stored = auditEventRepository.findByAccountIdAndTypeOrderByReceivedAtDesc(
                scene.account().getId(), AuditEventType.BYPASS_ATTEMPT).get(0);

        assertThat(stored.getReceivedAt()).isEqualTo(T0);
        assertThat(stored.getOccurredAt()).isEqualTo(T0.plus(Duration.ofDays(3650)));
    }

    @Test
    @DisplayName("borda: clientEventId repetido conta como duplicado, nao erro")
    void repeatedClientEventIdIsDuplicateNotError() throws Exception {
        Scene scene = scene();
        UUID clientEventId = UUID.randomUUID();

        report(scene, AuditEventType.SHIELD_APPLIED, clientEventId);

        mockMvc.perform(post("/v1/devices/{id}/events", scene.session().deviceId())
                        .header(AUTHORIZATION, freshBearer(scene.session()))
                        .contentType(APPLICATION_JSON)
                        .content(json(new AuditController.IngestRequest(List.of(
                                new AuditController.EventSpec(clientEventId, AuditEventType.SHIELD_APPLIED,
                                        T0, null))))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accepted").value(0))
                .andExpect(jsonPath("$.duplicates").value(1));
    }
}
