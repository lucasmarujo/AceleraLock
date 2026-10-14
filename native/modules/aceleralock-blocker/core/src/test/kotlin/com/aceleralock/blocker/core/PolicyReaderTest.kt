package com.aceleralock.blocker.core

import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test
import kotlin.test.assertEquals

class PolicyReaderTest {

    private val instagram = "com.instagram.android"
    private val tiktok = "com.zhiliaoapp.musically"

    @Test
    @DisplayName("borda: sem politica salva e Absent, nao politica vazia")
    fun absentWhenNothingStored() {
        val read = PolicyReader.read(null) { error("nao deveria extrair nada") }

        assertEquals(PolicyRead.Absent, read)
    }

    @Test
    @DisplayName("feliz: politica valida carrega os alvos")
    fun loadsValidPolicy() {
        val read = PolicyReader.read("qualquer") { RawPolicy(listOf(instagram, tiktok)) }

        val loaded = read as PolicyRead.Loaded
        assertEquals(setOf(instagram, tiktok), loaded.policy.blockedPackages)
    }

    @Test
    @DisplayName("feliz: politica valida carrega os dominios bloqueados")
    fun loadsBlockedDomains() {
        val read = PolicyReader.read("qualquer") {
            RawPolicy(emptyList(), blockedDomains = listOf("instagram.com", "instagram.com"))
        }

        val loaded = read as PolicyRead.Loaded
        assertEquals(setOf("instagram.com"), loaded.policy.blockedDomains)
    }

    @Test
    @DisplayName("erro: politica inteira ilegivel e Unreadable, nao politica vazia")
    fun unreadableWhenSyntaxFails() {
        val read = PolicyReader.read("{ isto nao e json") { error("sintaxe invalida") }

        assertEquals(PolicyRead.Unreadable, read)
    }

    @Test
    @DisplayName("feliz: horario livre codificado chega decodificado na politica")
    fun loadsExceptions() {
        val read = PolicyReader.read("qualquer") {
            RawPolicy(listOf(instagram), exceptions = listOf("$instagram|1,2,3,4,5|720|780"))
        }

        val politica = (read as PolicyRead.Loaded).policy
        assertEquals(
            listOf(ExceptionWindow(setOf(1, 2, 3, 4, 5).map(java.time.DayOfWeek::of).toSet(), 720, 780)),
            politica.exceptions[instagram]
        )
    }

    @Test
    @DisplayName("barreira: faixa malformada cai sozinha e a lista de alvos continua valendo")
    fun malformedExceptionIsDroppedNotTheWholePolicy() {
        val read = PolicyReader.read("qualquer") {
            RawPolicy(listOf(instagram), exceptions = listOf("$instagram|9|720|780", "lixo"))
        }

        val politica = (read as PolicyRead.Loaded).policy
        assertEquals(setOf(instagram), politica.blockedPackages)
        assertEquals(emptyMap(), politica.exceptions)
    }

    @Test
    @DisplayName("barreira: faixa de app fora da lista nao entra na politica")
    fun exceptionForNonTargetIsIgnored() {
        val read = PolicyReader.read("qualquer") {
            RawPolicy(listOf(instagram), exceptions = listOf("$tiktok|1|720|780"))
        }

        assertEquals(emptyMap(), (read as PolicyRead.Loaded).policy.exceptions)
    }

    @Test
    @DisplayName("borda: mais faixas que o teto guardadas no disco ficam so ate o teto")
    fun storedExceptionsAreCapped() {
        val muitas = (0 until 12).map { "$instagram|1|${it * 60}|${it * 60 + 30}" }

        val read = PolicyReader.read("qualquer") { RawPolicy(listOf(instagram), exceptions = muitas) }

        assertEquals(
            ScheduleExceptions.MAX_WINDOWS_PER_APP,
            (read as PolicyRead.Loaded).policy.exceptions.getValue(instagram).size
        )
    }
}
