package com.aceleralock.blocker.core

import java.time.LocalDate

/**
 * Relogio de parede. Existe para o historico de tempo de tela e para o horario
 * livre ([ScheduleExceptions]) — e, no horario livre, so vale com hora e fuso
 * automaticos ([LocalClockReading]). Espera e concessao continuam sem ele.
 *
 * O resto do modulo evita relogio de parede de proposito: [MonotonicClock] e o
 * que sustenta a espera, porque adiantar a hora do aparelho nao pode encurtar
 * trinta minutos de friccao (ver WaitingPeriod). Aqui a regra e outra, e a
 * diferenca nao e descuido:
 *
 * **dia de calendario e conceito de relogio de parede.** Nao existe
 * "terca-feira monotonica" — um grafico por dia precisa saber em que dia o
 * aparelho acha que esta, e essa e a unica fonte possivel.
 *
 * O custo e conhecido e aceito: mexer na data do aparelho atribui uso ao dia
 * errado. Nao e brecha — nada aqui e barreira. E o proprio dado da pessoa, e
 * quem mente pra si mesma no calendario nao ganhou minuto nenhum de tela.
 */
interface WallClock {
    fun today(): LocalDate

    fun nowMillis(): Long
}
