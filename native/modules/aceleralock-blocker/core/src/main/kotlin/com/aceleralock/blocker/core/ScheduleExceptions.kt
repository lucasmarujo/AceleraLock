package com.aceleralock.blocker.core

import java.time.DayOfWeek
import java.time.LocalDateTime

/**
 * Horario livre de um app bloqueado: dentro da faixa o bloqueio nao vale. Minutos
 * desde 00:00 na hora local. `endMinute` menor que `startMinute` atravessa a
 * meia-noite, e os dias sao sempre os de **inicio** da faixa: sexta 22:00–02:00
 * vai de sexta 22h ate sabado 2h.
 */
data class ExceptionWindow(
    val days: Set<DayOfWeek>,
    val startMinute: Int,
    val endMinute: Int
)

/**
 * A hora local junto com o que diz se ela e confiavel. Existe porque horario livre
 * e a unica decisao de bloqueio que le relogio de parede — "das 12h as 13h" nao
 * tem versao monotonica. Hora e fuso automaticos sao a barreira: com os dois
 * ligados o Android nao deixa ajustar o relogio na mao; com qualquer um desligado
 * a faixa simplesmente nao vale (falha para o lado do bloqueio, nunca da
 * liberacao). Ver docs/decisoes.md, "Horarios livres por app".
 */
data class LocalClockReading(
    val dateTime: LocalDateTime,
    val automaticTime: Boolean,
    val automaticZone: Boolean
)

object ScheduleExceptions {

    const val MINUTES_PER_DAY = 24 * 60

    /** Teto por app: lista sem limite e tela sem limite, e oito faixas ja cobrem a semana. */
    const val MAX_WINDOWS_PER_APP = 8

    private const val SEPARATOR = '|'

    fun isValid(window: ExceptionWindow): Boolean =
        window.days.isNotEmpty() &&
            window.startMinute in 0 until MINUTES_PER_DAY &&
            window.endMinute in 0 until MINUTES_PER_DAY &&
            // Inicio igual ao fim e ambiguo (faixa vazia ou dia inteiro): recusado.
            window.startMinute != window.endMinute

    fun covers(window: ExceptionWindow, at: LocalDateTime): Boolean {
        if (!isValid(window)) {
            return false
        }
        val minute = at.hour * 60 + at.minute
        val today = at.dayOfWeek
        return if (window.startMinute < window.endMinute) {
            today in window.days && minute >= window.startMinute && minute < window.endMinute
        } else {
            (today in window.days && minute >= window.startMinute) ||
                (today.minus(1) in window.days && minute < window.endMinute)
        }
    }

    /**
     * O app esta num horario livre agora? Tres recusas antes de olhar a faixa, todas
     * para o lado do bloqueio: sem leitura de relogio, modo restrito ligado (decisao
     * do usuario: no restrito nenhuma excecao vale), ou hora/fuso que a pessoa pode
     * mudar na mao.
     */
    fun isExempt(packageName: String, policy: BlockPolicy, clock: LocalClockReading?): Boolean {
        if (clock == null || policy.restricted) {
            return false
        }
        if (!clock.automaticTime || !clock.automaticZone) {
            return false
        }
        return policy.exceptions[packageName].orEmpty().any { covers(it, clock.dateTime) }
    }

    /**
     * Valida a lista que vai ser gravada para um app. `null` quando qualquer faixa e
     * invalida ou a lista passa do teto: gravar so parte do que a pessoa configurou
     * seria mentir pra ela sobre o que vale.
     */
    fun sanitize(windows: List<ExceptionWindow>): List<ExceptionWindow>? {
        if (windows.size > MAX_WINDOWS_PER_APP || windows.any { !isValid(it) }) {
            return null
        }
        return windows.distinct()
    }

    /**
     * Uma faixa por string, `pacote|1,2,3,4,5|720|780` (dias ISO, 1 = segunda), para
     * caber no `PolicyJson`, que so le arrays de strings. Package name Android e
     * [a-zA-Z0-9._]: nunca carrega o separador.
     */
    fun encode(packageName: String, window: ExceptionWindow): String =
        listOf(
            packageName,
            window.days.map { it.value }.sorted().joinToString(","),
            window.startMinute.toString(),
            window.endMinute.toString()
        ).joinToString(SEPARATOR.toString())

    /** `null` em entrada malformada ou invalida: faixa que nao se le nao libera nada. */
    fun decode(raw: String): Pair<String, ExceptionWindow>? {
        val parts = raw.split(SEPARATOR)
        if (parts.size != 4 || parts[0].isBlank()) {
            return null
        }
        val days = parts[1].split(',').map { parte ->
            val valor = parte.toIntOrNull() ?: return null
            if (valor !in 1..7) {
                return null
            }
            DayOfWeek.of(valor)
        }.toSet()
        val start = parts[2].toIntOrNull() ?: return null
        val end = parts[3].toIntOrNull() ?: return null
        val window = ExceptionWindow(days, start, end)
        return if (isValid(window)) parts[0] to window else null
    }
}
