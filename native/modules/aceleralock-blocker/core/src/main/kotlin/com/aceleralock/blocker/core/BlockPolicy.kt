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
 *
 * Horario livre e configuracao, nao concessao: e a pessoa dizendo quando o bloqueio
 * vale, e nao guarda instante nenhum de liberacao. Por isso pode morar aqui.
 */
data class BlockPolicy(
    val blockedPackages: Set<String> = emptySet(),
    val restricted: Boolean = false,
    /** Ja normalizados por [SiteMatcher.hostOf]. Ver [SiteMatcher]. */
    val blockedDomains: Set<String> = emptySet(),
    /** Horarios livres por pacote. So existe para pacote que esta em [blockedPackages]. */
    val exceptions: Map<String, List<ExceptionWindow>> = emptyMap()
) {

    /**
     * Troca a lista de alvos e descarta as faixas de quem saiu dela. Sem isto, tirar
     * um app e bota-lo de volta meses depois traria horario livre que a pessoa nem
     * lembra que configurou.
     */
    fun withBlockedPackages(packages: Set<String>): BlockPolicy =
        copy(blockedPackages = packages, exceptions = exceptions.filterKeys { it in packages })

    /**
     * Grava as faixas de um app. Lista vazia apaga. Recusa app fora da lista e lista
     * invalida — ver [ScheduleExceptions.sanitize].
     */
    fun withExceptions(packageName: String, windows: List<ExceptionWindow>): BlockPolicy {
        require(packageName in blockedPackages) { "horario livre so existe para app bloqueado" }
        val validas = requireNotNull(ScheduleExceptions.sanitize(windows)) {
            "faixa de horario invalida"
        }
        return copy(
            exceptions = if (validas.isEmpty()) {
                exceptions - packageName
            } else {
                exceptions + (packageName to validas)
            }
        )
    }
}
