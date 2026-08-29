package com.aceleralock.blocker.core

import java.time.Instant

enum class BlockOutcome {
    BLOCK,
    ALLOW
}

enum class AllowReason {
    NOT_A_TARGET,
    CRITICAL_APP,
    ACTIVE_GRANT,
    OUTSIDE_WINDOW
}

data class BlockVerdict(
    val outcome: BlockOutcome,
    val allowReason: AllowReason? = null,
    val unanchored: Boolean = false
) {
    val shouldDrawOverlay: Boolean get() = outcome == BlockOutcome.BLOCK
}

class BlockDecider(private val correctedClock: CorrectedClock) {

    fun decide(
        packageName: String,
        policy: BlockPolicy,
        criticalPackages: Set<String>
    ): BlockVerdict {
        if (packageName in criticalPackages) {
            return BlockVerdict(BlockOutcome.ALLOW, AllowReason.CRITICAL_APP)
        }
        if (packageName !in policy.allTargetPackages()) {
            return BlockVerdict(BlockOutcome.ALLOW, AllowReason.NOT_A_TARGET)
        }

        return when (val now = correctedClock.now()) {
            is CorrectedTime.Unanchored ->
                BlockVerdict(BlockOutcome.BLOCK, unanchored = true)

            is CorrectedTime.Anchored -> decideAnchored(packageName, policy, now.instant)
        }
    }

    private fun decideAnchored(packageName: String, policy: BlockPolicy, now: Instant): BlockVerdict {
        val granted = policy.grants.any { it.packageName == packageName && !now.isAfter(it.grantEndsAt) }
        if (granted) {
            return BlockVerdict(BlockOutcome.ALLOW, AllowReason.ACTIVE_GRANT)
        }
        val insideWindow = policy.profiles.any { profile ->
            packageName in profile.targetPackages && profile.isActiveAt(now)
        }
        return if (insideWindow) {
            BlockVerdict(BlockOutcome.BLOCK)
        } else {
            BlockVerdict(BlockOutcome.ALLOW, AllowReason.OUTSIDE_WINDOW)
        }
    }
}
