package com.aceleralock.device;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import org.hibernate.annotations.UuidGenerator;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "block_target")
public class BlockTarget {

    @Id
    @UuidGenerator(style = UuidGenerator.Style.TIME)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "device_id", nullable = false)
    private Device device;

    @Column(name = "client_ref", nullable = false, length = 64)
    private String clientRef;

    @Column(length = 80)
    private String label;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected BlockTarget() {
    }

    public BlockTarget(Device device, String clientRef, String label, Instant createdAt) {
        this.device = device;
        this.clientRef = clientRef;
        this.label = label;
        this.createdAt = createdAt;
    }

    public UUID getId() {
        return id;
    }

    public Device getDevice() {
        return device;
    }

    public String getClientRef() {
        return clientRef;
    }

    public String getLabel() {
        return label;
    }
}
