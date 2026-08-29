package com.aceleralock.blocker

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.SystemClock

/**
 * Religa o servico apos reboot ou atualizacao do app. O boot tambem e marco das duas
 * contagens monotonicas: a espera pendente conserva o acumulado e so troca de cursor,
 * e a concessao ativa e encerrada — ver WaitingPeriod e GrantWindow.
 */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        BlockerService.start(context)
        ServiceWatchdog.schedule(context)
    }
}

/**
 * O discador padrao pode mudar DEPOIS de o usuario ter configurado os bloqueios.
 * Este receiver existe so para recalcular a barreira 2 nesse caso.
 */
class PackageChangedReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        BlockerService.refreshCriticalApps(context)
    }
}

/**
 * Uma das duas redes de sobrevivencia. A outra e o WorkManager periodico, com
 * constraint diferente — as duas morrem por motivos diferentes, e e disso que
 * depende sobreviver a fabricante agressivo.
 */
object ServiceWatchdog {

    private const val REQUEST_CODE = 4201

    fun schedule(context: Context) {
        val manager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
        val triggerAt = SystemClock.elapsedRealtime() + BlockerTuning.WATCHDOG_INTERVAL.toMillis()
        val pending = PendingIntent.getBroadcast(
            context,
            REQUEST_CODE,
            Intent(context, WatchdogReceiver::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            manager.setExactAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, triggerAt, pending)
        } else {
            manager.setExact(AlarmManager.ELAPSED_REALTIME_WAKEUP, triggerAt, pending)
        }
    }
}

class WatchdogReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        BlockerService.start(context)
        ServiceWatchdog.schedule(context)
    }
}
