package com.aceleralock.blocker.core

data class RawPolicy(
    val blockedPackages: List<String>,
    /**
     * Ausente na politica persistida conta como `false`: instalacao nova e politica
     * salva antes deste campo existir dao o mesmo default. `true` so com opt-in
     * explicito, porque o modo restrito e a chave que tranca a edicao da lista.
     */
    val restricted: Boolean = false
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
        return PolicyRead.Loaded(
            BlockPolicy(
                blockedPackages = parsed.blockedPackages.toSet(),
                restricted = parsed.restricted
            )
        )
    }
}
