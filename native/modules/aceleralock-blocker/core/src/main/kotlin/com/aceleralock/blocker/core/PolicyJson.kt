package com.aceleralock.blocker.core

/**
 * Parser minimo do JSON persistido, sem `org.json` (Android-only) e sem
 * dependencia nova no `core/`. O formato e proprio do app: tres campos
 * (`blockedPackages` e `blockedDomains` arrays de strings, `restricted` boolean)
 * e nada mais.
 *
 * Extracao pura para que o contrato "o que vai pro disco e o que sai dele"
 * tenha teste em JVM (AGENTS.md §2). O adaptador Android entrega a string
 * e usa o `RawPolicy` resultante; qualquer mudanca de formato cai no teste.
 */
object PolicyJson {

    fun parse(raw: String): RawPolicy {
        val limpo = raw.trim()
        // Fechamento e tao obrigatorio quanto abertura: sem checar o `}`, um
        // arquivo truncado pela metade passaria por politica valida e o
        // PolicyReader nunca viraria Unreadable.
        require(limpo.startsWith("{") && limpo.endsWith("}") && limpo.length >= 2) {
            "politica nao parece JSON"
        }
        val blocked = readStringArray(raw, "blockedPackages")
        val restricted = readBoolean(raw, "restricted")
        val domains = readStringArray(raw, "blockedDomains")
        return RawPolicy(blockedPackages = blocked, restricted = restricted, blockedDomains = domains)
    }

    private fun readStringArray(raw: String, key: String): List<String> {
        val arrStart = raw.indexOf("\"$key\"")
        if (arrStart < 0) return emptyList()
        val bracketOpen = raw.indexOf('[', arrStart)
        val bracketClose = raw.indexOf(']', bracketOpen)
        if (bracketOpen < 0 || bracketClose < 0) return emptyList()
        val inside = raw.substring(bracketOpen + 1, bracketClose)
        // groupValues[1] e o conteudo sem as aspas delimitadoras. `it.value`
        // traria o par de aspas junto, e um package name com aspas nunca casa
        // com o pacote em foco — o bloqueio inteiro passaria batido.
        return REGEX_STRING.findAll(inside).map { it.groupValues[1] }.toList()
    }

    private fun readBoolean(raw: String, key: String): Boolean {
        val keyStart = raw.indexOf("\"$key\"")
        if (keyStart < 0) return false
        val colon = raw.indexOf(':', keyStart)
        if (colon < 0) return false
        val tail = raw.substring(colon + 1).trimStart()
        return tail.startsWith("true")
    }

    // O grupo externo captura o conteudo; o interno so repete o alternador. Sem
    // o externo nao ha como pegar a string sem as aspas, porque o `*` fica fora
    // do grupo e groupValues[1] traria apenas o ultimo caractere.
    // Escape nao e desfeito: package name Android e [a-zA-Z0-9._] e dominio chega
    // normalizado por SiteMatcher ([a-z0-9.-]), nenhum carrega aspas, barra ou barra
    // invertida. Formato com texto livre exigiria unescape aqui.
    private val REGEX_STRING = Regex("\"(([^\"\\\\]|\\\\.)*)\"")
}