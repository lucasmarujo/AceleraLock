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
    val allowReason: AllowReason? = null,
    /** Preenchido so quando o motivo do bloqueio e o site aberto, nao o app. */
    val blockedHost: String? = null
) {
    val shouldDrawOverlay: Boolean get() = outcome == BlockOutcome.BLOCK
}

/**
 * O que a barra de endereco de um navegador mostrava, e de qual navegador. O pacote
 * vem junto porque a leitura e assincrona a deteccao de primeiro plano: endereco
 * lido no Chrome nao pode bloquear o app que a pessoa abriu depois.
 */
data class BrowserAddress(val packageName: String, val text: String)

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
        activeGrant: String?,
        browserAddress: BrowserAddress? = null
    ): BlockVerdict {
        if (packageName in criticalPackages) {
            return BlockVerdict(BlockOutcome.ALLOW, AllowReason.CRITICAL_APP)
        }
        // Antes da concessao, de proposito: concessao e do navegador como app, e
        // liberar o Chrome nao pode virar liberar todo site da lista.
        val blockedHost = browserAddress
            ?.takeIf { it.packageName == packageName }
            ?.let { SiteMatcher.hostOf(it.text) }
            ?.takeIf { SiteMatcher.blocks(it, policy.blockedDomains) }
        if (blockedHost != null) {
            return BlockVerdict(BlockOutcome.BLOCK, blockedHost = blockedHost)
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
