package com.aceleralock.blocker.core

import java.time.Duration

interface KeyValueStore {
    fun getLong(key: String, fallback: Long): Long

    fun putLong(key: String, value: Long)

    fun getInt(key: String, fallback: Int): Int

    fun putInt(key: String, value: Int)
}

/**
 * Tempo offline acumulado. Nem relogio de parede (adiantar a hora nao avanca nada),
 * nem elapsedRealtime puro (reboot nao zera o progresso).
 */
class OfflineFailsafeCounter(
    private val store: KeyValueStore,
    private val monotonic: MonotonicClock
) {

    private var lastTickElapsed: Long? = null

    fun onBoot() {
        lastTickElapsed = null
    }

    fun accumulatedMillis(): Long = store.getLong(KEY_ACCUMULATED, 0L)

    fun failsafeDays(): Int = store.getInt(KEY_FAILSAFE_DAYS, DEFAULT_FAILSAFE_DAYS)

    fun setFailsafeDays(days: Int) {
        if (days > 0) {
            store.putInt(KEY_FAILSAFE_DAYS, days)
        }
    }

    fun tick() {
        val now = monotonic.elapsedMillis()
        val previous = lastTickElapsed
        lastTickElapsed = now
        if (previous == null || now < previous) {
            return
        }
        store.putLong(KEY_ACCUMULATED, accumulatedMillis() + (now - previous))
    }

    fun onSyncCompleted() {
        store.putLong(KEY_ACCUMULATED, 0L)
        lastTickElapsed = monotonic.elapsedMillis()
    }

    fun isTripped(): Boolean =
        accumulatedMillis() >= Duration.ofDays(failsafeDays().toLong()).toMillis()

    private companion object {
        const val KEY_ACCUMULATED = "failsafe.accumulated_offline_millis"
        const val KEY_FAILSAFE_DAYS = "failsafe.days"
        const val DEFAULT_FAILSAFE_DAYS = 7
    }
}
