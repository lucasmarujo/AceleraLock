package com.aceleralock.blocker

import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.os.Build
import android.os.SystemClock

/**
 * Deteccao reativa via UsageStatsManager. O piso da latencia (D-lat, 0,5 a 2 s
 * medidos pelo QA) e o flush de eventos do proprio sistema, nao o nosso laco:
 * poll mais rapido reduz o caso medio e nao elimina o pior caso.
 */
class ForegroundAppDetector(context: Context) {

    private val usageStatsManager =
        context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager

    private var lastQueryEndMillis: Long = 0L
    private var lastKnownForeground: String? = null

    fun currentForegroundPackage(): String? {
        val now = System.currentTimeMillis()
        val begin = if (lastQueryEndMillis == 0L) {
            now - BlockerTuning.USAGE_QUERY_WINDOW.toMillis()
        } else {
            lastQueryEndMillis
        }
        lastQueryEndMillis = now

        val events = usageStatsManager.queryEvents(begin, now)
        val event = UsageEvents.Event()
        while (events.hasNextEvent()) {
            events.getNextEvent(event)
            if (event.eventType == resumedEventType()) {
                lastKnownForeground = event.packageName
            }
        }
        return lastKnownForeground
    }

    /** Forca a proxima consulta a olhar para tras, apos tela ligar. */
    fun resetWindow() {
        lastQueryEndMillis = 0L
    }

    private fun resumedEventType(): Int =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            UsageEvents.Event.ACTIVITY_RESUMED
        } else {
            @Suppress("DEPRECATION")
            UsageEvents.Event.MOVE_TO_FOREGROUND
        }

    @Suppress("unused")
    private fun monotonicNow(): Long = SystemClock.elapsedRealtime()
}
