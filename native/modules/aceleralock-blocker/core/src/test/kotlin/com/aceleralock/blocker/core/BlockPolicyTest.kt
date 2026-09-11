package com.aceleralock.blocker.core

import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
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
}
