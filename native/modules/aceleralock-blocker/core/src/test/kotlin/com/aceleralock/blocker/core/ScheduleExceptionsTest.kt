package com.aceleralock.blocker.core

import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test
import java.time.DayOfWeek
import java.time.DayOfWeek.FRIDAY
import java.time.DayOfWeek.MONDAY
import java.time.DayOfWeek.SATURDAY
import java.time.DayOfWeek.SUNDAY
import java.time.DayOfWeek.TUESDAY
import java.time.DayOfWeek.WEDNESDAY
import java.time.DayOfWeek.THURSDAY
import java.time.LocalDateTime
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

class ScheduleExceptionsTest {

    private val instagram = "com.instagram.android"
    private val tiktok = "com.zhiliaoapp.musically"

    private val diasUteis = setOf(MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY)

    /** Seg–sex, 12:00–13:00. */
    private val almoco = ExceptionWindow(diasUteis, 12 * 60, 13 * 60)

    /** Sexta, 22:00–02:00 do sabado. */
    private val sextaANoite = ExceptionWindow(setOf(FRIDAY), 22 * 60, 2 * 60)

    // 2026-10-12 e segunda-feira; os outros dias saem dele.
    private fun em(dia: DayOfWeek, hora: Int, minuto: Int = 0): LocalDateTime =
        LocalDateTime.of(2026, 10, 12, hora, minuto).plusDays((dia.value - 1).toLong())

    private fun relogio(
        dia: DayOfWeek,
        hora: Int,
        minuto: Int = 0,
        horaAutomatica: Boolean = true,
        fusoAutomatico: Boolean = true
    ) = LocalClockReading(em(dia, hora, minuto), horaAutomatica, fusoAutomatico)

    private fun politica(restrito: Boolean = false, vararg faixas: ExceptionWindow) =
        BlockPolicy(
            blockedPackages = setOf(instagram, tiktok),
            restricted = restrito,
            exceptions = mapOf(instagram to faixas.toList())
        )

    @Test
    @DisplayName("feliz: faixa cobre o inicio e para antes do fim")
    fun coversFromStartUntilJustBeforeEnd() {
        assertTrue(ScheduleExceptions.covers(almoco, em(WEDNESDAY, 12, 0)))
        assertTrue(ScheduleExceptions.covers(almoco, em(WEDNESDAY, 12, 59)))
        assertFalse(ScheduleExceptions.covers(almoco, em(WEDNESDAY, 13, 0)), "o fim nao entra")
        assertFalse(ScheduleExceptions.covers(almoco, em(WEDNESDAY, 11, 59)))
    }

    @Test
    @DisplayName("feliz: dia fora da faixa nao e coberto, mesmo no horario")
    fun dayOutsideTheWindowIsNotCovered() {
        assertFalse(ScheduleExceptions.covers(almoco, em(SATURDAY, 12, 30)))
        assertFalse(ScheduleExceptions.covers(almoco, em(SUNDAY, 12, 30)))
    }

    @Test
    @DisplayName("feliz: faixa que vira a meia-noite vale do dia de inicio ate a madrugada seguinte")
    fun windowCrossingMidnightBelongsToItsStartDay() {
        assertTrue(ScheduleExceptions.covers(sextaANoite, em(FRIDAY, 23, 30)))
        assertTrue(ScheduleExceptions.covers(sextaANoite, em(SATURDAY, 1, 59)))
        assertFalse(ScheduleExceptions.covers(sextaANoite, em(SATURDAY, 2, 0)), "o fim nao entra")
        assertFalse(ScheduleExceptions.covers(sextaANoite, em(FRIDAY, 21, 59)))
    }

    @Test
    @DisplayName("regressao: madrugada de um dia que nao comecou faixa nao e coberta")
    fun earlyMorningOfAnotherDayIsNotCovered() {
        // Sabado nao esta nos dias: sabado 23h e a madrugada de domingo nao valem.
        assertFalse(ScheduleExceptions.covers(sextaANoite, em(SATURDAY, 23, 0)))
        assertFalse(ScheduleExceptions.covers(sextaANoite, em(SUNDAY, 1, 0)))
        // Sexta 1h e madrugada de quinta, que nao comecou faixa.
        assertFalse(ScheduleExceptions.covers(sextaANoite, em(FRIDAY, 1, 0)))
    }

    @Test
    @DisplayName("borda: domingo a noite atravessa para a segunda da semana seguinte")
    fun sundayNightWrapsToMonday() {
        val domingo = ExceptionWindow(setOf(SUNDAY), 23 * 60, 60)

        assertTrue(ScheduleExceptions.covers(domingo, em(MONDAY, 0, 30)))
    }

