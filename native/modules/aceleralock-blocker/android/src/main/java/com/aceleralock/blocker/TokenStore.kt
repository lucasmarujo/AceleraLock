package com.aceleralock.blocker

import android.content.Context
import com.aceleralock.blocker.core.TokenPair
import com.aceleralock.blocker.core.TokenRotator
import java.time.Instant

/**
 * Dono unico dos tokens. O JS NUNCA ve o refresh token e nunca chama /v1/auth/refresh:
 * pede um access token pronto a este store.
 *
 * O motivo e uma regra do proprio backend. Dois rotacionadores concorrentes
 * apresentariam o mesmo refresh; o servidor veria um token consumido cujo sucessor
 * ja foi usado, concluiria reuso, e revogaria a familia inteira — deslogando o
 * usuario legitimo e derrubando o bloqueio junto. A regra do servidor esta certa;
 * o defeito seria ter dois rotacionadores.
 *
 * A exclusao e dentro do processo, o que basta porque o servico roda no mesmo
 * processo do app (ver ProcessAffinityGuard e o manifesto).
 */
class TokenStore(context: Context, private val backend: BackendClient) {

    private val prefs = EncryptedKeyValueStore(context.applicationContext)

    private val rotator = TokenRotator(refreshCall = { refreshToken ->
        val rotated = backend.refresh(refreshToken)
        persist(rotated)
        rotated
    })

    init {
        restore()?.let(rotator::seed)
    }

    /** Chamado pelo JS logo apos o login Apple/Google. Depois disso o JS esquece. */
    fun adopt(pair: TokenPair) {
        persist(pair)
        rotator.seed(pair)
    }

    fun accessToken(): String = rotator.accessTokenAt(Instant.now())

    fun hasSession(): Boolean = restore() != null

    fun clear() {
        prefs.putString(KEY_ACCESS, null)
        prefs.putString(KEY_REFRESH, null)
        prefs.putLong(KEY_EXPIRES_AT, 0L)
    }

    private fun persist(pair: TokenPair) {
        prefs.putString(KEY_ACCESS, pair.accessToken)
        prefs.putString(KEY_REFRESH, pair.refreshToken)
        prefs.putLong(KEY_EXPIRES_AT, pair.accessExpiresAt.toEpochMilli())
    }

    private fun restore(): TokenPair? {
        val access = prefs.getString(KEY_ACCESS) ?: return null
        val refresh = prefs.getString(KEY_REFRESH) ?: return null
        val expiresAt = prefs.getLong(KEY_EXPIRES_AT, 0L)
        if (expiresAt == 0L) {
            return null
        }
        return TokenPair(access, Instant.ofEpochMilli(expiresAt), refresh)
    }

    private companion object {
        const val KEY_ACCESS = "auth.access_token"
        const val KEY_REFRESH = "auth.refresh_token"
        const val KEY_EXPIRES_AT = "auth.access_expires_at"
    }
}
