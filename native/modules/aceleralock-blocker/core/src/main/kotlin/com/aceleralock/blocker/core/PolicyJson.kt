package com.aceleralock.blocker.core

/**
 * Parser minimo do JSON persistido, sem `org.json` (Android-only) e sem
 * dependencia nova no `core/`. O formato e proprio do app: dois campos
 * (`blockedPackages` array de strings, `restricted` boolean) e nada mais.
 *
 * Extracao pura para que o contrato "o que vai pro disco e o que sai dele"
 * tenha teste em JVM (AGENTS.md §2). O adaptador Android entrega a string
 * e usa o `RawPolicy` resultante; qualquer mudanca de formato cai no teste.
 */
internal object PolicyJson {

    fun parse(raw: String): RawPolicy {
        require(raw.isNotBlank() && raw.trimStart().startsWith("{")) {
            "politica nao parece JSON"
        }
        val blocked = readStringArray(raw, "blockedPackages")
        val restricted = readBoolean(raw, "restricted")
        return RawPolicy(blockedPackages = blocked, restricted = restricted)
    }

    private fun readStringArray(raw: String, key: String): List<String> {
        val arrStart = raw.indexOf("\"$key\"")
        if (arrStart < 0) return emptyList()
        val bracketOpen = raw.indexOf('[', arrStart)
        val bracketClose = raw.indexOf(']', bracketOpen)
        if (bracketOpen < 0 || bracketClose < 0) return emptyList()
        val inside = raw.substring(bracketOpen + 1, bracketClose)
        return REGEX_STRING.findAll(inside).map { it.value }.toList()
    }

    private fun readBoolean(raw: String, key: String): Boolean {
        val keyStart = raw.indexOf("\"$key\"")
        if (keyStart < 0) return false
        val colon = raw.indexOf(':', keyStart)
        if (colon < 0) return false
        val tail = raw.substring(colon + 1).trimStart()
        return tail.startsWith("true")
    }

    private val REGEX_STRING = Regex("\"([^\"\\\\]|\\\\.)*\"")
}