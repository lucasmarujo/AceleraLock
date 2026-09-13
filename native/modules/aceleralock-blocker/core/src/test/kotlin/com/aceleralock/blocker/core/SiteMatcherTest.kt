package com.aceleralock.blocker.core

import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

class SiteMatcherTest {

    private val instagram = setOf("instagram.com")

    @Test
    @DisplayName("feliz: dominio puro vira host")
    fun plainDomain() {
        assertEquals("instagram.com", SiteMatcher.hostOf("instagram.com"))
    }

    @Test
    @DisplayName("feliz: esquema, caminho, query, fragmento, porta e maiusculas sao ignorados")
    fun stripsUrlParts() {
        assertEquals("instagram.com", SiteMatcher.hostOf("  HTTPS://Instagram.com:443/reels?x=1#topo "))
        assertEquals("m.instagram.com", SiteMatcher.hostOf("m.instagram.com/explore"))
        assertEquals("instagram.com", SiteMatcher.hostOf("user:senha@instagram.com/p"))
    }

    @Test
    @DisplayName("feliz: www. inicial e removido, dos dois lados da comparacao")
    fun stripsWww() {
        assertEquals("instagram.com", SiteMatcher.hostOf("https://www.instagram.com/"))
    }

    @Test
    @DisplayName("regressao: esquema no meio da query nao e confundido com o do inicio")
    fun schemeOnlyAtStart() {
        assertEquals("tradutor.com", SiteMatcher.hostOf("tradutor.com/?u=https://instagram.com"))
    }

    @Test
    @DisplayName("borda: texto de busca na barra nao vira host")
    fun searchTextIsNotAHost() {
        assertNull(SiteMatcher.hostOf("gatos fofos"))
        assertNull(SiteMatcher.hostOf("instagram"))
        assertNull(SiteMatcher.hostOf(""))
        assertNull(SiteMatcher.hostOf("-instagram.com"))
    }

    @Test
    @DisplayName("feliz: dominio exato e subdominio sao bloqueados")
    fun blocksDomainAndSubdomain() {
        assertTrue(SiteMatcher.blocks("instagram.com", instagram))
        assertTrue(SiteMatcher.blocks("l.instagram.com", instagram))
    }

    @Test
    @DisplayName("regressao: dominio que so termina com o mesmo texto nao e bloqueado")
    fun suffixWithoutDotDoesNotMatch() {
        assertFalse(SiteMatcher.blocks("notinstagram.com", instagram))
    }

    @Test
    @DisplayName("regressao: dominio bloqueado como prefixo de outro host nao casa")
    fun prefixDoesNotMatch() {
        assertFalse(SiteMatcher.blocks("instagram.com.evil.io", instagram))
    }
}
