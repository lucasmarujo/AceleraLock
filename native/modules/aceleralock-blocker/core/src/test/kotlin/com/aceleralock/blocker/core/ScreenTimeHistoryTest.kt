package com.aceleralock.blocker.core

import java.time.Duration
import java.time.LocalDate
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test

class ScreenTimeHistoryTest {

    private val hoje = LocalDate.of(2026, 8, 30)
    private val ontem = hoje.minusDays(1)

    private fun historico(clock: FakeWallClock = FakeWallClock(hoje)) =
        ScreenTimeHistory(InMemoryStore(), clock) to clock

    @Test
    @DisplayName("feliz: grava e le o total de um dia")
    fun recordsAndReads() {
        val (history, _) = historico()

        history.record(hoje, Duration.ofHours(3))

        assertEquals(Duration.ofHours(3), history.totals()[hoje])
    }

    @Test
    @DisplayName("honestidade: dia passado nao e sobrescrito por leitura menor — o sistema esquece, nos nao")
    fun pastDayNeverShrinks() {
        val (history, _) = historico()
        history.record(ontem, Duration.ofHours(5))

        // O UsageStatsManager ja esqueceu ontem: a releitura devolve zero.
        history.record(ontem, Duration.ZERO)

        assertEquals(Duration.ofHours(5), history.totals()[ontem])
    }

    @Test
    @DisplayName("feliz: dia passado aceita leitura maior — releitura mais completa corrige pra cima")
    fun pastDayAcceptsLargerReading() {
        val (history, _) = historico()
        history.record(ontem, Duration.ofHours(2))

        history.record(ontem, Duration.ofHours(4))

        assertEquals(Duration.ofHours(4), history.totals()[ontem])
    }

    @Test
    @DisplayName("feliz: o dia corrente sempre vale a leitura nova, inclusive menor")
    fun currentDayAlwaysWins() {
        val (history, _) = historico()
        history.record(hoje, Duration.ofHours(3))

        history.record(hoje, Duration.ofMinutes(10))

        assertEquals(Duration.ofMinutes(10), history.totals()[hoje])
    }

    @Test
    @DisplayName("borda: o dia de ontem vira passado quando o relogio vira — e passa a ser protegido")
    fun todayBecomesPastAfterMidnight() {
        val (history, clock) = historico()
        history.record(hoje, Duration.ofHours(3))

        clock.setToday(hoje.plusDays(1))
        history.record(hoje, Duration.ZERO)

        assertEquals(Duration.ofHours(3), history.totals()[hoje])
    }

    @Test
    @DisplayName("borda: poda em 90 dias — historico nao cresce sem fim")
    fun prunesOldDays() {
        val (history, _) = historico()

        history.record(hoje.minusDays(120), Duration.ofHours(1))
        history.record(hoje, Duration.ofHours(2))

        assertNull(history.totals()[hoje.minusDays(120)])
        assertEquals(Duration.ofHours(2), history.totals()[hoje])
    }

    @Test
    @DisplayName("borda: historico vazio le mapa vazio, nao explode")
    fun emptyHistory() {
        val (history, _) = historico()

        assertTrue(history.totals().isEmpty())
    }

    @Test
    @DisplayName("erro: entrada corrompida e descartada sem derrubar o resto do historico")
    fun corruptEntryIsSkipped() {
        val store = InMemoryStore()
        store.putString("screentime.daily_totals", "lixo;2026-08-30=3600000;=;2026-13-99=1")

        val history = ScreenTimeHistory(store, FakeWallClock(hoje))

        assertEquals(mapOf(hoje to Duration.ofHours(1)), history.totals())
    }
}
