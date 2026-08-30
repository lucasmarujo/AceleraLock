package com.aceleralock.blocker.core

import java.time.Duration

/** Um periodo continuo com um app em primeiro plano e a tela acesa. */
data class Session(val packageName: String, val startMillis: Long, val endMillis: Long) {

    val duration: Duration get() = Duration.ofMillis(endMillis - startMillis)
}

/**
 * Reconstroi sessoes a partir dos eventos crus.
 *
 * Reconstruir a partir de `queryEvents` em vez de somar o
 * `totalTimeInForeground` de `queryUsageStats` e escolha deliberada: o numero
 * agregado do Android e conhecidamente inflado em varios fabricantes, e nao ha
 * como corrigi-lo de fora. Aqui a regra de sessao e explicita, e por isso
 * testavel — e por isso tambem que o numero vai divergir um pouco do
 * Bem-Estar Digital, que usa criterio proprio. Divergencia de minutos e
 * esperada; de horas e bug.
 */
object ScreenTimeSessions {

    /**
     * Sessao mais curta que isso e ruido de troca de tela (um RESUMED seguido
     * de outro no mesmo instante), nao uso.
     */
    const val MIN_SESSION_MILLIS = 1_000L

    fun reconstruct(events: List<RawUsageEvent>, windowEndMillis: Long): List<Session> {
        val sessions = mutableListOf<Session>()
        var openPackage: String? = null
        var openStart = 0L

        fun close(at: Long) {
            val pacote = openPackage ?: return
            openPackage = null
            val duracao = at - openStart
            if (duracao >= MIN_SESSION_MILLIS) {
                sessions += Session(pacote, openStart, at)
            }
        }

        for (event in events.sortedBy { it.timestampMillis }) {
            when (event.type) {
                // Troca de app sem PAUSED no meio acontece o tempo todo: o
                // proprio RESUMED do proximo e que fecha o anterior.
                UsageEventType.FOREGROUND -> {
                    close(event.timestampMillis)
                    openPackage = event.packageName
                    openStart = event.timestampMillis
                }

                // So fecha se for o app que esta aberto. PAUSED de outro app
                // chega fora de ordem em alguns aparelhos.
                UsageEventType.BACKGROUND -> {
                    if (openPackage == event.packageName) {
                        close(event.timestampMillis)
                    }
                }

                UsageEventType.SCREEN_OFF -> close(event.timestampMillis)

                UsageEventType.SCREEN_ON -> Unit
            }
        }

        // Sessao ainda aberta no fim da janela conta ate o fim da janela — e o
        // app que a pessoa esta usando agora. Deixar de fora zeraria justamente
        // o uso do momento em que ela abriu esta tela.
        close(windowEndMillis)
        return sessions
    }
}