    @Test
    @DisplayName("feliz: app na faixa com hora e fuso automaticos fica isento")
    fun exemptInsideWindowWithAutomaticClock() {
        assertTrue(ScheduleExceptions.isExempt(instagram, politica(false, almoco), relogio(MONDAY, 12, 15)))
    }

    @Test
    @DisplayName("barreira: hora manual anula o horario livre — mudar o relogio nao abre o app")
    fun manualTimeVoidsTheException() {
        val manual = relogio(MONDAY, 12, 15, horaAutomatica = false)

        assertFalse(ScheduleExceptions.isExempt(instagram, politica(false, almoco), manual))
    }

    @Test
    @DisplayName("barreira: fuso manual anula o horario livre — trocar de fuso nao abre o app")
    fun manualZoneVoidsTheException() {
        val manual = relogio(MONDAY, 12, 15, fusoAutomatico = false)

        assertFalse(ScheduleExceptions.isExempt(instagram, politica(false, almoco), manual))
    }

    @Test
    @DisplayName("barreira: modo restrito ligado anula todo horario livre")
    fun restrictedModeVoidsEveryException() {
        assertFalse(ScheduleExceptions.isExempt(instagram, politica(true, almoco), relogio(MONDAY, 12, 15)))
    }

    @Test
    @DisplayName("barreira: sem leitura de relogio nao ha isencao")
    fun noClockReadingMeansNoExemption() {
        assertFalse(ScheduleExceptions.isExempt(instagram, politica(false, almoco), null))
    }

    @Test
    @DisplayName("regressao: horario livre de um app nao libera outro")
    fun exceptionIsScopedToItsPackage() {
        assertFalse(ScheduleExceptions.isExempt(tiktok, politica(false, almoco), relogio(MONDAY, 12, 15)))
    }

    @Test
    @DisplayName("validacao: inicio igual ao fim, nenhum dia ou minuto fora do dia e invalido")
    fun rejectsAmbiguousOrOutOfRangeWindows() {
        assertFalse(ScheduleExceptions.isValid(ExceptionWindow(diasUteis, 720, 720)))
        assertFalse(ScheduleExceptions.isValid(ExceptionWindow(emptySet(), 720, 780)))
        assertFalse(ScheduleExceptions.isValid(ExceptionWindow(diasUteis, -1, 780)))
        assertFalse(ScheduleExceptions.isValid(ExceptionWindow(diasUteis, 720, 1440)))
        assertTrue(ScheduleExceptions.isValid(almoco))
    }

    @Test
    @DisplayName("regressao: faixa invalida nunca cobre horario nenhum")
    fun invalidWindowNeverCovers() {
        val vazia = ExceptionWindow(diasUteis, 720, 720)

        assertFalse(ScheduleExceptions.covers(vazia, em(MONDAY, 12, 0)))
    }

    @Test
    @DisplayName("validacao: lista acima do teto ou com faixa invalida e recusada inteira")
    fun sanitizeRejectsTooManyOrInvalid() {
        val nove = (0 until 9).map { ExceptionWindow(setOf(MONDAY), it * 60, it * 60 + 30) }
        assertNull(ScheduleExceptions.sanitize(nove))
        assertNull(ScheduleExceptions.sanitize(listOf(almoco, ExceptionWindow(diasUteis, 60, 60))))
        assertEquals(listOf(almoco), ScheduleExceptions.sanitize(listOf(almoco, almoco)))
    }

    @Test
    @DisplayName("feliz: codifica e decodifica sem perder nada")
    fun encodeDecodeRoundTrip() {
        val codificado = ScheduleExceptions.encode(instagram, almoco)

        assertEquals("$instagram|1,2,3,4,5|720|780", codificado)
        assertEquals(instagram to almoco, ScheduleExceptions.decode(codificado))
    }

    @Test
    @DisplayName("barreira: entrada malformada decodifica como nada, nunca como faixa")
    fun malformedEntriesDecodeToNull() {
        assertNull(ScheduleExceptions.decode(""))
        assertNull(ScheduleExceptions.decode("$instagram|1,2|720"))
        assertNull(ScheduleExceptions.decode("$instagram|8|720|780"))
        assertNull(ScheduleExceptions.decode("$instagram||720|780"))
        assertNull(ScheduleExceptions.decode("$instagram|1|doze|780"))
        assertNull(ScheduleExceptions.decode("$instagram|1|720|720"))
        assertNull(ScheduleExceptions.decode("|1|720|780"))
    }
}
