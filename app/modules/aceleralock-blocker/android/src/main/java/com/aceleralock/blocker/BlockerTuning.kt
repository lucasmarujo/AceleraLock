package com.aceleralock.blocker

import java.time.Duration

/**
 * Manopla de calibracao. Estes numeros sao ponto de partida, nao verdade: o valor
 * certo sai de medicao em aparelho real e varia por fabricante. Ficam todos aqui
 * de proposito, em vez de espalhados pelo codigo.
 */
object BlockerTuning {

    /** Poll com tela ligada dentro de janela de bloqueio ativa. */
    val POLL_INSIDE_WINDOW: Duration = Duration.ofMillis(400)

    /** Poll com tela ligada fora de janela. */
    val POLL_OUTSIDE_WINDOW: Duration = Duration.ofSeconds(2)

    /** Poll enquanto o overlay esta na tela: so precisamos saber quando sair. */
    val POLL_WHILE_BLOCKING: Duration = Duration.ofSeconds(1)

    /** Sync periodico com a tela ligada. */
    val SYNC_SCREEN_ON: Duration = Duration.ofMinutes(15)

    /** Sync periodico com a tela apagada. */
    val SYNC_SCREEN_OFF: Duration = Duration.ofMinutes(60)

    /** Throttle do sync disparado por tela ligando. */
    val SYNC_ON_SCREEN_ON_THROTTLE: Duration = Duration.ofMinutes(5)

    /** Watchdog do AlarmManager. Mais frequente esbarra na quota do Doze. */
    val WATCHDOG_INTERVAL: Duration = Duration.ofMinutes(15)

    /** Janela de eventos consultada no UsageStatsManager a cada poll. */
    val USAGE_QUERY_WINDOW: Duration = Duration.ofSeconds(10)

    const val NOTIFICATION_CHANNEL_ID = "aceleralock.protection"
    const val NOTIFICATION_ID = 1001
}
