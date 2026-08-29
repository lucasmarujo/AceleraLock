package com.aceleralock.config;

import com.aceleralock.auth.AuthenticatedCaller;
import com.aceleralock.common.NotFoundException;
import com.aceleralock.device.Device;
import com.aceleralock.device.DeviceRepository;
import com.aceleralock.device.DeviceStatus;
import com.aceleralock.time.TimeAuthority;
import org.springframework.stereotype.Component;

import java.util.UUID;

@Component
public class DeviceAccessGuard {

    private final DeviceRepository deviceRepository;
    private final TimeAuthority timeAuthority;

    public DeviceAccessGuard(DeviceRepository deviceRepository, TimeAuthority timeAuthority) {
        this.deviceRepository = deviceRepository;
        this.timeAuthority = timeAuthority;
    }

    public Device require(AuthenticatedCaller caller, UUID deviceId) {
        Device device = requireUntouched(caller, deviceId);
        device.touch(timeAuthority.now());
        return device;
    }

    public Device requireUntouched(AuthenticatedCaller caller, UUID deviceId) {
        if (caller.deviceId() == null || !caller.deviceId().equals(deviceId)) {
            throw new NotFoundException("device nao encontrado");
        }
        Device device = deviceRepository.findByIdAndAccountId(deviceId, caller.accountId())
                .orElseThrow(() -> new NotFoundException("device nao encontrado"));
        if (device.getStatus() != DeviceStatus.ACTIVE) {
            throw new NotFoundException("device nao encontrado");
        }
        return device;
    }
}
