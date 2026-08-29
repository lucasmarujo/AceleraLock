package com.aceleralock.blocker

import android.content.Context
import android.os.SystemClock
import com.aceleralock.blocker.core.KeyValueStore
import com.aceleralock.blocker.core.MonotonicClock

/**
 * Adaptadores finos das portas do core para o Android. A logica que decide bloqueio
 * vive no core, sem dependencia de Android, e e testada em JVM. Este arquivo so
 * guarda utilidades de plataforma que nao tem dependencia de UI ou de framework.
 */

/**
 * elapsedRealtime conta tempo desde o boot e nao anda com o relogio de parede: e o
 * unico relogio do aparelho que o proprio dono nao consegue adiantar.
 */
object SystemMonotonicClock : MonotonicClock {
    override fun elapsedMillis(): Long = SystemClock.elapsedRealtime()
}

/**
 * Mesmo arquivo de SharedPreferences que guarda a politica, pelo motivo ja registrado
 * no manifesto: o servico roda no MESMO processo do app.
 */
class SharedPreferencesStore(context: Context) : KeyValueStore {

    private val prefs = context.applicationContext
        .getSharedPreferences(BlockerService.PREFS_NAME, Context.MODE_PRIVATE)

    override fun getLong(key: String, fallback: Long): Long = prefs.getLong(key, fallback)

    override fun putLong(key: String, value: Long) {
        prefs.edit().putLong(key, value).apply()
    }

    override fun getInt(key: String, fallback: Int): Int = prefs.getInt(key, fallback)

    override fun putInt(key: String, value: Int) {
        prefs.edit().putInt(key, value).apply()
    }

    override fun getString(key: String): String? = prefs.getString(key, null)

    override fun putString(key: String, value: String?) {
        prefs.edit().putString(key, value).apply()
    }
}
