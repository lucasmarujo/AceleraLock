package com.aceleralock.device;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface BlockTargetRepository extends JpaRepository<BlockTarget, UUID> {

    List<BlockTarget> findByDeviceId(UUID deviceId);

    Optional<BlockTarget> findByDeviceIdAndClientRef(UUID deviceId, String clientRef);

    Optional<BlockTarget> findByIdAndDeviceId(UUID id, UUID deviceId);

    List<BlockTarget> findByDeviceIdAndIdIn(UUID deviceId, Collection<UUID> ids);
}
