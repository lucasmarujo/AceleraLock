package com.aceleralock.blocker.core

import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test
import kotlin.test.assertEquals

class BlockDeciderTest {

    private val instagram = "com.instagram.android"
    private val dialer = "com.android.dialer"

    private val decider = BlockDecider()

    @Test
    @DisplayName("feliz: alvo bloqueado sem concessao e bloqueado")
    fun blocksBlockedTarget() {
        val verdict = decider.decide(instagram, BlockPolicy(setOf(instagram)), emptySet(), null)

        assertEquals(BlockOutcome.BLOCK, verdict.outcome)
        assertEquals(null, verdict.allowReason)
    }

    @Test
    @DisplayName("feliz: alvo fora da lista de bloqueio nao e bloqueado")
    fun allowsNonTarget() {
        val verdict = decider.decide("com.whatsapp", BlockPolicy(setOf(instagram)), emptySet(), null)

        assertEquals(BlockOutcome.ALLOW, verdict.outcome)
        assertEquals(AllowReason.NOT_A_TARGET, verdict.allowReason)
    }

    @Test
    @DisplayName("barreira 2: app critico nunca recebe overlay, mesmo se estiver na lista")
    fun criticalAppIsNeverBlocked() {
        val verdict = decider.decide(dialer, BlockPolicy(setOf(dialer)), setOf(dialer), null)

        assertEquals(BlockOutcome.ALLOW, verdict.outcome)
        assertEquals(AllowReason.CRITICAL_APP, verdict.allowReason)
    }

    @Test
    @DisplayName("feliz: concessao ativa libera o alvo dela")
    fun activeGrantAllowsItsTarget() {
        val verdict = decider.decide(instagram, BlockPolicy(setOf(instagram)), emptySet(), instagram)

        assertEquals(BlockOutcome.ALLOW, verdict.outcome)
        assertEquals(AllowReason.ACTIVE_GRANT, verdict.allowReason)
    }

    @Test
    @DisplayName("regressao: concessao de outro pacote nao afeta decisao de outro alvo")
    fun grantIsScopedToItsPackage() {
        val policy = BlockPolicy(setOf(instagram, "com.tiktok"))

        val verdict = decider.decide(instagram, policy, emptySet(), "com.tiktok")

        assertEquals(BlockOutcome.BLOCK, verdict.outcome)
    }
}
