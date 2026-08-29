package com.aceleralock.blocker.core

/**
 * A politica e so a lista de alvos. A concessao ativa NAO mora aqui, de proposito:
 * concessao guardada em politica persistida vira registro historico, e registro
 * historico de liberacao e uma chave que nao expira. Ver [GrantWindow].
 */
data class BlockPolicy(
    val blockedPackages: Set<String> = emptySet()
)
