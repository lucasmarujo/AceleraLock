package com.aceleralock.partner;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PartnerLinkRepository extends JpaRepository<PartnerLink, UUID> {

    Optional<PartnerLink> findByInviteCodeHash(byte[] inviteCodeHash);

    Optional<PartnerLink> findByOwnerAccountIdAndStatus(UUID ownerAccountId, PartnerLinkStatus status);

    List<PartnerLink> findByPartnerAccountIdAndStatus(UUID partnerAccountId, PartnerLinkStatus status);

    boolean existsByOwnerAccountIdAndPartnerAccountIdAndStatus(UUID ownerAccountId, UUID partnerAccountId,
                                                              PartnerLinkStatus status);

    @org.springframework.data.jpa.repository.Modifying(clearAutomatically = true, flushAutomatically = true)
    @org.springframework.data.jpa.repository.Query(
            "delete from PartnerLink l where l.ownerAccount.id = :accountId or l.partnerAccount.id = :accountId")
    void deleteAllTouchingAccount(@org.springframework.data.repository.query.Param("accountId") UUID accountId);
}
