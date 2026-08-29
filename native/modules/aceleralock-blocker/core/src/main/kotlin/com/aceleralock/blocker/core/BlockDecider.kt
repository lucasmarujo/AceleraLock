package com.aceleralock.blocker.core

import java.time.Instant

enum class BlockOutcome {
    BLOCK,
    ALLOW
}

enum class AllowReason {
    NOT_A_TARGET,
    CRITICAL_APP,
    ACTIVE_GRANT
}

data class BlockVerdict(
    val outcome: BlockOutcome,
    val allowReason: AllowReason? = null
) {
    val shouldDrawOverlay: Boolean get() = outcome == BlockOutcome.BLOCK
}

fun interface Clock {
    fun now(): Instant
}

/**
 * Decisao de bloqueio. Sem ancora de servidor: o tempo e o do aparelho, e o user
 * que adianta o relogio tambem fura o bloqueio. Sem servidor, nao ha defesa melhor
 * (a CorrectedClock original ancorava em serverTime — sem server, nao ha o que
 * ancorar). Quando voltar a ter backend, reintroduzir defesa aqui.
 */
class BlockDecider(private val clock: Clock) {

    fun decide(
        packageName: String,
        policy: BlockPolicy,
        criticalPackages: Set<String>
    ): BlockVerdict {
        if (packageName in criticalPackages) {
            return BlockVerdict(BlockOutcome.ALLOW, AllowReason.CRITICAL_APP)
        }
        if (packageName !in policy.blockedPackages) {
            return BlockVerdict(BlockOutcome.ALLOW, AllowReason.NOT_A_TARGET)
        }
        val now = clock.now()
        val granted = policy.grants.any { it.packageName == packageName && now.isBefore(it.grantEndsAt) }
        return if (granted) {
            BlockVerdict(BlockOutcome.ALLOW, AllowReason.ACTIVE_GRANT)
        } else {
            BlockVerdict(BlockOutcome.BLOCK)
        }
    }
}
