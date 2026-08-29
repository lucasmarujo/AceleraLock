package com.aceleralock.blocker

import android.content.Context
import com.aceleralock.blocker.core.TargetRegistry
import org.json.JSONObject

/**
 * Uma instancia de TargetRegistry por processo, persistida no armazenamento
 * criptografado. Os clientRef precisam sobreviver a reinicios: o servidor os usa
 * como chave de idempotencia, entao regerar um ref criaria um alvo duplicado.
 *
 * O mapa nunca sai do aparelho.
 */
object TargetRegistryHolder {

    private const val KEY_TARGETS = "targets.map"
    private const val KEY_REFS = "targets.client_refs"

    @Volatile
    private var instance: TargetRegistry? = null

    fun of(context: Context): TargetRegistry {
        instance?.let { return it }
        synchronized(this) {
            instance?.let { return it }
            val store = EncryptedKeyValueStore(context.applicationContext)
            val registry = TargetRegistry()
            registry.restore(readMap(store, KEY_TARGETS), readMap(store, KEY_REFS))
            instance = registry
            return registry
        }
    }

    fun persist(context: Context) {
        val registry = instance ?: return
        val store = EncryptedKeyValueStore(context.applicationContext)
        store.putString(KEY_TARGETS, JSONObject(registry.snapshot() as Map<*, *>).toString())
        store.putString(KEY_REFS, JSONObject(registry.clientRefSnapshot() as Map<*, *>).toString())
    }

    private fun readMap(store: EncryptedKeyValueStore, key: String): Map<String, String> {
        val raw = store.getString(key) ?: return emptyMap()
        return runCatching {
            val json = JSONObject(raw)
            json.keys().asSequence().associateWith { json.getString(it) }
        }.getOrDefault(emptyMap())
    }
}
