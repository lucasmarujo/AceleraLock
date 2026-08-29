package com.aceleralock.device;

import com.aceleralock.account.Account;
import com.aceleralock.push.PushProvider;
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

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "device")
public class Device {

    @Id
    @UuidGenerator(style = UuidGenerator.Style.TIME)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "account_id", nullable = false)
    private Account account;

    @Column(name = "device_install_id", nullable = false, length = 64)
    private String deviceInstallId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private DevicePlatform platform;

    @Column(nullable = false, length = 80)
    private String label;

    @Column(name = "time_zone", nullable = false, length = 64)
    private String timeZone;

    @Column(name = "app_version", nullable = false, length = 32)
    private String appVersion;

    @Column(name = "os_version", nullable = false, length = 32)
    private String osVersion;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private DeviceStatus status;

    @Column(name = "push_token", length = 512)
    private String pushToken;

    @Enumerated(EnumType.STRING)
    @Column(name = "push_provider", length = 16)
    private PushProvider pushProvider;

    @Column(name = "registered_at", nullable = false)
    private Instant registeredAt;

    @Column(name = "last_seen_at", nullable = false)
    private Instant lastSeenAt;

    protected Device() {
    }

    public Device(Account account, String deviceInstallId, DevicePlatform platform, String label,
                  String timeZone, String appVersion, String osVersion, Instant registeredAt) {
        this.account = account;
        this.deviceInstallId = deviceInstallId;
        this.platform = platform;
        this.label = label;
        this.timeZone = timeZone;
        this.appVersion = appVersion;
        this.osVersion = osVersion;
        this.status = DeviceStatus.ACTIVE;
        this.registeredAt = registeredAt;
        this.lastSeenAt = registeredAt;
    }

    public void refreshRegistration(String label, String timeZone, String appVersion, String osVersion, Instant seenAt) {
        this.label = label;
        this.timeZone = timeZone;
        this.appVersion = appVersion;
        this.osVersion = osVersion;
        this.status = DeviceStatus.ACTIVE;
        this.lastSeenAt = seenAt;
    }

    public void touch(Instant seenAt) {
        this.lastSeenAt = seenAt;
    }

    public void revoke() {
        this.status = DeviceStatus.REVOKED;
    }

    public void updatePushToken(String pushToken, PushProvider pushProvider) {
        this.pushToken = pushToken;
        this.pushProvider = pushProvider;
    }

    public UUID getId() {
        return id;
    }

    public Account getAccount() {
        return account;
    }

    public String getDeviceInstallId() {
        return deviceInstallId;
    }

    public DevicePlatform getPlatform() {
        return platform;
    }

    public String getLabel() {
        return label;
    }

    public String getTimeZone() {
        return timeZone;
    }

    public DeviceStatus getStatus() {
        return status;
    }

    public String getPushToken() {
        return pushToken;
    }

    public Instant getLastSeenAt() {
        return lastSeenAt;
    }

    public Instant getRegisteredAt() {
        return registeredAt;
    }
}
