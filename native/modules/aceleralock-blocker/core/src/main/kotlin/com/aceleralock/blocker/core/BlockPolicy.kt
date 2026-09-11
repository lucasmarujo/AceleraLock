package com.aceleralock.blocker.core

/**
 * A politica persistida. Lista de alvos + flag do modo restrito. A concessao ativa
 * NAO mora aqui, de proposito: concessao guardada em politica persistida vira
 * registro historico, e registro historico de liberacao e uma chave que nao expira.
 * Ver [GrantWindow].
 *
 * O modo restrito mora aqui, e nao em `KeyValueStore` proprio, pelo mesmo motivo
 * de "fonte unica e o nativo" do JS: a configuracao do bloqueio vive toda no mesmo
 * arquivo, e politica ilegivel continua recusando gravacao em vez de aceitar um
 * apagamento silencioso. Ativar/desativar via a mesma `currentPolicy()` que a lista.
 */
data class BlockPolicy(
    val blockedPackages: Set<String> = emptySet(),
    val restricted: Boolean = false
)
