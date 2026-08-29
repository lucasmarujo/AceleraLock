package com.aceleralock.profile;

import com.aceleralock.account.Account;
import com.aceleralock.device.BlockTarget;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import org.hibernate.annotations.UuidGenerator;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Entity
@Table(name = "block_profile")
public class BlockProfile {

    @Id
    @UuidGenerator(style = UuidGenerator.Style.TIME)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "account_id", nullable = false)
    private Account account;

    @Column(nullable = false, length = 80)
    private String name;

    @Column(nullable = false)
    private boolean enabled;

    @Column(name = "time_zone", nullable = false, length = 64)
    private String timeZone;

    @Column(name = "cooldown_minutes", nullable = false)
    private int cooldownMinutes;

    @Column(name = "pending_cooldown_minutes")
    private Integer pendingCooldownMinutes;

    @Column(name = "cooldown_effective_at", nullable = false)
    private Instant cooldownEffectiveAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @OneToMany(mappedBy = "profile", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
    private List<BlockWindow> windows = new ArrayList<>();

    @ManyToMany(fetch = FetchType.EAGER)
    @JoinTable(name = "block_profile_target",
            joinColumns = @JoinColumn(name = "profile_id"),
            inverseJoinColumns = @JoinColumn(name = "target_id"))
    private Set<BlockTarget> targets = new LinkedHashSet<>();

    protected BlockProfile() {
    }

    public BlockProfile(Account account, String name, boolean enabled, String timeZone,
                        int cooldownMinutes, Instant createdAt) {
        this.account = account;
        this.name = name;
        this.enabled = enabled;
        this.timeZone = timeZone;
        this.cooldownMinutes = cooldownMinutes;
        this.cooldownEffectiveAt = createdAt;
        this.createdAt = createdAt;
        this.updatedAt = createdAt;
    }

    public void rename(String name, boolean enabled, String timeZone, Instant updatedAt) {
        this.name = name;
        this.enabled = enabled;
        this.timeZone = timeZone;
        this.updatedAt = updatedAt;
    }

    public void applyCooldownChange(int newCooldownMinutes, Instant now) {
        int current = effectiveCooldownMinutes(now);
        if (newCooldownMinutes >= current) {
            this.cooldownMinutes = newCooldownMinutes;
            this.pendingCooldownMinutes = null;
            this.cooldownEffectiveAt = now;
        } else {
            this.cooldownMinutes = current;
            this.pendingCooldownMinutes = newCooldownMinutes;
            this.cooldownEffectiveAt = now.plus(Duration.ofMinutes(current));
        }
        this.updatedAt = now;
    }

    public int effectiveCooldownMinutes(Instant now) {
        if (pendingCooldownMinutes != null && !now.isBefore(cooldownEffectiveAt)) {
            return pendingCooldownMinutes;
        }
        return cooldownMinutes;
    }

    public void promotePendingCooldown(Instant now) {
        if (pendingCooldownMinutes != null && !now.isBefore(cooldownEffectiveAt)) {
            this.cooldownMinutes = pendingCooldownMinutes;
            this.pendingCooldownMinutes = null;
        }
    }

    public void replaceWindows(List<BlockWindow> replacements) {
        this.windows.clear();
        this.windows.addAll(replacements);
    }

    public UUID getId() {
        return id;
    }

    public Account getAccount() {
        return account;
    }

    public String getName() {
        return name;
    }

    public boolean isEnabled() {
        return enabled;
    }

    public String getTimeZone() {
        return timeZone;
    }

    public int getCooldownMinutes() {
        return cooldownMinutes;
    }

    public Integer getPendingCooldownMinutes() {
        return pendingCooldownMinutes;
    }

    public Instant getCooldownEffectiveAt() {
        return cooldownEffectiveAt;
    }

    public List<BlockWindow> getWindows() {
        return windows;
    }

    public Set<BlockTarget> getTargets() {
        return targets;
    }
}
