package com.aceleralock.partner;

import com.aceleralock.AbstractIntegrationTest;
import com.aceleralock.account.Account;
import com.aceleralock.audit.AuditEventRepository;
import com.aceleralock.audit.AuditEventType;
import com.aceleralock.device.DevicePlatform;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.time.Duration;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class PartnerLinkIntegrationTest extends AbstractIntegrationTest {

    @Autowired
    private PartnerService partnerService;

    @Autowired
    private AuditEventRepository auditEventRepository;

    private Account owner() {
        Account account = newAccount("owner-" + UUID.randomUUID());
        newDevice(account, "install-owner-" + UUID.randomUUID(), DevicePlatform.IOS);
        return account;
    }

    private Account partner() {
        Account account = newAccount("partner-" + UUID.randomUUID());
        newDevice(account, "install-partner-" + UUID.randomUUID(), DevicePlatform.ANDROID);
        return account;
    }

    @Test
    @DisplayName("feliz: convite aceito vira vinculo ACTIVE")
    void inviteAcceptedBecomesActive() {
        Account owner = owner();
        Account partner = partner();

        PartnerService.CreatedInvite invite = partnerService.createInvite(owner.getId());
        PartnerLink link = partnerService.accept(partner.getId(), invite.code());

        assertThat(link.getStatus()).isEqualTo(PartnerLinkStatus.ACTIVE);
        assertThat(link.getAcceptedAt()).isEqualTo(T0);
        assertThat(auditEventRepository.findByAccountIdAndTypeOrderByReceivedAtDesc(
                owner.getId(), AuditEventType.PARTNER_LINKED)).isNotEmpty();
    }

    @Test
    @DisplayName("erro: aceitar o proprio convite e recusado")
    void cannotBeOwnPartner() {
        Account owner = owner();
        PartnerService.CreatedInvite invite = partnerService.createInvite(owner.getId());

        assertThatThrownBy(() -> partnerService.accept(owner.getId(), invite.code()))
                .hasMessageContaining("si mesmo");
    }

    @Test
    @DisplayName("regressao: parceiro na mesma instalacao do dono e recusado (F-S4)")
    void partnerOnSameInstallationIsRejected() {
        Account owner = newAccount("owner-same-" + UUID.randomUUID());
        String sharedInstall = "install-shared-" + UUID.randomUUID();
        newDevice(owner, sharedInstall, DevicePlatform.IOS);

        Account partner = newAccount("partner-same-" + UUID.randomUUID());
        newDevice(partner, sharedInstall, DevicePlatform.IOS);

        PartnerService.CreatedInvite invite = partnerService.createInvite(owner.getId());

        assertThatThrownBy(() -> partnerService.accept(partner.getId(), invite.code()))
                .hasMessageContaining("mesma instalacao");
    }

    @Test
    @DisplayName("erro: convite expirado nao pode ser aceito")
    void expiredInviteIsRejected() {
        Account owner = owner();
        Account partner = partner();
        PartnerService.CreatedInvite invite = partnerService.createInvite(owner.getId());

        clock.advance(Duration.ofHours(25));

        assertThatThrownBy(() -> partnerService.accept(partner.getId(), invite.code()))
                .hasMessageContaining("nao encontrado");
    }

    @Test
    @DisplayName("borda: convite e de uso unico, segundo aceite falha")
    void inviteIsSingleUse() {
        Account owner = owner();
        Account first = partner();
        Account second = partner();
        PartnerService.CreatedInvite invite = partnerService.createInvite(owner.getId());
        partnerService.accept(first.getId(), invite.code());

        assertThatThrownBy(() -> partnerService.accept(second.getId(), invite.code()))
                .hasMessageContaining("ja utilizado");
    }

    @Test
    @DisplayName("feliz: parceiro tambem pode revogar o vinculo")
    void partnerCanRevoke() {
        Account owner = owner();
        Account partner = partner();
        PartnerService.CreatedInvite invite = partnerService.createInvite(owner.getId());
        PartnerLink link = partnerService.accept(partner.getId(), invite.code());

        partnerService.revoke(partner.getId(), link.getId());

        assertThat(partnerService.findActiveLinkOwnedBy(owner.getId())).isEmpty();
    }

    @Test
    @DisplayName("erro: terceiro nao consegue revogar vinculo alheio")
    void strangerCannotRevoke() {
        Account owner = owner();
        Account partner = partner();
        Account stranger = partner();
        PartnerService.CreatedInvite invite = partnerService.createInvite(owner.getId());
        PartnerLink link = partnerService.accept(partner.getId(), invite.code());

        assertThatThrownBy(() -> partnerService.revoke(stranger.getId(), link.getId()))
                .hasMessageContaining("nao encontrado");
    }

    @Test
    @DisplayName("borda: vinculo reciproco e sinalizado na trilha, nao bloqueado (F-S7)")
    void reciprocalLinkIsFlagged() {
        Account first = owner();
        Account second = partner();

        partnerService.accept(second.getId(), partnerService.createInvite(first.getId()).code());
        partnerService.accept(first.getId(), partnerService.createInvite(second.getId()).code());

        assertThat(partnerService.findActiveLinkOwnedBy(second.getId())).isPresent();
        assertThat(auditEventRepository.findByAccountIdAndTypeOrderByReceivedAtDesc(
                second.getId(), AuditEventType.PARTNER_RECIPROCAL_DETECTED)).isNotEmpty();
    }

    @Test
    @DisplayName("regressao: parceiro apaga a conta e o dono e notificado na trilha")
    void ownerIsNotifiedWhenPartnerDeletesAccount() throws Exception {
        Account owner = owner();
        Account partner = partner();
        partnerService.accept(partner.getId(), partnerService.createInvite(owner.getId()).code());
        com.aceleralock.auth.AuthService.DeviceSession partnerSession = authService.issueDeviceSession(
                deviceRepository.findByAccountId(partner.getId()).get(0));

        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .delete("/v1/accounts/me")
                        .header(org.springframework.http.HttpHeaders.AUTHORIZATION, freshBearer(partnerSession)))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers
                        .status().isNoContent());

        assertThat(auditEventRepository.findByAccountIdAndTypeOrderByReceivedAtDesc(
                owner.getId(), AuditEventType.ACCOUNT_DELETED)).isNotEmpty();
        assertThat(accountRepository.findById(partner.getId())).isEmpty();
        assertThat(accountRepository.findById(owner.getId())).isPresent();
    }

    @Test
    @DisplayName("regressao: dono apaga a conta e o parceiro e notificado na trilha")
    void partnerIsNotifiedWhenOwnerDeletesAccount() throws Exception {
        Account owner = owner();
        Account partner = partner();
        partnerService.accept(partner.getId(), partnerService.createInvite(owner.getId()).code());
        com.aceleralock.auth.AuthService.DeviceSession ownerSession = authService.issueDeviceSession(
                deviceRepository.findByAccountId(owner.getId()).get(0));

        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .delete("/v1/accounts/me")
                        .header(org.springframework.http.HttpHeaders.AUTHORIZATION, freshBearer(ownerSession)))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers
                        .status().isNoContent());

        assertThat(auditEventRepository.findByAccountIdAndTypeOrderByReceivedAtDesc(
                partner.getId(), AuditEventType.ACCOUNT_DELETED)).isNotEmpty();
        assertThat(accountRepository.findById(owner.getId())).isEmpty();
    }

    @Test
    @DisplayName("erro: dono com parceiro ativo nao cria segundo convite")
    void ownerCannotHaveTwoActivePartners() {
        Account owner = owner();
        Account partner = partner();
        partnerService.accept(partner.getId(), partnerService.createInvite(owner.getId()).code());

        assertThatThrownBy(() -> partnerService.createInvite(owner.getId()))
                .hasMessageContaining("ja existe um parceiro ativo");
    }
}
