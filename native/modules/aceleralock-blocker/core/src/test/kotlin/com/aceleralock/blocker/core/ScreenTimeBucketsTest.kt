package com.aceleralock.blocker.core

import java.time.Duration
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.ZoneId
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test

class ScreenTimeBucketsTest {

    private val saoPaulo: ZoneId = ZoneId.of("America/Sao_Paulo")

    private fun em(ano: Int, mes: Int, dia: Int, hora: Int, minuto: Int): Long =
        LocalDateTime.of(ano, mes, dia, hora, minuto).atZone(saoPaulo).toInstant().toEpochMilli()

    @Test
    @DisplayName("feliz: soma por app, do que mais consome pro que menos")
    fun byPackageOrdered() {
        val totais = ScreenTimeBuckets.byPackage(
            listOf(
                Session("com.a", 0, 60_000),
                Session("com.b", 60_000, 240_000),
                Session("com.a", 240_000, 300_000)
            )
        )

        assertEquals(listOf("com.b", "com.a"), totais.map { it.packageName })
        assertEquals(Duration.ofMinutes(3), totais[0].total)
        assertEquals(Duration.ofMinutes(2), totais[1].total)
    }

    @Test
    @DisplayName("borda: sessao que cruza a meia-noite e dividida entre os dois dias")
    fun splitsAcrossMidnight() {
        val porDia = ScreenTimeBuckets.byDay(
            listOf(Session("com.a", em(2026, 8, 30, 23, 40), em(2026, 8, 31, 0, 30))),
            saoPaulo
        )

        assertEquals(Duration.ofMinutes(20), porDia[LocalDate.of(2026, 8, 30)])
        assertEquals(Duration.ofMinutes(30), porDia[LocalDate.of(2026, 8, 31)])
    }

    @Test
    @DisplayName("borda: sessao de varios dias distribui um dia cheio no meio")
    fun splitsAcrossFullDay() {
        val porDia = ScreenTimeBuckets.byDay(
            listOf(Session("com.a", em(2026, 8, 30, 22, 0), em(2026, 9, 1, 2, 0))),
            saoPaulo
        )

        assertEquals(Duration.ofHours(2), porDia[LocalDate.of(2026, 8, 30)])
        assertEquals(Duration.ofHours(24), porDia[LocalDate.of(2026, 8, 31)])
        assertEquals(Duration.ofHours(2), porDia[LocalDate.of(2026, 9, 1)])
    }

    @Test
    @DisplayName("borda: o fuso decide o dia — a mesma sessao cai em dias diferentes")
    fun zoneDecidesTheDay() {
        val sessao = listOf(Session("com.a", em(2026, 8, 30, 23, 0), em(2026, 8, 30, 23, 30)))

        val noBrasil = ScreenTimeBuckets.byDay(sessao, saoPaulo)
        val emTokyo = ScreenTimeBuckets.byDay(sessao, ZoneId.of("Asia/Tokyo"))

        assertEquals(Duration.ofMinutes(30), noBrasil[LocalDate.of(2026, 8, 30)])
        assertEquals(Duration.ofMinutes(30), emTokyo[LocalDate.of(2026, 8, 31)])
        assertNull(emTokyo[LocalDate.of(2026, 8, 30)])
    }

    @Test
    @DisplayName("borda: clipToDay corta a ponta da sessao que veio de ontem")
    fun clipsSessionFromYesterday() {
        val recortadas = ScreenTimeBuckets.clipToDay(
            listOf(Session("com.a", em(2026, 8, 29, 23, 0), em(2026, 8, 30, 1, 0))),
            LocalDate.of(2026, 8, 30),
            saoPaulo
        )

        assertEquals(1, recortadas.size)
        assertEquals(Duration.ofHours(1), recortadas[0].duration)
    }

    @Test
    @DisplayName("borda: clipToDay descarta sessao que nao encosta no dia")
    fun clipsAwayOtherDays() {
        val recortadas = ScreenTimeBuckets.clipToDay(
            listOf(Session("com.a", em(2026, 8, 28, 10, 0), em(2026, 8, 28, 11, 0))),
            LocalDate.of(2026, 8, 30),
            saoPaulo
        )

        assertTrue(recortadas.isEmpty())
    }

    @Test
    @DisplayName("borda: o ranking por app usa o mesmo criterio do total do dia")
    fun rankingMatchesDailyTotal() {
        val sessoes = listOf(Session("com.a", em(2026, 8, 29, 23, 30), em(2026, 8, 30, 0, 30)))
        val dia = LocalDate.of(2026, 8, 30)

        val doDia = ScreenTimeBuckets.byDay(sessoes, saoPaulo)[dia]
        val doRanking = ScreenTimeBuckets.byPackage(
            ScreenTimeBuckets.clipToDay(sessoes, dia, saoPaulo)
        ).single().total

        assertEquals(doDia, doRanking)
    }

    @Test
    @DisplayName("borda: sem sessao nenhuma o mapa sai vazio, nao com dias zerados")
    fun emptyStaysEmpty() {
        assertTrue(ScreenTimeBuckets.byDay(emptyList(), saoPaulo).isEmpty())
        assertTrue(ScreenTimeBuckets.byPackage(emptyList()).isEmpty())
    }
}
