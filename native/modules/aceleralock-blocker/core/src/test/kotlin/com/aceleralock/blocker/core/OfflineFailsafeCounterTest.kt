package com.aceleralock.blocker.core

import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test
import java.time.Duration
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class OfflineFailsafeCounterTest {

    private val store = InMemoryStore()
    private val monotonic = FakeMonotonicClock()
    private val counter = OfflineFailsafeCounter(store, monotonic)

    private fun offlineFor(duration: Duration) {
        counter.tick()
        monotonic.advance(duration.toMillis())
        counter.tick()
    }

    @Test
    @DisplayName("feliz: sete dias offline disparam o failsafe")
    fun sevenDaysOfflineTripsTheValve() {
        offlineFor(Duration.ofDays(7))

        assertTrue(counter.isTripped())
    }

    @Test
    @DisplayName("borda: seis dias e vinte e tres horas ainda nao disparam")
    fun justUnderSevenDaysDoesNotTrip() {
        offlineFor(Duration.ofDays(6).plusHours(23))

        assertFalse(counter.isTripped())
    }

    @Test
    @DisplayName("regressao G8: reboot e checkpoint, nao reset - 3 dias, reboot, 4 dias dispara")
    fun rebootIsCheckpointNotReset() {
        offlineFor(Duration.ofDays(3))

        monotonic.reboot()
        counter.onBoot()

        offlineFor(Duration.ofDays(4))

        assertTrue(counter.isTripped(), "acumulado deveria somar 3 + 4 dias atravessando o reboot")
    }

    @Test
    @DisplayName("regressao G8: reiniciar todo dia nunca zera o progresso")
    fun dailyRebootsNeverResetProgress() {
        repeat(8) {
            offlineFor(Duration.ofDays(1))
            monotonic.reboot()
            counter.onBoot()
        }

        assertTrue(counter.isTripped())
    }

    @Test
    @DisplayName("regressao G7: adiantar o relogio de parede nao avanca o contador")
    fun wallClockJumpDoesNotAdvanceCounter() {
        val wall = FakeWallClock(0L)
        counter.tick()

        wall.jumpForward(Duration.ofDays(30).toMillis())
        counter.tick()

        assertEquals(0L, counter.accumulatedMillis())
        assertFalse(counter.isTripped())
    }

    @Test
    @DisplayName("regressao: sync completo zera o contador")
    fun completedSyncResetsCounter() {
        offlineFor(Duration.ofDays(6))

        counter.onSyncCompleted()

        assertEquals(0L, counter.accumulatedMillis())
        assertFalse(counter.isTripped())
    }

    @Test
    @DisplayName("regressao: com sync periodico funcionando o failsafe nunca dispara")
    fun periodicSyncNeverLetsValveTrip() {
        repeat(30) {
            offlineFor(Duration.ofHours(1))
            counter.onSyncCompleted()
        }

        assertFalse(counter.isTripped())
    }

    @Test
    @DisplayName("feliz: failsafeDays vem do servidor e passa a reger o disparo")
    fun serverProvidedFailsafeDaysGoverns() {
        counter.setFailsafeDays(10)

        offlineFor(Duration.ofDays(8))
        assertFalse(counter.isTripped())

        offlineFor(Duration.ofDays(2))
        assertTrue(counter.isTripped())
    }

    @Test
    @DisplayName("regressao: sem valor do servidor usa o cache padrao, nunca ilimitado")
    fun defaultsToSevenDaysNeverUnlimited() {
        assertEquals(7, counter.failsafeDays())

        counter.setFailsafeDays(0)
        assertEquals(7, counter.failsafeDays(), "valor invalido nao pode virar ilimitado")
    }
}
