package com.aceleralock.blocker.core

import java.time.Instant

data class RawGrant(val packageName: String?, val grantEndsAt: String?)

data class RawPolicy(val blockedPackages: List<String>, val grants: List<RawGrant>)

/**
 * Os tres estados possiveis da leitura da politica persistida, distintos de
 * proposito: ate aqui "nunca configurou" e "nao consegui ler" devolviam a mesma
 * BlockPolicy vazia, e quem chamava nao tinha como saber se nada estava bloqueado
 * ou se a protecao tinha sumido.
 *
 * A diferenca nao e cosmetica: Absent e o caso legitimo da instalacao nova, em que
 * bloquear seria travar o aparelho; Unreadable e perda de protecao, e quem chama
 * precisa tratar.
 */
sealed interface PolicyRead {

    data object Absent : PolicyRead

    data class Loaded(val policy: BlockPolicy, val discardedGrants: Int) : PolicyRead

    data object Unreadable : PolicyRead
}

/**
 * Regra de leitura, separada da sintaxe. O adaptador entrega a string crua e um
 * extrator (no Android, JSONObject; org.json e do SDK e nao existe neste modulo,
 * que e Kotlin puro). Tudo que e decisao — os tres estados, e o que fazer com dado
 * corrompido — vive aqui, onde tem teste em JVM.
 *
 * Grant ilegivel descarta **so aquele grant**: o conservador e nao conceder, e um
 * grant podre nao pode custar a lista de bloqueados junto.
 */
object PolicyReader {

    fun read(raw: String?, extract: (String) -> RawPolicy): PolicyRead {
        if (raw == null) {
            return PolicyRead.Absent
        }
        val parsed = runCatching { extract(raw) }.getOrElse { return PolicyRead.Unreadable }
        val valid = parsed.grants.mapNotNull(::toGrant)
        return PolicyRead.Loaded(
            BlockPolicy(blockedPackages = parsed.blockedPackages.toSet(), grants = valid),
            discardedGrants = parsed.grants.size - valid.size
        )
    }

    private fun toGrant(raw: RawGrant): TemporaryGrant? {
        val packageName = raw.packageName?.takeIf { it.isNotBlank() } ?: return null
        val endsAt = raw.grantEndsAt ?: return null
        return runCatching { TemporaryGrant(packageName, Instant.parse(endsAt)) }.getOrNull()
    }
}
