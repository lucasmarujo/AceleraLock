package com.aceleralock.blocker

import android.content.Context
import android.content.SharedPreferences
import android.os.SystemClock
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.aceleralock.blocker.core.KeyValueStore
import com.aceleralock.blocker.core.MonotonicClock
import com.aceleralock.blocker.core.WallClock

/**
 * Adaptadores finos das portas do core para o Android. Toda a logica que decide
 * bloqueio vive no core, sem dependencia de Android, e e testada em JVM.
 */

/** elapsedRealtime conta o sono profundo e nao e ajustavel pelo usuario. */
class SystemMonotonicClock : MonotonicClock {
    override fun elapsedMillis(): Long = SystemClock.elapsedRealtime()
}

/**
 * O relogio de parede do aparelho. Usado APENAS para medir desvio contra o
 * servidor — nunca para decidir bloqueio.
 */
class SystemWallClock : WallClock {
    override fun nowMillis(): Long = System.currentTimeMillis()
}

class EncryptedKeyValueStore(context: Context) : KeyValueStore {

    private val prefs: SharedPreferences = EncryptedSharedPreferences.create(
        context,
        "aceleralock.blocker",
        MasterKey.Builder(context).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build(),
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
    )

    override fun getLong(key: String, fallback: Long): Long = prefs.getLong(key, fallback)

    override fun putLong(key: String, value: Long) {
        prefs.edit().putLong(key, value).commit()
    }

    override fun getInt(key: String, fallback: Int): Int = prefs.getInt(key, fallback)

    override fun putInt(key: String, value: Int) {
        prefs.edit().putInt(key, value).commit()
    }

    fun getString(key: String): String? = prefs.getString(key, null)

    fun putString(key: String, value: String?) {
        prefs.edit().putString(key, value).commit()
    }
}
