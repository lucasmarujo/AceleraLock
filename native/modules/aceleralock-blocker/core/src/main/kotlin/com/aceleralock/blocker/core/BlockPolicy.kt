package com.aceleralock.blocker.core

import java.time.Instant

data class TemporaryGrant(val packageName: String, val grantEndsAt: Instant)

data class BlockPolicy(
    val blockedPackages: Set<String> = emptySet(),
    val grants: List<TemporaryGrant> = emptyList()
)
