package com.aceleralock.blocker.core

import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class BlockPolicyTest {

    private val instagram = "com.instagram.android"
    private val tiktok = "com.zhiliaoapp.musically"

    @Test
    @DisplayName("feliz: RawPolicy carrega restricted quando presente")
    fun loadsRestrictedWhenPresent() {
        val read = PolicyReader.read("qualquer") {
            RawPolicy(blockedPackages = listOf(instagram), restricted = true)
        }

        val loaded = read as PolicyRead.Loaded
        assertTrue(loaded.policy.restricted)
        assertEquals(setOf(instagram), loaded.policy.blockedPackages)
    }

    @Test
    @DisplayName("borda: RawPolicy sem restricted e tratado como false, nao como ausente")
    fun missingRestrictedDefaultsToFalse() {
        val read = PolicyReader.read("qualquer") {
            RawPolicy(blockedPackages = listOf(instagram, tiktok))
        }

        val loaded = read as PolicyRead.Loaded
        assertFalse(loaded.policy.restricted, "campo ausente nao pode virar true por acidente")
        assertEquals(setOf(instagram, tiktok), loaded.policy.blockedPackages)
    }

    @Test
    @DisplayName("feliz: politica default (sem configuracao) vem com restricted = false")
    fun defaultPolicyHasRestrictedFalse() {
        assertFalse(BlockPolicy().restricted)
        assertFalse(BlockPolicy(blockedPackages = setOf(instagram)).restricted)
    }

    private val faixa = ExceptionWindow(setOf(java.time.DayOfWeek.MONDAY), 720, 780)

    @Test
    @DisplayName("regressao: tirar o app da lista apaga o horario livre dele")
    fun removingTargetDropsItsExceptions() {
        val politica = BlockPolicy(setOf("a", "b"), exceptions = mapOf("a" to listOf(faixa), "b" to listOf(faixa)))

        val depois = politica.withBlockedPackages(setOf("b"))

        assertEquals(setOf("b"), depois.exceptions.keys)
    }

    @Test
    @DisplayName("feliz: gravar faixas de um app bloqueado e apagar com lista vazia")
    fun setsAndClearsExceptions() {
        val politica = BlockPolicy(setOf("a")).withExceptions("a", listOf(faixa))
        assertEquals(listOf(faixa), politica.exceptions["a"])

        assertFalse("a" in politica.withExceptions("a", emptyList()).exceptions)
    }

    @Test
    @DisplayName("barreira: horario livre para app fora da lista e recusado")
    fun rejectsExceptionForNonTarget() {
        assertFailsWith<IllegalArgumentException> {
            BlockPolicy(setOf("a")).withExceptions("b", listOf(faixa))
        }
    }

    @Test
    @DisplayName("validacao: faixa invalida e recusada sem gravar nada")
    fun rejectsInvalidWindow() {
        assertFailsWith<IllegalArgumentException> {
            BlockPolicy(setOf("a")).withExceptions("a", listOf(faixa.copy(endMinute = 720)))
        }
    }
}
