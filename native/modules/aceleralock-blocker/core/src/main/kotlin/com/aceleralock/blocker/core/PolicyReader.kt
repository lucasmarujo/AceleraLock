package com.aceleralock.blocker.core

data class RawPolicy(
    val blockedPackages: List<String>,
    /**
     * Ausente na politica persistida conta como `false`: instalacao nova e politica
     * salva antes deste campo existir dao o mesmo default. `true` so com opt-in
     * explicito, porque o modo restrito e a chave que tranca a edicao da lista.
     */
    val restricted: Boolean = false,
    /** Ausente conta como lista vazia: politica salva antes dos sites existirem. */
    val blockedDomains: List<String> = emptyList(),
    /** Faixas codificadas por [ScheduleExceptions.encode]. Ausente conta como nenhuma. */
    val exceptions: List<String> = emptyList()
)

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

    data class Loaded(val policy: BlockPolicy) : PolicyRead

    data object Unreadable : PolicyRead
}

/**
 * Regra de leitura, separada da sintaxe. O adaptador entrega a string crua e um
 * extrator (no Android, JSONObject; org.json e do SDK e nao existe neste modulo,
 * que e Kotlin puro). Tudo que e decisao vive aqui, onde tem teste em JVM.
 */
object PolicyReader {

    fun read(raw: String?, extract: (String) -> RawPolicy): PolicyRead {
        if (raw == null) {
            return PolicyRead.Absent
        }
        val parsed = runCatching { extract(raw) }.getOrElse { return PolicyRead.Unreadable }
        val blocked = parsed.blockedPackages.toSet()
        return PolicyRead.Loaded(
            BlockPolicy(
                blockedPackages = blocked,
                restricted = parsed.restricted,
                blockedDomains = parsed.blockedDomains.toSet(),
                exceptions = readExceptions(parsed.exceptions, blocked)
            )
        )
    }

    /**
     * Faixa malformada e descartada sozinha, sem derrubar a politica inteira: perder
     * um horario livre so bloqueia mais, e marcar tudo como ilegivel faria o servico
     * ignorar uma lista de alvos que esta perfeitamente legivel. Pelo mesmo motivo,
     * faixa de app fora da lista e o que passa do teto nao entram.
     */
    private fun readExceptions(
        encoded: List<String>,
        blocked: Set<String>
    ): Map<String, List<ExceptionWindow>> =
        encoded
            .mapNotNull(ScheduleExceptions::decode)
            .filter { (pacote, _) -> pacote in blocked }
            .groupBy({ it.first }, { it.second })
            .mapValues { (_, faixas) ->
                faixas.distinct().take(ScheduleExceptions.MAX_WINDOWS_PER_APP)
            }
}
