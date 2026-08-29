package com.aceleralock.blocker.core

import java.time.Duration

interface KeyValueStore {
    fun getLong(key: String, fallback: Long): Long

    fun putLong(key: String, value: Long)

    fun getInt(key: String, fallback: Int): Int

    fun putInt(key: String, value: Int)

    fun getString(key: String): String?

    fun putString(key: String, value: String?)
}

interface MonotonicClock {
    fun elapsedMillis(): Long
}

sealed interface WaitTarget {

    data class UnlockApp(val packageName: String) : WaitTarget

    data object StopProtection : WaitTarget

    data class ChangeDurations(val newWait: Duration, val newGrant: Duration) : WaitTarget
}

data class PendingWait(val target: WaitTarget, val accumulated: Duration, val required: Duration) {

    val isReady: Boolean get() = accumulated >= required

    val remaining: Duration get() = if (isReady) Duration.ZERO else required.minus(accumulated)
}

/**
 * A espera que separa o impulso da acao. Soma de deltas monotonicos persistida:
 * nem relogio de parede (adiantar a hora nao avanca nada), nem elapsedRealtime puro
 * (reboot zera o cursor, nunca o acumulado — perde-se no maximo o delta do ultimo
 * tick).
 *
 * Um pedido por vez, de proposito. Esperas em paralelo deixariam abrir espera para
 * todos os alvos de uma vez e colher tudo junto: a friccao custaria trinta minutos
 * uma vez, e nao uma vez por decisao.
 *
 * Desligar a protecao e mudar as duracoes sao alvos como qualquer outro, pelo mesmo
 * motivo: espera com porta dos fundos e encenacao. Cancelar, ao contrario, e livre —
 * desistir tem de ser barato, senao a pessoa aprende a nunca comecar, e o que se
 * quer e que ela comece, espere e mude de ideia.
 *
 * Reinstalar o app zera tudo, inclusive a configuracao inicial. Nao e brecha nova:
 * desinstalar ja derrota o mecanismo inteiro, e esse e o teto declarado do produto.
 * Nao "conserte" isso achando que e defeito.
 */
