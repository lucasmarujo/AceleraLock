package com.aceleralock.blocker.core

import java.time.Duration
import java.time.Instant

data class TokenPair(val accessToken: String, val accessExpiresAt: Instant, val refreshToken: String)

fun interface RefreshCall {
    fun refresh(refreshToken: String): TokenPair
}

/**
 * Rotacionador unico. Dois rotacionadores concorrentes sao indistinguiveis de um
 * refresh token roubado: o backend detecta reuso e revoga a familia inteira,
 * deslogando o usuario legitimo e derrubando o bloqueio junto.
 *
 * Exclusao dentro do processo basta porque o servico declara o mesmo processo do
 * app (sem android:process no manifesto). ProcessAffinityGuard falha alto se isso
 * mudar.
 */
class TokenRotator(
    private val refreshCall: RefreshCall,
    private val skew: Duration = Duration.ofSeconds(30)
) {

    private val lock = Any()
    private var current: TokenPair? = null

    @Volatile
    private var rotations: Int = 0

    fun seed(pair: TokenPair) {
        synchronized(lock) { current = pair }
    }

    fun rotationCount(): Int = rotations

    fun accessTokenAt(now: Instant): String {
        synchronized(lock) {
            val pair = current ?: throw IllegalStateException("sem sessao")
            if (now.isBefore(pair.accessExpiresAt.minus(skew))) {
                return pair.accessToken
            }
            val rotated = refreshCall.refresh(pair.refreshToken)
            current = rotated
            rotations += 1
            return rotated.accessToken
        }
    }
}
