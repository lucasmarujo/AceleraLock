package com.aceleralock.unlock;

import com.aceleralock.AbstractIntegrationTest;
import com.aceleralock.account.Account;
import com.aceleralock.audit.AuditEventRepository;
import com.aceleralock.audit.AuditEventType;
import com.aceleralock.auth.AuthService;
import com.aceleralock.device.BlockTargetController;
import com.aceleralock.device.Device;
import com.aceleralock.device.DevicePlatform;
import com.aceleralock.partner.PartnerLink;
import com.aceleralock.partner.PartnerService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.time.Duration;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.http.HttpHeaders.AUTHORIZATION;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class UnlockCeremonyIntegrationTest extends AbstractIntegrationTest {

    private static final Duration COOLDOWN = Duration.ofMinutes(30);
    private static final Duration UNILATERAL = Duration.ofHours(48);
    private static final Duration PARTNER_MIN_AGE = Duration.ofHours(48);

    @Autowired
    private PartnerService partnerService;

    @Autowired
    private AuditEventRepository auditEventRepository;

    private record Scene(AuthService.DeviceSession owner, AuthService.DeviceSession partner,
                         UUID targetId, UUID linkId, Account ownerAccount) {
    }

    private Scene scene(boolean matureLink) throws Exception {
        Account ownerAccount = newAccount("owner-" + UUID.randomUUID());
        Device ownerDevice = newDevice(ownerAccount, "install-o-" + UUID.randomUUID(), DevicePlatform.IOS);
        AuthService.DeviceSession owner = authService.issueDeviceSession(ownerDevice);

        Account partnerAccount = newAccount("partner-" + UUID.randomUUID());
        Device partnerDevice = newDevice(partnerAccount, "install-p-" + UUID.randomUUID(), DevicePlatform.ANDROID);
        AuthService.DeviceSession partner = authService.issueDeviceSession(partnerDevice);

        PartnerService.CreatedInvite invite = partnerService.createInvite(ownerAccount.getId());
        PartnerLink link = partnerService.accept(partnerAccount.getId(), invite.code());

        if (matureLink) {
            clock.advance(PARTNER_MIN_AGE);
        }

        String body = mockMvc.perform(post("/v1/devices/{id}/targets", owner.deviceId())
                        .header(AUTHORIZATION, freshBearer(owner))
                        .contentType(APPLICATION_JSON)
                        .content(json(new BlockTargetController.RegisterTargetsRequest(
                                List.of(new BlockTargetController.TargetSpec("ref", "Instagram"))))))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        UUID targetId = UUID.fromString(
                objectMapper.readTree(body).get("targets").get(0).get("targetId").asString());

        return new Scene(owner, partner, targetId, link.getId(), ownerAccount);
    }

    private UUID request(Scene scene) throws Exception {
        String body = mockMvc.perform(post("/v1/devices/{id}/unlock-requests", scene.owner().deviceId())
                        .header(AUTHORIZATION, freshBearer(scene.owner()))
                        .contentType(APPLICATION_JSON)
                        .content(json(new UnlockRequestController.CreateUnlockRequest(scene.targetId(), "foco"))))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return UUID.fromString(objectMapper.readTree(body).get("requestId").asString());
    }

    private void expectStatus(Scene scene, UUID requestId, String expected) throws Exception {
        mockMvc.perform(get("/v1/unlock-requests/{id}", requestId)
                        .header(AUTHORIZATION, freshBearer(scene.owner())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value(expected));
    }

    @Test
    @DisplayName("feliz: aprovacao do parceiro mais cooldown de 30min concede")
    void approvedPlusCooldownGrants() throws Exception {
        Scene scene = scene(true);
        UUID requestId = request(scene);

        mockMvc.perform(post("/v1/unlock-requests/{id}/approve", requestId)
                        .header(AUTHORIZATION, freshBearer(scene.partner())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PENDING"));

        clock.advance(COOLDOWN);
        expectStatus(scene, requestId, "GRANTED");

        mockMvc.perform(get("/v1/devices/{id}/sync", scene.owner().deviceId())
                        .header(AUTHORIZATION, freshBearer(scene.owner())))
                .andExpect(jsonPath("$.activeGrants.length()").value(1))
                .andExpect(jsonPath("$.activeGrants[0].grantedUnilaterally").value(false));
    }

    @Test
    @DisplayName("regressao: vinculo de parceiro novo nao pode aprovar antes de 48h (F-S6)")
    void freshPartnerCannotApprove() throws Exception {
        Scene scene = scene(false);
        UUID requestId = request(scene);

        mockMvc.perform(post("/v1/unlock-requests/{id}/approve", requestId)
                        .header(AUTHORIZATION, freshBearer(scene.partner())))
                .andExpect(status().isConflict());

        clock.advance(COOLDOWN);
        expectStatus(scene, requestId, "PENDING");
    }

    @Test
    @DisplayName("valvula: 48h sem resposta concede unilateralmente e registra na trilha")
    void unilateralValveGrantsAfterFortyEightHours() throws Exception {
        Scene scene = scene(true);
        UUID requestId = request(scene);

        clock.advance(Duration.ofHours(47));
        expectStatus(scene, requestId, "PENDING");

        clock.advance(Duration.ofHours(1));
        mockMvc.perform(get("/v1/unlock-requests/{id}", requestId)
                        .header(AUTHORIZATION, freshBearer(scene.owner())))
                .andExpect(jsonPath("$.status").value("GRANTED"))
                .andExpect(jsonPath("$.grantedUnilaterally").value(true));

        assertThat(auditEventRepository.findByAccountIdAndTypeOrderByReceivedAtDesc(
                scene.ownerAccount().getId(), AuditEventType.UNLOCK_GRANTED_UNILATERALLY)).isNotEmpty();
    }

    @Test
    @DisplayName("borda: parceiro revogado nao aprova, mas o pedido drena pela valvula")
    void revokedPartnerLeavesNoDeadEnd() throws Exception {
        Scene scene = scene(true);
        UUID requestId = request(scene);

        mockMvc.perform(delete("/v1/partners/{id}", scene.linkId())
                        .header(AUTHORIZATION, freshBearer(scene.owner())))
                .andExpect(status().isNoContent());

        mockMvc.perform(post("/v1/unlock-requests/{id}/approve", requestId)
                        .header(AUTHORIZATION, freshBearer(scene.partner())))
                .andExpect(status().isNotFound());

        expectStatus(scene, requestId, "PENDING");

        clock.advance(UNILATERAL);
        expectStatus(scene, requestId, "GRANTED");
    }

    @Test
    @DisplayName("erro: negar torna terminal e nao vira concessao unilateral")
    void denyIsTerminalAndBlocksValve() throws Exception {
        Scene scene = scene(true);
        UUID requestId = request(scene);

        mockMvc.perform(post("/v1/unlock-requests/{id}/deny", requestId)
                        .header(AUTHORIZATION, freshBearer(scene.partner())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("DENIED"));

        clock.advance(UNILATERAL.plusHours(1));
        expectStatus(scene, requestId, "DENIED");
    }

    @Test
    @DisplayName("borda: pedido duplicado devolve o mesmo recurso, com um unico timer")
    void duplicateRequestIsIdempotent() throws Exception {
        Scene scene = scene(true);
        UUID first = request(scene);
        UUID second = request(scene);

        assertThat(second).isEqualTo(first);
        assertThat(auditEventRepository.findByAccountIdAndTypeOrderByReceivedAtDesc(
                scene.ownerAccount().getId(), AuditEventType.UNLOCK_REQUESTED)).hasSize(1);
    }

    @Test
    @DisplayName("erro: terceiro que nao e o parceiro recebe 404 ao aprovar")
    void strangerCannotApprove() throws Exception {
        Scene scene = scene(true);
        UUID requestId = request(scene);

        Account stranger = newAccount("stranger-" + UUID.randomUUID());
        AuthService.DeviceSession strangerSession = authService.issueDeviceSession(
                newDevice(stranger, "install-s-" + UUID.randomUUID(), DevicePlatform.IOS));

        mockMvc.perform(post("/v1/unlock-requests/{id}/approve", requestId)
                        .header(AUTHORIZATION, freshBearer(strangerSession)))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("feliz: cancelar torna terminal e libera novo pedido com cooldown cheio")
    void cancelAllowsFreshRequest() throws Exception {
        Scene scene = scene(true);
        UUID first = request(scene);

        mockMvc.perform(delete("/v1/unlock-requests/{id}", first)
                        .header(AUTHORIZATION, freshBearer(scene.owner())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CANCELLED"));

        UUID second = request(scene);
        assertThat(second).isNotEqualTo(first);
        expectStatus(scene, second, "PENDING");
    }

    @Test
    @DisplayName("regressao: grant expira em CONSUMED e some de activeGrants")
    void grantExpiresAndLeavesActiveGrants() throws Exception {
        Scene scene = scene(true);
        UUID requestId = request(scene);
        clock.advance(UNILATERAL);
        expectStatus(scene, requestId, "GRANTED");

        clock.advance(Duration.ofMinutes(16));

        expectStatus(scene, requestId, "CONSUMED");
        mockMvc.perform(get("/v1/devices/{id}/sync", scene.owner().deviceId())
                        .header(AUTHORIZATION, freshBearer(scene.owner())))
                .andExpect(jsonPath("$.activeGrants.length()").value(0));
    }
}
