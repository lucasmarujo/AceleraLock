package com.aceleralock.blocker.core

/**
 * Evento cru de uso, ja traduzido do UsageStatsManager. E a fronteira entre o
 * adaptador Android (que so consulta e converte) e a decisao, que mora aqui e
 * roda em JVM pura — a mesma divisao que o README exige do resto do modulo.
 */
data class RawUsageEvent(
    val packageName: String,
    val type: UsageEventType,
    val timestampMillis: Long
)

enum class UsageEventType {
    /** App veio pra frente (ACTIVITY_RESUMED). */
    FOREGROUND,

    /** App saiu de frente (ACTIVITY_PAUSED / ACTIVITY_STOPPED). */
    BACKGROUND,

    /** Tela apagou: encerra qualquer sessao aberta, seja de que app for. */
    SCREEN_OFF,

    /**
     * Tela acendeu. Nao abre sessao nenhuma de proposito — acender a tela no
     * bolso nao e uso de app. Quem abre e o FOREGROUND seguinte.
     */
    SCREEN_ON
}
