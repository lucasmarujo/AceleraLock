package com.aceleralock.device;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DeviceRepository extends JpaRepository<Device, UUID> {

    Optional<Device> findByAccountIdAndDeviceInstallId(UUID accountId, String deviceInstallId);

    Optional<Device> findByIdAndAccountId(UUID id, UUID accountId);

    List<Device> findByAccountId(UUID accountId);

    List<Device> findByAccountIdAndStatus(UUID accountId, DeviceStatus status);

    long countByAccountIdAndStatus(UUID accountId, DeviceStatus status);
}
