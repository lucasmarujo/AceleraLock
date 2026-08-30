package com.aceleralock.blocker

import android.content.Context
import com.aceleralock.blocker.core.PackageTotal
import com.aceleralock.blocker.core.ScreenTimeBuckets
import com.aceleralock.blocker.core.ScreenTimeHistory
import com.aceleralock.blocker.core.ScreenTimeSessions
import java.time.Duration
import java.time.LocalDate
import java.time.ZoneId

/** O que a ponte devolve pro JS numa chamada so. */
data class ScreenTimeSummary(
    val today: Duration,
    val byPackage: List<PackageTotal>,
    /**
     * Todo o historico guardado (podado em 90 dias), nao so o mes corrente: o
     * calendario recorta o mes e a home pega os ultimos sete dias, que podem
     * cair no mes anterior. Uma fonte, dois recortes no JS.
     */
    val days: Map<LocalDate, Duration>
)

/**
 * Cola entre o leitor de eventos, a agregacao do core e o historico persistido.
 *
 * O historico existe porque o Android **nao guarda** o que o calendario do mes
 * precisa: a granularidade diaria some depois de poucos dias. Entao a cada
 * coleta o app grava o que leu enquanto o dado ainda existia — ver
 * ScreenTimeHistory.
 */
class ScreenTimeCollector(context: Context) {

    private val reader = UsageEventsReader(context)
    private val history = ScreenTimeHistory(SharedPreferencesStore(context), SystemWallClock)

    fun collect(): ScreenTimeSummary {
        val zone = ZoneId.systemDefault()
        val agora = SystemWallClock.nowMillis()
        val hoje = SystemWallClock.today()

        // Janela de leitura: o que o sistema ainda garante. Pedir mais nao
        // devolve mais — o que sustenta o mes e o historico ja gravado.
        val inicio = hoje.minusDays(JANELA_DIAS).atStartOfDay(zone).toInstant().toEpochMilli()

        val sessoes = ScreenTimeSessions.reconstruct(reader.read(inicio, agora), agora)
        val porDia = ScreenTimeBuckets.byDay(sessoes, zone)

        // Grava tudo que a janela alcancou; a regra de nao encolher dia passado
        // mora no historico, nao aqui.
        for ((dia, total) in porDia) {
            history.record(dia, total)
        }

        return ScreenTimeSummary(
            today = porDia[hoje] ?: Duration.ZERO,
            byPackage = ScreenTimeBuckets.byPackage(
                ScreenTimeBuckets.clipToDay(sessoes, hoje, zone)
            ),
            days = history.totals()
        )
    }

    private companion object {
        /**
         * O UsageStatsManager retem cerca de sete dias de eventos. Pedir uma
         * janela maior so custa varredura: o passado alem disso vem do
         * historico gravado, nunca de uma releitura.
         */
        const val JANELA_DIAS = 7L
    }
}
