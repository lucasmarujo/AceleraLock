package com.aceleralock.auth;

import com.aceleralock.device.Device;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import org.hibernate.annotations.UuidGenerator;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "refresh_token")
public class RefreshToken {

    @Id
    @UuidGenerator(style = UuidGenerator.Style.TIME)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "device_id", nullable = false)
    private Device device;

    @Column(name = "token_hash", nullable = false)
    private byte[] tokenHash;

    @Column(name = "family_id", nullable = false)
    private UUID familyId;

    @Column(name = "successor_id")
    private UUID successorId;

    @Column(name = "issued_at", nullable = false)
    private Instant issuedAt;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "used_at")
    private Instant usedAt;

    @Column(name = "revoked_at")
    private Instant revokedAt;

    protected RefreshToken() {
    }

    public RefreshToken(Device device, byte[] tokenHash, UUID familyId, Instant issuedAt, Duration ttl) {
        this.device = device;
        this.tokenHash = tokenHash;
        this.familyId = familyId;
        this.issuedAt = issuedAt;
        this.expiresAt = issuedAt.plus(ttl);
    }

    public void markUsed(Instant usedAt, UUID successorId) {
        this.usedAt = usedAt;
        this.successorId = successorId;
    }

    public void revoke(Instant revokedAt) {
        if (this.revokedAt == null) {
            this.revokedAt = revokedAt;
        }
    }

    public boolean isUsed() {
        return usedAt != null;
    }

    public boolean isRevoked() {
        return revokedAt != null;
    }

    public boolean isExpiredAt(Instant now) {
        return !now.isBefore(expiresAt);
    }

    public boolean isWithinGrace(Instant now, Duration grace) {
        return usedAt != null && !now.isAfter(usedAt.plus(grace));
    }

    public UUID getId() {
        return id;
    }

    public Device getDevice() {
        return device;
    }

    public UUID getFamilyId() {
        return familyId;
    }

    public UUID getSuccessorId() {
        return successorId;
    }

    public Instant getUsedAt() {
        return usedAt;
    }
}
