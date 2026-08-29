package com.aceleralock.device;

import com.aceleralock.account.Account;
import com.aceleralock.audit.AuditEventType;
import com.aceleralock.audit.AuditService;
import com.aceleralock.auth.RefreshTokenService;
import com.aceleralock.common.ConflictException;
import com.aceleralock.common.NotFoundException;
import com.aceleralock.config.UnlockProperties;
import com.aceleralock.push.PushProvider;
import com.aceleralock.time.TimeAuthority;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
public class DeviceService {

    private final DeviceRepository deviceRepository;
    private final RefreshTokenService refreshTokenService;
    private final AuditService auditService;
    private final TimeAuthority timeAuthority;
    private final UnlockProperties properties;

    public DeviceService(DeviceRepository deviceRepository, RefreshTokenService refreshTokenService,
                         AuditService auditService, TimeAuthority timeAuthority, UnlockProperties properties) {
        this.deviceRepository = deviceRepository;
        this.refreshTokenService = refreshTokenService;
        this.auditService = auditService;
        this.timeAuthority = timeAuthority;
        this.properties = properties;
    }

    @Transactional
    public Device register(Account account, String deviceInstallId, DevicePlatform platform, String label,
                           String timeZone, String appVersion, String osVersion) {
        return deviceRepository.findByAccountIdAndDeviceInstallId(account.getId(), deviceInstallId)
                .map(existing -> {
                    existing.refreshRegistration(label, timeZone, appVersion, osVersion, timeAuthority.now());
                    return existing;
                })
                .orElseGet(() -> {
                    long active = deviceRepository.countByAccountIdAndStatus(account.getId(), DeviceStatus.ACTIVE);
                    if (active >= properties.maxDevicesPerAccount()) {
                        throw new ConflictException("limite de dispositivos atingido");
                    }
                    Device device = deviceRepository.save(new Device(account, deviceInstallId, platform, label,
                            timeZone, appVersion, osVersion, timeAuthority.now()));
                    auditService.recordServerEvent(account, device, AuditEventType.DEVICE_REGISTERED, null);
                    return device;
                });
    }

    @Transactional
    public void revoke(Account account, UUID deviceId) {
        Device device = deviceRepository.findByIdAndAccountId(deviceId, account.getId())
                .orElseThrow(() -> new NotFoundException("device nao encontrado"));
        device.revoke();
        refreshTokenService.revokeDevice(device);
        auditService.recordServerEvent(account, device, AuditEventType.AUTHORIZATION_REVOKED, null);
    }

    @Transactional
    public void updatePushToken(Device device, String token, PushProvider provider) {
        device.updatePushToken(token, provider);
    }
}
