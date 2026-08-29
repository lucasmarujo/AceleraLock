package com.aceleralock.unlock;

import com.aceleralock.AbstractIntegrationTest;
import com.aceleralock.account.Account;
import com.aceleralock.audit.AuditEventRepository;
import com.aceleralock.audit.AuditEventType;
import com.aceleralock.auth.AuthService;
import com.aceleralock.device.BlockTargetController;
import com.aceleralock.device.Device;
import com.aceleralock.device.DeviceController;
import com.aceleralock.device.DevicePlatform;
import com.aceleralock.partner.PartnerService;
import com.aceleralock.push.PushProvider;
import com.google.firebase.messaging.FirebaseMessaging;
import com.google.firebase.messaging.Message;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.time.Duration;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.springframework.http.HttpHeaders.AUTHORIZATION;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@TestPropertySource(properties = "aceleralock.unlock.partner-min-age=96h")
class ImmatureLinkWithValveEligibleRequestTest extends AbstractIntegrationTest {

    @MockitoBean
    private FirebaseMessaging firebaseMessaging;

    @Autowired
    private PartnerService partnerService;

    @Autowired
    private AuditEventRepository auditEventRepository;

    @Test
    @DisplayName("regressao: vinculo imaturo com pedido ja elegivel a valvula nao dispara push antes do commit")
    void immatureLinkWithValveEligibleRequestNeverPushesBeforeCommit() throws Exception {
        Account ownerAccount = newAccount("owner-immature-" + UUID.randomUUID());
        Device ownerDevice = newDevice(ownerAccount, "install-o-" + UUID.randomUUID(), DevicePlatform.IOS);
        AuthService.DeviceSession owner = authService.issueDeviceSession(ownerDevice);

        Account partnerAccount = newAccount("partner-immature-" + UUID.randomUUID());
        Device partnerDevice = newDevice(partnerAccount, "install-p-" + UUID.randomUUID(), DevicePlatform.ANDROID);
        AuthService.DeviceSession partner = authService.issueDeviceSession(partnerDevice);

        partnerService.accept(partnerAccount.getId(),
                partnerService.createInvite(ownerAccount.getId()).code());

        mockMvc.perform(put("/v1/devices/{id}/push-token", partner.deviceId())
                        .header(AUTHORIZATION, freshBearer(partner))
                        .contentType(APPLICATION_JSON)
                        .content(json(new DeviceController.PushTokenRequest("token-parceiro", PushProvider.FCM))))
                .andExpect(status().isNoContent());

        String targetBody = mockMvc.perform(post("/v1/devices/{id}/targets", owner.deviceId())
                        .header(AUTHORIZATION, freshBearer(owner))
                        .contentType(APPLICATION_JSON)
                        .content(json(new BlockTargetController.RegisterTargetsRequest(
                                List.of(new BlockTargetController.TargetSpec("ref", "Instagram"))))))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        UUID targetId = UUID.fromString(
                objectMapper.readTree(targetBody).get("targets").get(0).get("targetId").asString());

        String requestBody = mockMvc.perform(post("/v1/devices/{id}/unlock-requests", owner.deviceId())
                        .header(AUTHORIZATION, freshBearer(owner))
                        .contentType(APPLICATION_JSON)
                        .content(json(new UnlockRequestController.CreateUnlockRequest(targetId, "foco"))))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        UUID requestId = UUID.fromString(objectMapper.readTree(requestBody).get("requestId").asString());

        org.mockito.Mockito.clearInvocations(firebaseMessaging);
        clock.advance(Duration.ofHours(48).plusMinutes(1));

        mockMvc.perform(post("/v1/unlock-requests/{id}/approve", requestId)
                        .header(AUTHORIZATION, freshBearer(partner)))
                .andExpect(status().isConflict());

        verify(firebaseMessaging, never()).send(any(Message.class));
        assertThat(auditEventRepository.findByAccountIdAndTypeOrderByReceivedAtDesc(
                ownerAccount.getId(), AuditEventType.UNLOCK_GRANTED_UNILATERALLY)).isEmpty();

        mockMvc.perform(get("/v1/unlock-requests/{id}", requestId)
                        .header(AUTHORIZATION, freshBearer(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("GRANTED"))
                .andExpect(jsonPath("$.grantedUnilaterally").value(true));

        verify(firebaseMessaging, times(1)).send(any(Message.class));
        assertThat(auditEventRepository.findByAccountIdAndTypeOrderByReceivedAtDesc(
                ownerAccount.getId(), AuditEventType.UNLOCK_GRANTED_UNILATERALLY)).hasSize(1);

        mockMvc.perform(get("/v1/unlock-requests/{id}", requestId)
                        .header(AUTHORIZATION, freshBearer(owner)))
                .andExpect(status().isOk());

        verify(firebaseMessaging, times(1)).send(any(Message.class));
    }
}
