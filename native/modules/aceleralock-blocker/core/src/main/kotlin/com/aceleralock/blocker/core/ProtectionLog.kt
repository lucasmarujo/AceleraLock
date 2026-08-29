package com.aceleralock.blocker.core

import java.time.Duration

/**
 * Uma interrupcao: o periodo em que a protecao devia estar de pe e nao estava.
 *
 * [duration] nulo significa **imensuravel**, nao zero. Quando o aparelho reinicia, o
 * elapsedRealtime volta a zero e nao existe relogio confiavel para medir quanto tempo
 * ele ficou desligado — o relogio de parede e do dono do aparelho. Nesse caso a
 * interrupcao e contada sem ser cronometrada.
 */
data class Interruption(val duration: Duration?)

/**
 * Registra se a protecao **devia** estar ativa e por quanto tempo ela nao esteve.
 *
 * Nao e defesa e nao tenta ser: um app sem Device Admin nao impede o proprio
 * force-stop. E informacao para quem instalou o app justamente para saber disso —
 * lapso invisivel e o que faz esta ferramenta falhar em silencio, e o app voltar
 * dizendo "voce esta protegido" sobre um periodo em que nao estava seria a mesma
 * mentira ja corrigida no iOS, no estado de pausa e na leitura da politica.
 *
 * O estado ativo e uma **flag persistida**, gravada quando a protecao liga e quando e
 * desligada de proposito. Nao e "o servico esta no ar agora": servico morto por falta
 * de memoria responderia "inativo", e o app diria "pausado" a quem nunca pausou.
 *
 * **O que este registro NAO sabe:** por que o servico morreu. Force-stop, morte por
 * memoria, crash e aparelho desligado sao indistinguiveis daqui. O numero e honesto;
 * o rotulo seria chute.
 */
class ProtectionLog(
    private val store: KeyValueStore,
    private val monotonic: MonotonicClock
) {

    fun isActive(): Boolean = store.getLong(KEY_ACTIVE, 0L) == 1L

    fun markActive() {
        store.putLong(KEY_ACTIVE, 1L)
        heartbeat()
    }

    fun markStopped() {
        store.putLong(KEY_ACTIVE, 0L)
        store.putLong(KEY_HEARTBEAT, 0L)
    }

    /** Chamado a cada tick: prova de vida do servico. */
    fun heartbeat() {
        store.putLong(KEY_HEARTBEAT, monotonic.elapsedMillis())
    }

    /**
     * Chamado a cada criacao do servico. Devolve a interrupcao apurada, ou null quando
     * nao ha nada a registrar — protecao desligada de proposito nao e lapso.
     */
    fun onServiceStart(): Interruption? {
        if (!isActive()) {
            return null
        }
        val now = monotonic.elapsedMillis()
        val last = store.getLong(KEY_HEARTBEAT, 0L)
        heartbeat()
        if (last == 0L) {
            return null
        }
        if (now < last) {
            store.putInt(KEY_UNKNOWN_COUNT, unknownInterruptions() + 1)
            store.putLong(KEY_LAST_MILLIS, UNMEASURABLE)
            return Interruption(null)
        }
        val gap = now - last
        store.putLong(KEY_TOTAL_MILLIS, store.getLong(KEY_TOTAL_MILLIS, 0L) + gap)
        store.putLong(KEY_LAST_MILLIS, gap)
        return Interruption(Duration.ofMillis(gap))
    }

    fun totalMeasuredDowntime(): Duration = Duration.ofMillis(store.getLong(KEY_TOTAL_MILLIS, 0L))

    fun unknownInterruptions(): Int = store.getInt(KEY_UNKNOWN_COUNT, 0)

    fun lastInterruption(): Interruption? = when (val last = store.getLong(KEY_LAST_MILLIS, ABSENT)) {
        ABSENT -> null
        UNMEASURABLE -> Interruption(null)
        else -> Interruption(Duration.ofMillis(last))
    }

    private companion object {
        const val ABSENT = -1L
        const val UNMEASURABLE = -2L
        const val KEY_ACTIVE = "protection.active"
        const val KEY_HEARTBEAT = "protection.heartbeat_millis"
        const val KEY_TOTAL_MILLIS = "protection.downtime_total_millis"
        const val KEY_LAST_MILLIS = "protection.downtime_last_millis"
        const val KEY_UNKNOWN_COUNT = "protection.downtime_unknown_count"
    }
}
