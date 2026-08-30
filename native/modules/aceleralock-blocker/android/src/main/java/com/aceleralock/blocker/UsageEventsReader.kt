package com.aceleralock.blocker

import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.os.Build
import com.aceleralock.blocker.core.RawUsageEvent
import com.aceleralock.blocker.core.UsageEventType

/**
 * Le eventos crus do UsageStatsManager e traduz pro vocabulario do core. Nao
 * decide nada: quem reconstroi sessao e soma por dia e o `core`, que roda em
 * JVM e tem teste.
 *
 * **Instancia propria, nunca a do [ForegroundAppDetector].** Aquele e do servico
 * de bloqueio e e stateful: cada consulta avanca o cursor `lastQueryEndMillis`.
 * Compartilhar faria as duas leituras roubarem eventos uma da outra, e o
 * sintoma nao seria um grafico errado — seria o bloqueio deixando de disparar
 * de vez em quando, que e o pior jeito possivel de descobrir o problema.
 */
class UsageEventsReader(context: Context) {

    private val usageStatsManager =
        context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager

    fun read(beginMillis: Long, endMillis: Long): List<RawUsageEvent> {
        val eventos = mutableListOf<RawUsageEvent>()
        val cursor = usageStatsManager.queryEvents(beginMillis, endMillis)
        val evento = UsageEvents.Event()

        while (cursor.hasNextEvent()) {
            cursor.getNextEvent(evento)
            val tipo = traduzir(evento.eventType) ?: continue
            eventos += RawUsageEvent(
                packageName = evento.packageName ?: "",
                type = tipo,
                timestampMillis = evento.timeStamp
            )
        }

        return eventos
    }

    /** Evento que nao interessa vira null e e descartado no laco. */
    private fun traduzir(eventType: Int): UsageEventType? = when (eventType) {
        resumed() -> UsageEventType.FOREGROUND
        paused() -> UsageEventType.BACKGROUND
        UsageEvents.Event.SCREEN_NON_INTERACTIVE -> UsageEventType.SCREEN_OFF
        UsageEvents.Event.SCREEN_INTERACTIVE -> UsageEventType.SCREEN_ON
        else -> null
    }

    private fun resumed(): Int =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            UsageEvents.Event.ACTIVITY_RESUMED
        } else {
            @Suppress("DEPRECATION")
            UsageEvents.Event.MOVE_TO_FOREGROUND
        }

    private fun paused(): Int =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            UsageEvents.Event.ACTIVITY_PAUSED
        } else {
            @Suppress("DEPRECATION")
            UsageEvents.Event.MOVE_TO_BACKGROUND
        }
}
