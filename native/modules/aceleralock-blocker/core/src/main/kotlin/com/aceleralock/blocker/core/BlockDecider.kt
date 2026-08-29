package com.aceleralock.blocker.core

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

/**
 * Decisao de bloqueio. Sem ancora de servidor: nao ha com que ancorar. Mas nao ha
 * relogio de parede nenhum aqui — a concessao chega ja resolvida por [GrantWindow],
 * que desconta saldo monotonico. Atrasar a hora do aparelho nao estica concessao e
 * nao ressuscita concessao encerrada, porque nao existe instante de fim para
 * comparar.
 *
 * O teto continua sendo desinstalar, e contra isso nao ha defesa sem Device Admin.
 */
class BlockDecider {

    fun decide(
        packageName: String,
        policy: BlockPolicy,
        criticalPackages: Set<String>,
        activeGrant: String?
    ): BlockVerdict {
        if (packageName in criticalPackages) {
            return BlockVerdict(BlockOutcome.ALLOW, AllowReason.CRITICAL_APP)
        }
        if (packageName !in policy.blockedPackages) {
            return BlockVerdict(BlockOutcome.ALLOW, AllowReason.NOT_A_TARGET)
        }
        return if (packageName == activeGrant) {
            BlockVerdict(BlockOutcome.ALLOW, AllowReason.ACTIVE_GRANT)
        } else {
            BlockVerdict(BlockOutcome.BLOCK)
        }
    }
}
