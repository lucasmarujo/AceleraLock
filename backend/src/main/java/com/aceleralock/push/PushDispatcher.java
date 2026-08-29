package com.aceleralock.push;

import com.aceleralock.account.Account;
import com.aceleralock.audit.AuditEventType;
import com.aceleralock.audit.AuditService;
import com.aceleralock.device.Device;
import com.aceleralock.device.DeviceRepository;
import com.aceleralock.device.DeviceStatus;
import com.google.firebase.messaging.FirebaseMessaging;
import com.google.firebase.messaging.Message;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Component
public class PushDispatcher {

    private static final Logger log = LoggerFactory.getLogger(PushDispatcher.class);

    private final DeviceRepository deviceRepository;
    private final AuditService auditService;
    private final ObjectProvider<FirebaseMessaging> firebaseMessaging;

    public PushDispatcher(DeviceRepository deviceRepository, AuditService auditService,
                          ObjectProvider<FirebaseMessaging> firebaseMessaging) {
        this.deviceRepository = deviceRepository;
        this.auditService = auditService;
        this.firebaseMessaging = firebaseMessaging;
    }

    public static Map<String, String> buildPayload(PushNotificationType type, UUID unlockRequestId) {
        Map<String, String> payload = new LinkedHashMap<>();
        payload.put("type", type.name());
        if (unlockRequestId != null) {
            payload.put("unlockRequestId", unlockRequestId.toString());
        }
        return payload;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void notifyAccount(Account account, PushNotificationType type, UUID unlockRequestId) {
        if (account == null) {
            return;
        }
        Map<String, String> payload = buildPayload(type, unlockRequestId);
        List<Device> devices = deviceRepository.findByAccountIdAndStatus(account.getId(), DeviceStatus.ACTIVE);
        for (Device device : devices) {
            if (device.getPushToken() == null) {
                continue;
            }
            send(account, device, payload);
        }
    }

    private void send(Account account, Device device, Map<String, String> payload) {
        FirebaseMessaging messaging = firebaseMessaging.getIfAvailable();
        if (messaging == null) {
            log.debug("push nao configurado, ignorando envio para device {}", device.getId());
            return;
        }
        try {
            messaging.send(Message.builder().setToken(device.getPushToken()).putAllData(payload).build());
        } catch (Exception exception) {
            log.warn("falha ao enviar push para device {}", device.getId(), exception);
            auditService.recordServerEvent(account, device, AuditEventType.PUSH_DELIVERY_FAILED, null);
        }
    }
}
