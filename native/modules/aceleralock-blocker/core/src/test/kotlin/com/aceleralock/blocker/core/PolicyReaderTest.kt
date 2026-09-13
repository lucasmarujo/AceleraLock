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
}