class WaitingPeriod(
    private val store: KeyValueStore,
    private val monotonic: MonotonicClock
) {

    private var lastTickElapsed: Long? = null

    fun onBoot() {
        lastTickElapsed = null
    }

    fun waitDuration(): Duration =
        Duration.ofMillis(store.getLong(KEY_WAIT_MILLIS, DEFAULT_WAIT.toMillis()))

    fun grantDuration(): Duration =
        Duration.ofMillis(store.getLong(KEY_GRANT_MILLIS, DEFAULT_GRANT.toMillis()))

    fun isConfigured(): Boolean = store.getLong(KEY_WAIT_MILLIS, 0L) > 0L

    fun configureInitial(wait: Duration, grant: Duration): Boolean {
        if (isConfigured() || wait <= Duration.ZERO || grant <= Duration.ZERO) {
            return false
        }
        applyDurations(wait, grant)
        return true
    }

    fun request(target: WaitTarget): Boolean {
        if (target is WaitTarget.ChangeDurations &&
            (target.newWait <= Duration.ZERO || target.newGrant <= Duration.ZERO)
        ) {
            return false
        }
        store.putString(KEY_TARGET_KIND, kindOf(target))
        store.putString(KEY_TARGET_PAYLOAD, payloadOf(target))
        store.putLong(KEY_ACCUMULATED, 0L)
        store.putLong(KEY_REQUIRED, waitDuration().toMillis())
        lastTickElapsed = monotonic.elapsedMillis()
        return true
    }

    fun cancel() {
        store.putString(KEY_TARGET_KIND, null)
        store.putString(KEY_TARGET_PAYLOAD, null)
        store.putLong(KEY_ACCUMULATED, 0L)
        store.putLong(KEY_REQUIRED, 0L)
    }

    fun tick() {
        val now = monotonic.elapsedMillis()
        val previous = lastTickElapsed
        lastTickElapsed = now
        if (pending() == null || previous == null || now < previous) {
            return
        }
        store.putLong(KEY_ACCUMULATED, store.getLong(KEY_ACCUMULATED, 0L) + (now - previous))
    }

    fun pending(): PendingWait? {
        val target = storedTarget() ?: return null
        return PendingWait(
            target = target,
            accumulated = Duration.ofMillis(store.getLong(KEY_ACCUMULATED, 0L)),
            required = Duration.ofMillis(store.getLong(KEY_REQUIRED, DEFAULT_WAIT.toMillis()))
        )
    }

    /**
     * Entrega o alvo so quando a espera esta cumprida, e consome o pedido. As novas
     * duracoes se aplicam aqui dentro: nao existe setter direto, senao bastaria pedir
     * espera de zero e desbloquear na hora.
     */
    fun consumeIfReady(): WaitTarget? {
        val current = pending() ?: return null
        if (!current.isReady) {
            return null
        }
        cancel()
        val target = current.target
        if (target is WaitTarget.ChangeDurations) {
            applyDurations(target.newWait, target.newGrant)
        }
        return target
    }

    private fun applyDurations(wait: Duration, grant: Duration) {
        store.putLong(KEY_WAIT_MILLIS, wait.toMillis())
        store.putLong(KEY_GRANT_MILLIS, grant.toMillis())
    }

    private fun storedTarget(): WaitTarget? {
        val payload = store.getString(KEY_TARGET_PAYLOAD)
        return when (store.getString(KEY_TARGET_KIND)) {
            KIND_UNLOCK_APP -> payload?.takeIf { it.isNotBlank() }?.let(WaitTarget::UnlockApp)
            KIND_STOP_PROTECTION -> WaitTarget.StopProtection
            KIND_CHANGE_DURATIONS -> decodeDurations(payload)
            else -> null
        }
    }

    private fun decodeDurations(payload: String?): WaitTarget.ChangeDurations? {
        val parts = payload?.split(PAYLOAD_SEPARATOR) ?: return null
        if (parts.size != 2) {
            return null
        }
        val wait = parts[0].toLongOrNull()?.takeIf { it > 0L } ?: return null
        val grant = parts[1].toLongOrNull()?.takeIf { it > 0L } ?: return null
        return WaitTarget.ChangeDurations(Duration.ofMillis(wait), Duration.ofMillis(grant))
    }

    private fun kindOf(target: WaitTarget): String = when (target) {
        is WaitTarget.UnlockApp -> KIND_UNLOCK_APP
        is WaitTarget.StopProtection -> KIND_STOP_PROTECTION
        is WaitTarget.ChangeDurations -> KIND_CHANGE_DURATIONS
    }

    private fun payloadOf(target: WaitTarget): String? = when (target) {
        is WaitTarget.UnlockApp -> target.packageName
        is WaitTarget.StopProtection -> null
        is WaitTarget.ChangeDurations ->
            "${target.newWait.toMillis()}$PAYLOAD_SEPARATOR${target.newGrant.toMillis()}"
    }

    private companion object {
        val DEFAULT_WAIT: Duration = Duration.ofMinutes(30)
        val DEFAULT_GRANT: Duration = Duration.ofMinutes(15)
        const val PAYLOAD_SEPARATOR = ":"
        const val KEY_WAIT_MILLIS = "wait.duration_millis"
        const val KEY_GRANT_MILLIS = "wait.grant_millis"
        const val KEY_TARGET_KIND = "wait.target_kind"
        const val KEY_TARGET_PAYLOAD = "wait.target_payload"
        const val KEY_ACCUMULATED = "wait.accumulated_millis"
        const val KEY_REQUIRED = "wait.required_millis"
        const val KIND_UNLOCK_APP = "UNLOCK_APP"
        const val KIND_STOP_PROTECTION = "STOP_PROTECTION"
        const val KIND_CHANGE_DURATIONS = "CHANGE_DURATIONS"
    }
}
