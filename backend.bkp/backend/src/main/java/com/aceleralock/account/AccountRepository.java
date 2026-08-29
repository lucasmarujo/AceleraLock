package com.aceleralock.account;

import com.aceleralock.auth.IdentityProvider;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface AccountRepository extends JpaRepository<Account, UUID> {

    Optional<Account> findByProviderAndExternalSubject(IdentityProvider provider, String externalSubject);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update Account a set a.syncVersion = a.syncVersion + 1 where a.id = :accountId")
    void incrementSyncVersion(@Param("accountId") UUID accountId);

    @Query("select a.syncVersion from Account a where a.id = :accountId")
    long findSyncVersion(@Param("accountId") UUID accountId);
}
