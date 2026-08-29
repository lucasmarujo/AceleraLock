package com.aceleralock.push;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class PushDispatcherPayloadTest {

    @Test
    @DisplayName("regressao: payload de push carrega apenas type e unlockRequestId")
    void payloadCarriesNoDecisionAndNoDeadline() {
        UUID requestId = UUID.randomUUID();

        Map<String, String> payload = PushDispatcher.buildPayload(
                PushNotificationType.UNLOCK_APPROVED, requestId);

        assertThat(payload).containsOnlyKeys("type", "unlockRequestId");
        assertThat(payload.get("type")).isEqualTo("UNLOCK_APPROVED");
        assertThat(payload.get("unlockRequestId")).isEqualTo(requestId.toString());
    }

    @Test
    @DisplayName("borda: notificacao sem pedido associado omite o identificador")
    void payloadWithoutRequestOmitsIdentifier() {
        Map<String, String> payload = PushDispatcher.buildPayload(
                PushNotificationType.PARTNER_INVITE_ACCEPTED, null);

        assertThat(payload).containsOnlyKeys("type");
    }

    @Test
    @DisplayName("regressao: nenhum tipo de push expone prazo, decisao ou rotulo de app")
    void noPushTypeLeaksDeadlineOrLabel() {
        for (PushNotificationType type : PushNotificationType.values()) {
            Map<String, String> payload = PushDispatcher.buildPayload(type, UUID.randomUUID());
            assertThat(payload.keySet())
                    .as("payload de %s", type)
                    .containsExactlyInAnyOrder("type", "unlockRequestId");
        }
    }
}
