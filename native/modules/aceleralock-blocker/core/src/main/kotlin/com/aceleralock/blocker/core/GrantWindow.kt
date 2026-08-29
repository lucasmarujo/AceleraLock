package com.aceleralock.blocker.core

import java.time.Duration

/**
 * A concessao ativa — **uma so, e enquanto dura**.
 *
 * Nao existe lista de concessoes. Concessao terminada e apagada, nao arquivada: se
 * ficasse guardada, cada liberacao ja obtida viraria uma chave permanente, resgatavel
 * depois com um relogio favoravel. Quanto mais a pessoa usasse o produto direito,
 * mais portas destrancadas ela acumularia.
 *
 * O tempo restante e descontado em delta monotonico, nunca em relogio de parede.
 * Atrasar a hora nao estica nada e nao ressuscita nada, porque nao existe instante de
 * fim para comparar: existe saldo, e saldo so diminui.
 *
 * **Reboot encerra a concessao.** Nao e rigor gratuito: com saldo puramente monotonico,
 * desligar o aparelho congelaria o desconto, e bastaria desligar por tres horas para
 * a concessao sobreviver intacta. Encerrar no boot e o unico sentido de falha que nao
 * se pode explorar — reiniciar para prolongar passa a custar a concessao.
 *
 * O custo disso recai sobre quem nao fez nada: reinicio espontaneo por bateria ou por
 * crash tira o desbloqueio e obriga a pagar a espera de novo. E aceitavel porque erra
 * para o lado conservador. **Nao "conserte" isso preservando a concessao no boot** —
 * seria reabrir exatamente o flanco de desligar o aparelho para preservar o saldo, que
 * e indistinguivel de um reinicio legitimo.
 */
class GrantWindow(
    private val store: KeyValueStore,
    private val monotonic: MonotonicClock,
    private val duration: () -> Duration
) {

    fun onBoot() {
        clear()
    }

    fun open(packageName: String): Boolean {
        if (packageName.isBlank()) {
            return false
        }
        store.putString(KEY_PACKAGE, packageName)
        store.putLong(KEY_REMAINING, duration().toMillis())
        store.putLong(KEY_LAST_ELAPSED, monotonic.elapsedMillis())
        return true
    }

    fun tick() {
        if (store.getString(KEY_PACKAGE) == null) {
            return
        }
        val now = monotonic.elapsedMillis()
        val previous = store.getLong(KEY_LAST_ELAPSED, now)
        store.putLong(KEY_LAST_ELAPSED, now)
        if (now < previous) {
            clear()
            return
        }
        val remaining = store.getLong(KEY_REMAINING, 0L) - (now - previous)
        if (remaining <= 0L) {
            clear()
        } else {
            store.putLong(KEY_REMAINING, remaining)
        }
    }

    fun activePackage(): String? =
        if (remainingMillis() > 0L) store.getString(KEY_PACKAGE) else null

    fun remaining(): Duration = Duration.ofMillis(maxOf(remainingMillis(), 0L))

    fun clear() {
        store.putString(KEY_PACKAGE, null)
        store.putLong(KEY_REMAINING, 0L)
        store.putLong(KEY_LAST_ELAPSED, 0L)
    }

    private fun remainingMillis(): Long = store.getLong(KEY_REMAINING, 0L)

    private companion object {
        const val KEY_PACKAGE = "grant.package"
        const val KEY_REMAINING = "grant.remaining_millis"
        const val KEY_LAST_ELAPSED = "grant.last_elapsed_millis"
    }
}
