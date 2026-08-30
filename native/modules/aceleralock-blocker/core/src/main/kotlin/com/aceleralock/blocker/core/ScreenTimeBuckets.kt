package com.aceleralock.blocker.core

import java.time.Duration
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

/** Quanto um app somou numa janela. */
data class PackageTotal(val packageName: String, val total: Duration)

object ScreenTimeBuckets {

    /**
     * Soma por dia do calendario.
     *
     * Sessao que atravessa a meia-noite e **dividida** entre os dois dias, em
     * vez de cair inteira no dia em que comecou. Sem isso, quem usa o celular
     * das 23h40 as 00h30 veria cinquenta minutos no dia anterior e um dia
     * seguinte zerado — e o calendario, que e a tela inteira do mes, mentiria
     * exatamente nas noites que mais importam.
     */
    fun byDay(sessions: List<Session>, zone: ZoneId): Map<LocalDate, Duration> {
        val acumulado = mutableMapOf<LocalDate, Long>()

        for (session in sessions) {
            var cursor = session.startMillis
            while (cursor < session.endMillis) {
                val dia = Instant.ofEpochMilli(cursor).atZone(zone).toLocalDate()
                // Sempre estritamente maior que o cursor (o dia saiu dele), entao
                // o laco anda; e `coerceAtMost` impede passar do fim da sessao.
                val proximaMeiaNoite = dia.plusDays(1).atStartOfDay(zone).toInstant().toEpochMilli()
                val fimDoPedaco = minOf(proximaMeiaNoite, session.endMillis)
                acumulado[dia] = (acumulado[dia] ?: 0L) + (fimDoPedaco - cursor)
                cursor = fimDoPedaco
            }
        }

        return acumulado.mapValues { Duration.ofMillis(it.value) }
    }

    /**
     * Recorta as sessoes ao dia pedido, cortando as pontas do que atravessa a
     * meia-noite.
     *
     * Sem isto, "o que voce mais usou hoje" somaria a noite inteira de ontem em
     * qualquer app que estivesse aberto a meia-noite — o total do dia ja e
     * dividido corretamente por [byDay], e o ranking por app tem de usar o
     * mesmo criterio, senao as duas metades da mesma tela se contradizem.
     */
    fun clipToDay(sessions: List<Session>, day: LocalDate, zone: ZoneId): List<Session> {
        val inicioDoDia = day.atStartOfDay(zone).toInstant().toEpochMilli()
        val fimDoDia = day.plusDays(1).atStartOfDay(zone).toInstant().toEpochMilli()

        return sessions.mapNotNull { session ->
            val inicio = maxOf(session.startMillis, inicioDoDia)
            val fim = minOf(session.endMillis, fimDoDia)
            if (fim > inicio) session.copy(startMillis = inicio, endMillis = fim) else null
        }
    }

    /** Soma por app, do que mais consome pro que menos. */
    fun byPackage(sessions: List<Session>): List<PackageTotal> =
        sessions
            .groupBy { it.packageName }
            .map { (pacote, doPacote) ->
                PackageTotal(pacote, Duration.ofMillis(doPacote.sumOf { it.endMillis - it.startMillis }))
            }
            .sortedByDescending { it.total }
}
