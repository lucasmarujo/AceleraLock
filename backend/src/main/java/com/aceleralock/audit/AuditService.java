package com.aceleralock.audit;

import com.aceleralock.account.Account;
import com.aceleralock.account.AccountRepository;
import com.aceleralock.device.BlockTarget;
import com.aceleralock.device.Device;
import com.aceleralock.device.DeviceRepository;
import com.aceleralock.time.TimeAuthority;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

@Service
public class AuditService {

    private final AuditEventRepository auditEventRepository;
    private final AccountRepository accountRepository;
    private final DeviceRepository deviceRepository;
    private final TimeAuthority timeAuthority;

    public AuditService(AuditEventRepository auditEventRepository, AccountRepository accountRepository,
                        DeviceRepository deviceRepository, TimeAuthority timeAuthority) {
        this.auditEventRepository = auditEventRepository;
        this.accountRepository = accountRepository;
        this.deviceRepository = deviceRepository;
        this.timeAuthority = timeAuthority;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordTamperEvidence(UUID accountId, UUID deviceId, AuditEventType type, String details) {
        Account account = accountRepository.findById(accountId).orElse(null);
        if (account == null) {
            return;
        }
        Device device = deviceId == null ? null : deviceRepository.findById(deviceId).orElse(null);
        auditEventRepository.save(new AuditEvent(account, device, null, AuditEventSource.SERVER, type,
                null, timeAuthority.now(), null, details));
    }

    @Transactional
    public AuditEvent recordServerEvent(Account account, Device device, AuditEventType type, BlockTarget target) {
        return recordServerEvent(account, device, type, target, null);
    }

    @Transactional
    public AuditEvent recordServerEvent(Account account, Device device, AuditEventType type,
                                        BlockTarget target, String details) {
        AuditEvent event = new AuditEvent(account, device, null, AuditEventSource.SERVER, type,
                null, timeAuthority.now(), target, details);
        return auditEventRepository.save(event);
    }

    @Transactional
    public boolean recordDeviceEvent(Account account, Device device, UUID clientEventId, AuditEventType type,
                                     Instant occurredAt, BlockTarget target, String details) {
        if (clientEventId != null && auditEventRepository.existsByDeviceIdAndClientEventId(device.getId(), clientEventId)) {
            return false;
        }
        AuditEvent event = new AuditEvent(account, device, clientEventId, AuditEventSource.DEVICE, type,
                occurredAt, timeAuthority.now(), target, details);
        auditEventRepository.save(event);
        return true;
    }
}
