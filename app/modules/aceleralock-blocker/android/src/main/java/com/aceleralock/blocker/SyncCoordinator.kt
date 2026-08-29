package com.aceleralock.blocker

import android.content.Context
import android.os.SystemClock
import android.util.Log
import com.aceleralock.blocker.core.BlockPolicy
import com.aceleralock.blocker.core.CorrectedClock
import com.aceleralock.blocker.core.OfflineFailsafeCounter
import java.time.Instant
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Quem sincroniza e o servico nativo, nao o JavaScript: o JS esta morto enquanto o
 * app esta fechado, que e o estado normal deste produto. Sem isso, aprovacao do
 * parceiro nunca chegaria, mudanca de perfil nunca chegaria, e o contador de
 * failsafe nunca zeraria — todo usuario caminharia para a liberacao automatica
 * mesmo com rede perfeita e servidor no ar.
 */
class SyncCoordinator(
    private val context: Context,
    private val clock: CorrectedClock,
    private val failsafe: OfflineFailsafeCounter,
    private val onPolicy: (BlockPolicy) -> Unit
) {

    private val executor = Executors.newSingleThreadExecutor()
    private val inFlight = AtomicBoolean(false)
    private var lastSyncElapsed: Long = 0L

    private val store = EncryptedKeyValueStore(context)
    private val backend by lazy { BackendClient(store.getString(KEY_BASE_URL).orEmpty()) }
    private val tokens by lazy { TokenStore(context, backend) }

    fun requestNow() {
        if (!inFlight.compareAndSet(false, true)) {
            return
        }
        executor.execute {
            try {
                performSync()
            } catch (error: Exception) {
                Log.w(TAG, "sync falhou; politica local continua valendo", error)
            } finally {
                inFlight.set(false)
            }
        }
    }

    fun requestIfStale() {
        val since = SystemClock.elapsedRealtime() - lastSyncElapsed
        if (since >= BlockerTuning.SYNC_ON_SCREEN_ON_THROTTLE.toMillis()) {
            requestNow()
        }
    }

    fun tickAndMaybeSync(screenOn: Boolean) {
        val interval = if (screenOn) BlockerTuning.SYNC_SCREEN_ON else BlockerTuning.SYNC_SCREEN_OFF
        if (SystemClock.elapsedRealtime() - lastSyncElapsed >= interval.toMillis()) {
            requestNow()
        }
    }

    fun reportPushToken(token: String) {
        store.putString(KEY_PENDING_PUSH_TOKEN, token)
        requestNow()
    }

    private fun performSync() {
        val deviceId = store.getString(KEY_DEVICE_ID) ?: return
        if (!tokens.hasSession()) {
            return
        }
        val result = backend.sync(deviceId, tokens.accessToken(), Instant.now())

        // 304 tambem conta: falamos com o servidor e o relogio veio no header.
        val skew = clock.anchorTo(result.serverTime)
        failsafe.onSyncCompleted()
        lastSyncElapsed = SystemClock.elapsedRealtime()

        if (!result.notModified) {
            if (result.failsafeDays > 0) {
                failsafe.setFailsafeDays(result.failsafeDays)
            }
            onPolicy(result.policy)
        }
        if (clock.isSkewSuspicious()) {
            Log.w(TAG, "desvio de relogio de ${skew}s detectado; evento sera reportado")
        }
    }

    companion object {
        private const val TAG = "SyncCoordinator"
        const val KEY_DEVICE_ID = "session.device_id"
        const val KEY_BASE_URL = "session.base_url"
        const val KEY_PENDING_PUSH_TOKEN = "session.pending_push_token"
    }
}
