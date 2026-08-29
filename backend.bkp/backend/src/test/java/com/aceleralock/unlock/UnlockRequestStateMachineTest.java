package com.aceleralock.unlock;

import com.aceleralock.account.Account;
import com.aceleralock.auth.IdentityProvider;
import com.aceleralock.common.ConflictException;
import com.aceleralock.device.BlockTarget;
import com.aceleralock.device.Device;
import com.aceleralock.device.DevicePlatform;
import com.aceleralock.partner.PartnerLink;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class UnlockRequestStateMachineTest {

    private static final Instant T0 = Instant.parse("2026-08-28T12:00:00Z");
    private static final Duration COOLDOWN = Duration.ofMinutes(30);
    private static final Duration UNILATERAL = Duration.ofHours(48);
    private static final Duration GRANT = Duration.ofMinutes(15);

    private final Account owner = new Account(IdentityProvider.APPLE, "sub-owner", null, T0);
    private final Account partner = new Account(IdentityProvider.GOOGLE, "sub-partner", null, T0);

    private UnlockRequest newRequest() {
        Device device = new Device(owner, "install-1", DevicePlatform.IOS, "iPhone", "America/Sao_Paulo",
                "1.0.0", "18.0", T0);
        BlockTarget target = new BlockTarget(device, "ref-1", "Instagram", T0);
        return new UnlockRequest(owner, device, target, null, "foco", T0, COOLDOWN, UNILATERAL);
    }

    @Test
    @DisplayName("feliz: aprovado e com cooldown decorrido vira GRANTED")
    void approvedAfterCooldownIsGranted() {
        UnlockRequest request = newRequest();
        request.approve(partner, T0.plusSeconds(60));

        assertThat(request.evaluate(T0.plus(COOLDOWN), GRANT)).isTrue();
        assertThat(request.getStatus()).isEqualTo(UnlockRequestStatus.GRANTED);
        assertThat(request.isGrantedUnilaterally()).isFalse();
        assertThat(request.getGrantEndsAt()).isEqualTo(T0.plus(COOLDOWN).plus(GRANT));
    }

    @Test
    @DisplayName("borda: aprovacao antes do cooldown mantem PENDING")
    void approvalBeforeCooldownStaysPending() {
        UnlockRequest request = newRequest();
        request.approve(partner, T0.plusSeconds(60));

        assertThat(request.evaluate(T0.plus(Duration.ofMinutes(29)), GRANT)).isFalse();
        assertThat(request.getStatus()).isEqualTo(UnlockRequestStatus.PENDING);
        assertThat(request.getApprovedAt()).isEqualTo(T0.plusSeconds(60));
    }

    @Test
    @DisplayName("regressao: cooldown decorrido sem aprovacao nao concede")
    void cooldownWithoutApprovalDoesNotGrant() {
        UnlockRequest request = newRequest();

        assertThat(request.evaluate(T0.plus(COOLDOWN).plusSeconds(1), GRANT)).isFalse();
        assertThat(request.getStatus()).isEqualTo(UnlockRequestStatus.PENDING);
    }

    @Test
    @DisplayName("valvula: 48h sem resposta concede unilateralmente")
    void unilateralGrantAfterFortyEightHours() {
        UnlockRequest request = newRequest();

        assertThat(request.evaluate(T0.plus(UNILATERAL), GRANT)).isTrue();
        assertThat(request.getStatus()).isEqualTo(UnlockRequestStatus.GRANTED);
        assertThat(request.isGrantedUnilaterally()).isTrue();
    }

    @Test
    @DisplayName("borda: 47h59 ainda PENDING")
    void justBeforeUnilateralStaysPending() {
        UnlockRequest request = newRequest();

        assertThat(request.evaluate(T0.plus(Duration.ofHours(47)).plus(Duration.ofMinutes(59)), GRANT)).isFalse();
        assertThat(request.getStatus()).isEqualTo(UnlockRequestStatus.PENDING);
    }

    @Test
    @DisplayName("feliz: GRANTED expira em CONSUMED e some dos grants ativos")
    void grantExpiresIntoConsumed() {
        UnlockRequest request = newRequest();
        request.evaluate(T0.plus(UNILATERAL), GRANT);
        Instant afterGrant = T0.plus(UNILATERAL).plus(GRANT).plusSeconds(1);

        assertThat(request.isGrantActive(T0.plus(UNILATERAL).plusSeconds(1))).isTrue();
        assertThat(request.evaluate(afterGrant, GRANT)).isTrue();
        assertThat(request.getStatus()).isEqualTo(UnlockRequestStatus.CONSUMED);
        assertThat(request.isGrantActive(afterGrant)).isFalse();
    }

    @Test
    @DisplayName("erro: negar torna o pedido terminal e imune a aprovacao posterior")
    void denyIsTerminal() {
        UnlockRequest request = newRequest();
        request.deny(partner, T0.plusSeconds(30));

        assertThat(request.getStatus()).isEqualTo(UnlockRequestStatus.DENIED);
        assertThatThrownBy(() -> request.approve(partner, T0.plusSeconds(60)))
                .isInstanceOf(ConflictException.class);
        assertThat(request.evaluate(T0.plus(UNILATERAL), GRANT)).isFalse();
        assertThat(request.getStatus()).isEqualTo(UnlockRequestStatus.DENIED);
    }

    @Test
    @DisplayName("erro: cancelar torna o pedido terminal e nao concede depois")
    void cancelIsTerminal() {
        UnlockRequest request = newRequest();
        request.cancel();

        assertThat(request.getStatus()).isEqualTo(UnlockRequestStatus.CANCELLED);
        assertThat(request.evaluate(T0.plus(UNILATERAL), GRANT)).isFalse();
        assertThatThrownBy(request::cancel).isInstanceOf(ConflictException.class);
    }

    @Test
    @DisplayName("erro: nao e possivel cancelar um pedido ja concedido")
    void cannotCancelGranted() {
        UnlockRequest request = newRequest();
        request.evaluate(T0.plus(UNILATERAL), GRANT);

        assertThatThrownBy(request::cancel).isInstanceOf(ConflictException.class);
        assertThat(request.getStatus()).isEqualTo(UnlockRequestStatus.GRANTED);
    }

    @Test
    @DisplayName("regressao: aprovacao apos concessao unilateral e inocua (F-S9)")
    void approvalAfterUnilateralGrantIsInert() {
        UnlockRequest request = newRequest();
        request.evaluate(T0.plus(UNILATERAL), GRANT);

        assertThatThrownBy(() -> request.approve(partner, T0.plus(UNILATERAL).plusSeconds(3600)))
                .isInstanceOf(ConflictException.class);
        assertThat(request.isGrantedUnilaterally()).isTrue();
        assertThat(request.getGrantEndsAt()).isEqualTo(T0.plus(UNILATERAL).plus(GRANT));
    }

    @Test
    @DisplayName("regressao: relogio do device nao existe aqui, so o instante do servidor decide")
    void onlyServerInstantDecides() {
        UnlockRequest request = newRequest();

        assertThat(request.getCooldownEndsAt()).isEqualTo(T0.plus(COOLDOWN));
        assertThat(request.getUnilateralEndsAt()).isEqualTo(T0.plus(UNILATERAL));
        assertThat(request.evaluate(T0.plusSeconds(1), GRANT)).isFalse();
        assertThat(request.getStatus()).isEqualTo(UnlockRequestStatus.PENDING);
    }

    @Test
    @DisplayName("borda: aprovacao dupla nao reescreve o instante da primeira")
    void doubleApprovalKeepsFirstInstant() {
        UnlockRequest request = newRequest();
        request.approve(partner, T0.plusSeconds(60));
        request.approve(partner, T0.plusSeconds(600));

        assertThat(request.getApprovedAt()).isEqualTo(T0.plusSeconds(60));
    }
}
