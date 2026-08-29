package com.aceleralock.audit;

import com.aceleralock.account.Account;
import com.aceleralock.device.BlockTarget;
import com.aceleralock.device.Device;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UuidGenerator;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "audit_event")
public class AuditEvent {

    @Id
    @UuidGenerator(style = UuidGenerator.Style.TIME)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "account_id", nullable = false)
    private Account account;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "device_id")
    private Device device;

    @Column(name = "client_event_id")
    private UUID clientEventId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private AuditEventSource source;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 48)
    private AuditEventType type;

    @Column(name = "occurred_at")
    private Instant occurredAt;

    @Column(name = "received_at", nullable = false)
    private Instant receivedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "target_id")
    private BlockTarget target;

    @JdbcTypeCode(SqlTypes.JSON)
    private String details;

    protected AuditEvent() {
    }

    public AuditEvent(Account account, Device device, UUID clientEventId, AuditEventSource source,
                      AuditEventType type, Instant occurredAt, Instant receivedAt,
                      BlockTarget target, String details) {
        this.account = account;
        this.device = device;
        this.clientEventId = clientEventId;
        this.source = source;
        this.type = type;
        this.occurredAt = occurredAt;
        this.receivedAt = receivedAt;
        this.target = target;
        this.details = details;
    }

    public UUID getId() {
        return id;
    }

    public AuditEventType getType() {
        return type;
    }

    public AuditEventSource getSource() {
        return source;
    }

    public Instant getOccurredAt() {
        return occurredAt;
    }

    public Instant getReceivedAt() {
        return receivedAt;
    }

    public UUID getClientEventId() {
        return clientEventId;
    }

    public String getDetails() {
        return details;
    }
}
