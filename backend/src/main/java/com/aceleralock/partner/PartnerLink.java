package com.aceleralock.partner;

import com.aceleralock.account.Account;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
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
@Table(name = "partner_link")
public class PartnerLink {

    @Id
    @UuidGenerator(style = UuidGenerator.Style.TIME)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "owner_account_id", nullable = false)
    private Account ownerAccount;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "partner_account_id")
    private Account partnerAccount;

    @Column(name = "invite_code_hash", nullable = false)
    private byte[] inviteCodeHash;

    @Column(name = "invite_expires_at", nullable = false)
    private Instant inviteExpiresAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private PartnerLinkStatus status;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "accepted_at")
    private Instant acceptedAt;

    @Column(name = "revoked_at")
    private Instant revokedAt;

    protected PartnerLink() {
    }

    public PartnerLink(Account ownerAccount, byte[] inviteCodeHash, Instant inviteExpiresAt, Instant createdAt) {
        this.ownerAccount = ownerAccount;
        this.inviteCodeHash = inviteCodeHash;
        this.inviteExpiresAt = inviteExpiresAt;
        this.status = PartnerLinkStatus.PENDING;
        this.createdAt = createdAt;
    }

    public void accept(Account partner, Instant acceptedAt) {
        this.partnerAccount = partner;
        this.status = PartnerLinkStatus.ACTIVE;
        this.acceptedAt = acceptedAt;
    }

    public void revoke(Instant revokedAt) {
        this.status = PartnerLinkStatus.REVOKED;
        this.revokedAt = revokedAt;
    }

    public boolean isActive() {
        return status == PartnerLinkStatus.ACTIVE;
    }

    public boolean isMatureAt(Instant now, Duration minimumAge) {
        return acceptedAt != null && !now.isBefore(acceptedAt.plus(minimumAge));
    }

    public UUID getId() {
        return id;
    }

    public Account getOwnerAccount() {
        return ownerAccount;
    }

    public Account getPartnerAccount() {
        return partnerAccount;
    }

    public byte[] getInviteCodeHash() {
        return inviteCodeHash;
    }

    public Instant getInviteExpiresAt() {
        return inviteExpiresAt;
    }

    public PartnerLinkStatus getStatus() {
        return status;
    }

    public Instant getAcceptedAt() {
        return acceptedAt;
    }
}
