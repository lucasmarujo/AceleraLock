package com.aceleralock.audit;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface AuditEventRepository extends JpaRepository<AuditEvent, UUID> {

    boolean existsByDeviceIdAndClientEventId(UUID deviceId, UUID clientEventId);

    List<AuditEvent> findByAccountIdOrderByReceivedAtDesc(UUID accountId);

    List<AuditEvent> findByAccountIdAndTypeOrderByReceivedAtDesc(UUID accountId, AuditEventType type);
}
