package com.aceleralock.profile;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface BlockProfileRepository extends JpaRepository<BlockProfile, UUID> {

    List<BlockProfile> findByAccountId(UUID accountId);

    Optional<BlockProfile> findByIdAndAccountId(UUID id, UUID accountId);
}
