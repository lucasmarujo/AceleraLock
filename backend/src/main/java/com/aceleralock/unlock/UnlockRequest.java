package com.aceleralock.unlock;

import com.aceleralock.account.Account;
import com.aceleralock.common.ConflictException;
import com.aceleralock.device.BlockTarget;
import com.aceleralock.device.Device;
import com.aceleralock.partner.PartnerLink;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import org.hibernate.annotations.UuidGenerator;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "unlock_request")
public class UnlockRequest {

    @Id
    @UuidGenerator(style = UuidGenerator.Style.TIME)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "account_id", nullable = false)
    private Account account;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "device_id", nullable = false)
    private Device device;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "target_id", nullable = false)
    private BlockTarget target;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "partner_link_id")
    private PartnerLink partnerLink;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private UnlockRequestStatus status;

    @Column(length = 500)
    private String reason;

    @Column(name = "requested_at", nullable = false)
    private Instant requestedAt;

    @Column(name = "cooldown_ends_at", nullable = false)
    private Instant cooldownEndsAt;

    @Column(name = "unilateral_ends_at", nullable = false)
    private Instant unilateralEndsAt;

    @Column(name = "approved_at")
    private Instant approvedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "decided_by_account_id")
    private Account decidedByAccount;

    @Column(name = "granted_at")
    private Instant grantedAt;

    @Column(name = "grant_ends_at")
    private Instant grantEndsAt;

    @Column(name = "granted_unilaterally", nullable = false)
    private boolean grantedUnilaterally;

    @Version
    private int version;

    protected UnlockRequest() {
    }

    public UnlockRequest(Account account, Device device, BlockTarget target, PartnerLink partnerLink,
                         String reason, Instant requestedAt, Duration cooldown, Duration unilateralCooldown) {
        this.account = account;
        this.device = device;
        this.target = target;
        this.partnerLink = partnerLink;
        this.reason = reason;
        this.status = UnlockRequestStatus.PENDING;
        this.requestedAt = requestedAt;
        this.cooldownEndsAt = requestedAt.plus(cooldown);
        this.unilateralEndsAt = requestedAt.plus(unilateralCooldown);
        this.grantedUnilaterally = false;
    }

    public boolean evaluate(Instant now, Duration grantDuration) {
        if (status == UnlockRequestStatus.PENDING) {
            boolean approvedPath = approvedAt != null && !now.isBefore(cooldownEndsAt);
            boolean unilateralPath = !now.isBefore(unilateralEndsAt);
            if (!approvedPath && !unilateralPath) {
                return false;
            }
            this.status = UnlockRequestStatus.GRANTED;
            this.grantedAt = now;
            this.grantEndsAt = now.plus(grantDuration);
            this.grantedUnilaterally = !approvedPath;
            return true;
        }
        if (status == UnlockRequestStatus.GRANTED && now.isAfter(grantEndsAt)) {
            this.status = UnlockRequestStatus.CONSUMED;
            return true;
        }
        return false;
    }

    public void approve(Account partner, Instant approvedAt) {
        requirePending("aprovar");
        if (this.approvedAt == null) {
            this.approvedAt = approvedAt;
            this.decidedByAccount = partner;
        }
    }

    public void deny(Account partner, Instant deniedAt) {
        requirePending("negar");
        this.status = UnlockRequestStatus.DENIED;
        this.decidedByAccount = partner;
        this.approvedAt = null;
    }

    public void cancel() {
        requirePending("cancelar");
        this.status = UnlockRequestStatus.CANCELLED;
    }

    private void requirePending(String action) {
        if (status != UnlockRequestStatus.PENDING) {
            throw new ConflictException("nao e possivel " + action + " um pedido em estado " + status);
        }
    }

    public boolean isGrantActive(Instant now) {
        return status == UnlockRequestStatus.GRANTED && grantEndsAt != null && !now.isAfter(grantEndsAt);
    }

    public UUID getId() {
        return id;
    }

    public Account getAccount() {
        return account;
    }

    public Device getDevice() {
        return device;
    }

    public BlockTarget getTarget() {
        return target;
    }

    public PartnerLink getPartnerLink() {
        return partnerLink;
    }

    public UnlockRequestStatus getStatus() {
        return status;
    }

    public String getReason() {
        return reason;
    }

    public Instant getRequestedAt() {
        return requestedAt;
    }

    public Instant getCooldownEndsAt() {
        return cooldownEndsAt;
    }

    public Instant getUnilateralEndsAt() {
        return unilateralEndsAt;
    }

    public Instant getApprovedAt() {
        return approvedAt;
    }

    public Instant getGrantedAt() {
        return grantedAt;
    }

    public Instant getGrantEndsAt() {
        return grantEndsAt;
    }

    public boolean isGrantedUnilaterally() {
        return grantedUnilaterally;
    }
}
