package com.aceleralock.blocker.core

/**
 * Regra de site bloqueado: dominio cobre ele mesmo e todos os subdominios. Caminho
 * de URL fica de fora de proposito — o filtro do iOS so enxerga dominio, e a barra
 * do navegador no Android costuma mostrar so o dominio quando nao esta em foco.
 *
 * `hostOf` serve as duas pontas: normaliza o que a pessoa digitou antes de gravar
 * e o texto da barra de endereco antes de comparar. Mesma funcao nos dois lados e
 * o que garante que `www.instagram.com` salvo bloqueia `instagram.com` aberto.
 * `src/state/blockedSites.ts` repete a regra para o feedback da UI; os testes dos
 * dois lados usam a mesma tabela de casos.
 */
object SiteMatcher {

    fun hostOf(texto: String): String? {
        val limpo = texto.trim().lowercase()
        // Texto com espaco e busca, nao endereco: o Chrome mostra os termos na barra.
        if (limpo.any { it.isWhitespace() }) return null
        val host = limpo
            .replaceFirst(ESQUEMA, "")
            .substringBefore('/')
            .substringBefore('?')
            .substringBefore('#')
            .substringAfterLast('@')
            .substringBefore(':')
            .removePrefix("www.")
        return host.takeIf { HOST.matches(it) }
    }

    fun blocks(host: String, domains: Set<String>): Boolean =
        domains.any { host == it || host.endsWith(".$it") }

    private val ESQUEMA = Regex("^[a-z][a-z0-9+.-]*://")
    private val HOST = Regex("^([a-z0-9]([a-z0-9-]*[a-z0-9])?\\.)+[a-z0-9]([a-z0-9-]*[a-z0-9])?$")
}
