package com.aceleralock.blocker.core

import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test
import java.time.DayOfWeek
import java.time.Duration
import java.time.Instant
import java.time.LocalTime
import java.time.ZoneId
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class BlockDeciderTest {

    private val zone: ZoneId = ZoneId.of("America/Sao_Paulo")

    /** Segunda-feira, 2026-08-31, 09:00 em Sao Paulo (12:00Z). */
    private val mondayNineAm: Instant = Instant.parse("2026-08-31T12:00:00Z")

    private val instagram = "com.instagram.android"
    private val dialer = "com.android.dialer"

    private val monotonic = FakeMonotonicClock()
    private val wall = FakeWallClock(mondayNineAm.toEpochMilli())
    private val clock = CorrectedClock(monotonic, wall)
    private val decider = BlockDecider(clock)

    private fun policy(
        windows: List<BlockWindow> = listOf(
            BlockWindow(DayOfWeek.MONDAY, LocalTime.of(8, 0), LocalTime.of(12, 0))
        ),
        grants: List<ActiveGrant> = emptyList(),
        targets: Set<String> = setOf(instagram)
    ) = BlockPolicy(
        profiles = listOf(BlockProfile("p1", true, zone, windows, targets)),
        grants = grants
    )

    @Test
    @DisplayName("feliz: alvo dentro de janela ativa e bloqueado")
    fun blocksTargetInsideActiveWindow() {
        clock.anchorTo(mondayNineAm)

        val verdict = decider.decide(instagram, policy(), emptySet())

        assertEquals(BlockOutcome.BLOCK, verdict.outcome)
        assertFalse(verdict.unanchored)
    }

    @Test
    @DisplayName("feliz: alvo fora da janela nao e bloqueado")
    fun allowsTargetOutsideWindow() {
        clock.anchorTo(mondayNineAm.plus(Duration.ofHours(4)))

        val verdict = decider.decide(instagram, policy(), emptySet())

        assertEquals(BlockOutcome.ALLOW, verdict.outcome)
        assertEquals(AllowReason.OUTSIDE_WINDOW, verdict.allowReason)
    }

    @Test
    @DisplayName("regressao: adiantar o relogio do aparelho em 5h nao tira o usuario de janela ativa")
    fun deviceClockJumpDoesNotEscapeActiveWindow() {
        clock.anchorTo(mondayNineAm)

        wall.jumpForward(Duration.ofHours(5).toMillis())

        val verdict = decider.decide(instagram, policy(), emptySet())
        assertEquals(BlockOutcome.BLOCK, verdict.outcome)
    }

    @Test
    @DisplayName("regressao: atrasar o relogio nao poe o usuario dentro de janela ja encerrada")
    fun deviceClockRewindDoesNotReenterWindow() {
        clock.anchorTo(mondayNineAm.plus(Duration.ofHours(4)))

        wall.jumpForward(-Duration.ofHours(5).toMillis())

        val verdict = decider.decide(instagram, policy(), emptySet())
        assertEquals(BlockOutcome.ALLOW, verdict.outcome)
    }

    @Test
    @DisplayName("regressao: sem sync ha 3 dias a ancora antiga ainda decide corretamente")
    fun staleAnchorStillDecides() {
        clock.anchorTo(mondayNineAm)

        monotonic.advance(Duration.ofDays(3).toMillis())

        val verdict = decider.decide(instagram, policy(), emptySet())
        assertTrue(clock.isAnchored(), "ancora de dias atras continua valida: deriva monotonica e desprezivel")
        assertEquals(BlockOutcome.ALLOW, verdict.outcome, "tres dias depois e quinta, fora da janela de segunda")
    }

    @Test
    @DisplayName("regressao: modo aviao mais reboot fora de janela nao desarma o bloqueio")
    fun airplaneModePlusRebootOutsideWindowStillBlocks() {
        clock.anchorTo(mondayNineAm.plus(Duration.ofHours(4)))
        assertEquals(BlockOutcome.ALLOW, decider.decide(instagram, policy(), emptySet()).outcome)

        monotonic.reboot()
        clock.dropAnchor()

        val verdict = decider.decide(instagram, policy(), emptySet())

        assertEquals(BlockOutcome.BLOCK, verdict.outcome)
        assertTrue(verdict.unanchored)
    }

    @Test
    @DisplayName("regressao: sem ancora, todo alvo e bloqueado mesmo sem janela nenhuma")
    fun unanchoredBlocksEveryTargetEvenWithoutWindows() {
        val verdict = decider.decide(instagram, policy(windows = emptyList()), emptySet())

        assertEquals(BlockOutcome.BLOCK, verdict.outcome)
        assertTrue(verdict.unanchored)
    }

    @Test
    @DisplayName("regressao: sem ancora, app que nao e alvo continua liberado")
    fun unanchoredDoesNotBlockNonTargets() {
        val verdict = decider.decide("com.whatsapp", policy(), emptySet())

        assertEquals(BlockOutcome.ALLOW, verdict.outcome)
        assertEquals(AllowReason.NOT_A_TARGET, verdict.allowReason)
    }

    @Test
    @DisplayName("regressao: barreira 2 - app critico nunca recebe overlay, nem sem ancora")
    fun criticalAppIsNeverBlocked() {
        val withDialer = policy(targets = setOf(instagram, dialer))

        val anchoredVerdict = run {
            clock.anchorTo(mondayNineAm)
            decider.decide(dialer, withDialer, setOf(dialer))
        }
        assertEquals(BlockOutcome.ALLOW, anchoredVerdict.outcome)
        assertEquals(AllowReason.CRITICAL_APP, anchoredVerdict.allowReason)

        clock.dropAnchor()
        val unanchoredVerdict = decider.decide(dialer, withDialer, setOf(dialer))
        assertEquals(BlockOutcome.ALLOW, unanchoredVerdict.outcome)
        assertEquals(AllowReason.CRITICAL_APP, unanchoredVerdict.allowReason)
    }

    @Test
    @DisplayName("regressao: grant vigente libera; grant expirado volta a bloquear")
    fun activeGrantAllowsAndExpiredGrantBlocks() {
        clock.anchorTo(mondayNineAm)
        val grants = listOf(ActiveGrant(instagram, mondayNineAm.plus(Duration.ofMinutes(15))))

        assertEquals(BlockOutcome.ALLOW, decider.decide(instagram, policy(grants = grants), emptySet()).outcome)

        monotonic.advance(Duration.ofMinutes(16).toMillis())
        assertEquals(BlockOutcome.BLOCK, decider.decide(instagram, policy(grants = grants), emptySet()).outcome)
    }

    @Test
    @DisplayName("borda: janela 22:00-06:00 cruza a meia-noite")
    fun wrappingWindowCoversAcrossMidnight() {
        val night = listOf(BlockWindow(DayOfWeek.MONDAY, LocalTime.of(22, 0), LocalTime.of(6, 0)))

        // Segunda 23:30 em Sao Paulo = 2026-09-01T02:30Z
        clock.anchorTo(Instant.parse("2026-09-01T02:30:00Z"))
        assertEquals(BlockOutcome.BLOCK, decider.decide(instagram, policy(windows = night), emptySet()).outcome)

        // Terca 05:00 em Sao Paulo = 2026-09-01T08:00Z, ainda dentro da janela iniciada na segunda
        clock.anchorTo(Instant.parse("2026-09-01T08:00:00Z"))
        assertEquals(BlockOutcome.BLOCK, decider.decide(instagram, policy(windows = night), emptySet()).outcome)

        // Terca 07:00 em Sao Paulo = 2026-09-01T10:00Z, fora
        clock.anchorTo(Instant.parse("2026-09-01T10:00:00Z"))
        assertEquals(BlockOutcome.ALLOW, decider.decide(instagram, policy(windows = night), emptySet()).outcome)
    }

    @Test
    @DisplayName("regressao: desvio grande de relogio e detectado ao reancorar")
    fun largeSkewIsDetectedOnAnchor() {
        wall.jumpForward(Duration.ofHours(2).toMillis())

        clock.anchorTo(mondayNineAm)

        assertTrue(clock.isSkewSuspicious())
        assertEquals(Duration.ofHours(2).seconds, clock.lastSkewSeconds())
    }

    @Test
    @DisplayName("borda: desvio de 59s nao e suspeito")
    fun smallSkewIsNotSuspicious() {
        wall.jumpForward(Duration.ofSeconds(59).toMillis())

        clock.anchorTo(mondayNineAm)

        assertFalse(clock.isSkewSuspicious())
    }
}
