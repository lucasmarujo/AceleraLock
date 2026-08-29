package com.aceleralock.blocker.core

import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test
import java.time.Duration
import java.time.Instant
import kotlin.test.assertEquals

class BlockDeciderTest {

    private val t0: Instant = Instant.parse("2026-08-31T12:00:00Z")

    private val instagram = "com.instagram.android"
    private val dialer = "com.android.dialer"

    private val fixedClock = Clock { t0 }
    private val decider = BlockDecider(fixedClock)

    @Test
    @DisplayName("feliz: alvo bloqueado sem grant e bloqueado")
    fun blocksBlockedTarget() {
        val verdict = decider.decide(instagram, BlockPolicy(blockedPackages = setOf(instagram)), emptySet())

        assertEquals(BlockOutcome.BLOCK, verdict.outcome)
    }

    @Test
    @DisplayName("feliz: alvo fora da lista de bloqueio nao e bloqueado")
    fun allowsNonTarget() {
        val verdict = decider.decide("com.whatsapp", BlockPolicy(blockedPackages = setOf(instagram)), emptySet())

        assertEquals(BlockOutcome.ALLOW, verdict.outcome)
        assertEquals(AllowReason.NOT_A_TARGET, verdict.allowReason)
    }

    @Test
    @DisplayName("barreira 2: app critico nunca recebe overlay, mesmo se estiver na lista")
    fun criticalAppIsNeverBlocked() {
        val policy = BlockPolicy(blockedPackages = setOf(instagram, dialer))

        val verdict = decider.decide(dialer, policy, setOf(dialer))

        assertEquals(BlockOutcome.ALLOW, verdict.outcome)
        assertEquals(AllowReason.CRITICAL_APP, verdict.allowReason)
    }

    @Test
    @DisplayName("feliz: grant vigente libera, grant expirado volta a bloquear")
    fun activeGrantAllowsAndExpiredGrantBlocks() {
        val policy = BlockPolicy(
            blockedPackages = setOf(instagram),
            grants = listOf(TemporaryGrant(instagram, t0.plus(Duration.ofMinutes(15))))
        )

        assertEquals(BlockOutcome.ALLOW, decider.decide(instagram, policy, emptySet()).outcome)

        val afterGrant = Clock { t0.plus(Duration.ofMinutes(16)) }
        val decider2 = BlockDecider(afterGrant)
        assertEquals(BlockOutcome.BLOCK, decider2.decide(instagram, policy, emptySet()).outcome)
    }

    @Test
    @DisplayName("borda: grant que comeca no futuro ainda nao vale agora")
    fun grantInTheFutureDoesNotYetAllow() {
        val policy = BlockPolicy(
            blockedPackages = setOf(instagram),
            grants = listOf(TemporaryGrant(instagram, t0.plus(Duration.ofMinutes(1))))
        )

        val verdict = decider.decide(instagram, policy, emptySet())

        assertEquals(BlockOutcome.BLOCK, verdict.outcome)
    }

    @Test
    @DisplayName("regressao: grant de outro pacote nao afeta decisao de outro alvo")
    fun grantIsScopedToItsPackage() {
        val policy = BlockPolicy(
            blockedPackages = setOf(instagram, "com.tiktok"),
            grants = listOf(TemporaryGrant("com.tiktok", t0.plus(Duration.ofMinutes(30))))
        )

        val verdict = decider.decide(instagram, policy, emptySet())

        assertEquals(BlockOutcome.BLOCK, verdict.outcome)
    }
}
