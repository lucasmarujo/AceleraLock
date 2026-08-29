package com.aceleralock.unlock;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface UnlockRequestRepository extends JpaRepository<UnlockRequest, UUID> {

    @Query("select r from UnlockRequest r where r.device.id = :deviceId and r.target.id = :targetId "
            + "and r.status in (com.aceleralock.unlock.UnlockRequestStatus.PENDING, "
            + "com.aceleralock.unlock.UnlockRequestStatus.GRANTED)")
    Optional<UnlockRequest> findOpenByDeviceAndTarget(@Param("deviceId") UUID deviceId,
                                                      @Param("targetId") UUID targetId);

    @Query("select r from UnlockRequest r where r.device.id = :deviceId "
            + "and r.status in (com.aceleralock.unlock.UnlockRequestStatus.PENDING, "
            + "com.aceleralock.unlock.UnlockRequestStatus.GRANTED)")
    List<UnlockRequest> findOpenByDevice(@Param("deviceId") UUID deviceId);

    @Query("select r from UnlockRequest r where r.partnerLink.partnerAccount.id = :partnerAccountId "
            + "and r.status = com.aceleralock.unlock.UnlockRequestStatus.PENDING")
    List<UnlockRequest> findPendingForPartner(@Param("partnerAccountId") UUID partnerAccountId);

    List<UnlockRequest> findByAccountId(UUID accountId);
}
