package com.aceleralock.blocker.core

import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test
import java.time.Instant
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class PolicyReaderTest {

    private val instagram = "com.instagram.android"
    private val tiktok = "com.zhiliaoapp.musically"
    private val fimValido = "2026-08-31T12:00:00Z"

    @Test
    @DisplayName("borda: sem politica salva e Absent, nao politica vazia")
    fun absentWhenNothingStored() {
        val read = PolicyReader.read(null) { error("nao deveria extrair nada") }

        assertEquals(PolicyRead.Absent, read)
    }

    @Test
    @DisplayName("feliz: politica valida carrega alvos e grants, sem descarte")
    fun loadsValidPolicy() {
        val read = PolicyReader.read("qualquer") {
            RawPolicy(listOf(instagram, tiktok), listOf(RawGrant(instagram, fimValido)))
        }

        val loaded = read as PolicyRead.Loaded
        assertEquals(setOf(instagram, tiktok), loaded.policy.blockedPackages)
        assertEquals(listOf(TemporaryGrant(instagram, Instant.parse(fimValido))), loaded.policy.grants)
        assertEquals(0, loaded.discardedGrants)
    }

    @Test
    @DisplayName("regressao: um grant podre descarta so ele, nunca a lista de bloqueados")
    fun rottenGrantDoesNotCostTheBlockList() {
        val read = PolicyReader.read("qualquer") {
            RawPolicy(
                listOf(instagram, tiktok),
                listOf(
                    RawGrant(instagram, fimValido),
                    RawGrant(tiktok, "isto-nao-e-um-instante"),
                    RawGrant(null, fimValido)
                )
            )
        }

        val loaded = read as PolicyRead.Loaded
        assertEquals(setOf(instagram, tiktok), loaded.policy.blockedPackages)
        assertEquals(listOf(TemporaryGrant(instagram, Instant.parse(fimValido))), loaded.policy.grants)
        assertEquals(2, loaded.discardedGrants)
    }

    @Test
    @DisplayName("borda: todos os grants podres mantem os alvos bloqueados e nenhuma concessao")
    fun allGrantsRottenKeepsProtection() {
        val read = PolicyReader.read("qualquer") {
            RawPolicy(listOf(instagram), listOf(RawGrant(instagram, "ontem"), RawGrant("  ", fimValido)))
        }

        val loaded = read as PolicyRead.Loaded
        assertEquals(setOf(instagram), loaded.policy.blockedPackages)
        assertTrue(loaded.policy.grants.isEmpty())
        assertEquals(2, loaded.discardedGrants)
    }

    @Test
    @DisplayName("erro: politica inteira ilegivel e Unreadable, nao politica vazia")
    fun unreadableWhenSyntaxFails() {
        val read = PolicyReader.read("{ isto nao e json") { error("sintaxe invalida") }

        assertEquals(PolicyRead.Unreadable, read)
    }
}
