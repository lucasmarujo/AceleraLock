package com.aceleralock.blocker.core

import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class PolicyJsonTest {

    private val instagram = "com.instagram.android"

    @Test
    @DisplayName("feliz: parseia restricted = true quando o campo esta no JSON")
    fun parsesRestrictedTrue() {
        val raw = """{"blockedPackages":["$instagram"],"restricted":true}"""
        val parsed = PolicyJson.parse(raw)
        assertTrue(parsed.restricted)
        assertEquals(listOf(instagram), parsed.blockedPackages)
    }

    @Test
    @DisplayName("feliz: parseia restricted = false quando o campo esta explicito")
    fun parsesRestrictedFalse() {
        val raw = """{"blockedPackages":[],"restricted":false}"""
        val parsed = PolicyJson.parse(raw)
        assertFalse(parsed.restricted)
        assertEquals(emptyList(), parsed.blockedPackages)
    }

    @Test
    @DisplayName("borda: campo restricted ausente conta como false (instalacao antiga)")
    fun missingRestrictedDefaultsToFalse() {
        val raw = """{"blockedPackages":["$instagram"]}"""
        val parsed = PolicyJson.parse(raw)
        assertFalse(parsed.restricted, "ausente nao pode virar true por acidente")
        assertEquals(listOf(instagram), parsed.blockedPackages)
    }

    @Test
    @DisplayName("feliz: parseia blockedDomains sem confundir com blockedPackages")
    fun parsesBlockedDomains() {
        val raw = """{"blockedPackages":["$instagram"],"blockedDomains":["instagram.com","tiktok.com"],"restricted":false}"""
        val parsed = PolicyJson.parse(raw)
        assertEquals(listOf(instagram), parsed.blockedPackages)
        assertEquals(listOf("instagram.com", "tiktok.com"), parsed.blockedDomains)
    }

    @Test
    @DisplayName("regressao: politica salva antes dos sites carrega sem nenhum dominio")
    fun missingBlockedDomainsDefaultsToEmpty() {
        val raw = """{"blockedPackages":["$instagram"],"restricted":true}"""
        val parsed = PolicyJson.parse(raw)
        assertEquals(emptyList(), parsed.blockedDomains)
        assertEquals(listOf(instagram), parsed.blockedPackages)
    }

    @Test
    @DisplayName("borda: arquivo vazio / corrompido lanca e PolicyReader vira Unreadable")
    fun malformedThrows() {
        assertFailsWith<Exception> { PolicyJson.parse("{") }
        assertFailsWith<Exception> { PolicyJson.parse("") }
    }

    @Test
    @DisplayName("feliz: parseia o array de horarios livres")
    fun parsesExceptions() {
        val raw = """{"blockedPackages":["$instagram"],"exceptions":["$instagram|1,2|720|780"]}"""

        assertEquals(listOf("$instagram|1,2|720|780"), PolicyJson.parse(raw).exceptions)
    }

    @Test
    @DisplayName("borda: politica salva antes dos horarios livres le sem nenhum")
    fun missingExceptionsDefaultsToEmpty() {
        val raw = """{"blockedPackages":["$instagram"],"restricted":false}"""

        assertEquals(emptyList(), PolicyJson.parse(raw).exceptions)
    }
}
