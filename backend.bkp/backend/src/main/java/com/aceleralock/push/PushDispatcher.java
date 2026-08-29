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
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

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
    private final ApplicationEventPublisher eventPublisher;

    public PushDispatcher(DeviceRepository deviceRepository, AuditService auditService,
                          ObjectProvider<FirebaseMessaging> firebaseMessaging,
                          ApplicationEventPublisher eventPublisher) {
        this.deviceRepository = deviceRepository;
        this.auditService = auditService;
        this.firebaseMessaging = firebaseMessaging;
        this.eventPublisher = eventPublisher;
    }

    public static Map<String, String> buildPayload(PushNotificationType type, UUID unlockRequestId) {
        Map<String, String> payload = new LinkedHashMap<>();
        payload.put("type", type.name());
        if (unlockRequestId != null) {
            payload.put("unlockRequestId", unlockRequestId.toString());
        }
        return payload;
    }

    public void notifyAccount(Account account, PushNotificationType type, UUID unlockRequestId) {
        if (account == null) {
            return;
        }
        eventPublisher.publishEvent(new PushRequested(account.getId(), type, unlockRequestId));
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void onPushRequested(PushRequested event) {
        Map<String, String> payload = buildPayload(event.type(), event.unlockRequestId());
        List<Device> devices = deviceRepository.findByAccountIdAndStatus(event.accountId(), DeviceStatus.ACTIVE);
        for (Device device : devices) {
            if (device.getPushToken() != null) {
                send(device, payload);
            }
        }
    }

    private void send(Device device, Map<String, String> payload) {
        FirebaseMessaging messaging = firebaseMessaging.getIfAvailable();
        if (messaging == null) {
            log.debug("push nao configurado, ignorando envio para device {}", device.getId());
            return;
        }
        try {
            messaging.send(Message.builder().setToken(device.getPushToken()).putAllData(payload).build());
        } catch (Exception exception) {
            log.warn("falha ao enviar push para device {}", device.getId(), exception);
            auditService.recordTamperEvidence(device.getAccount().getId(), device.getId(),
                    AuditEventType.PUSH_DELIVERY_FAILED, null);
        }
    }

    public record PushRequested(UUID accountId, PushNotificationType type, UUID unlockRequestId) {
    }
}
