package com.aceleralock.blocker.core

import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test
import java.time.Duration
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

class ProtectionLogTest {

    private val store = InMemoryStore()
    private val monotonic = FakeMonotonicClock()
    private val log = ProtectionLog(store, monotonic)

    private fun serviceRestarted(): ProtectionLog =
        ProtectionLog(store, monotonic)

    @Test
    @DisplayName("feliz: a flag de ativo sobrevive a morte do processo")
    fun activeFlagSurvivesProcessDeath() {
        log.markActive()

        assertTrue(serviceRestarted().isActive(), "flag persistida, nao consulta de servico no ar")
    }

    @Test
    @DisplayName("feliz: desligar de proposito limpa a flag")
    fun deliberateStopClearsTheFlag() {
        log.markActive()
        log.markStopped()

        assertFalse(serviceRestarted().isActive())
    }

    @Test
    @DisplayName("feliz: servico fora do ar por seis horas registra seis horas")
    fun measuresTheGapWhileTheServiceWasDead() {
        log.markActive()
        monotonic.advance(Duration.ofMinutes(1).toMillis())
        log.heartbeat()

        monotonic.advance(Duration.ofHours(6).toMillis())
        val interrupcao = serviceRestarted().onServiceStart()

        assertEquals(Duration.ofHours(6), interrupcao?.duration)
        assertEquals(Duration.ofHours(6), log.totalMeasuredDowntime())
    }

    @Test
    @DisplayName("honestidade: interrupcao que atravessa reboot e contada, nunca cronometrada")
    fun rebootCrossingGapIsCountedNotTimed() {
        log.markActive()
        monotonic.advance(Duration.ofMinutes(5).toMillis())
        log.heartbeat()

        monotonic.reboot()
        val interrupcao = serviceRestarted().onServiceStart()

        assertNull(interrupcao?.duration, "sem relogio confiavel, medir seria inventar")
        assertEquals(1, log.unknownInterruptions())
        assertEquals(Duration.ZERO, log.totalMeasuredDowntime(), "nao entra no total medido")
    }

    @Test
    @DisplayName("borda: protecao desligada de proposito nao produz interrupcao")
    fun deliberateStopIsNotALapse() {
        log.markActive()
        monotonic.advance(Duration.ofMinutes(5).toMillis())
        log.markStopped()

        monotonic.advance(Duration.ofHours(3).toMillis())

        assertNull(serviceRestarted().onServiceStart())
        assertEquals(Duration.ZERO, log.totalMeasuredDowntime())
    }

    @Test
    @DisplayName("feliz: interrupcoes somam ao longo do tempo")
    fun gapsAccumulate() {
        log.markActive()
        repeat(3) {
            monotonic.advance(Duration.ofMinutes(1).toMillis())
            log.heartbeat()
            monotonic.advance(Duration.ofHours(2).toMillis())
            serviceRestarted().onServiceStart()
        }

        assertEquals(Duration.ofHours(6), log.totalMeasuredDowntime())
        assertEquals(Duration.ofHours(2), log.lastInterruption()?.duration)
    }

    @Test
    @DisplayName("borda: sem nenhuma interrupcao ainda, nao ha o que relatar")
    fun nothingToReportBeforeAnyGap() {
        log.markActive()

        assertNull(log.lastInterruption())
        assertEquals(Duration.ZERO, log.totalMeasuredDowntime())
        assertEquals(0, log.unknownInterruptions())
    }
}
