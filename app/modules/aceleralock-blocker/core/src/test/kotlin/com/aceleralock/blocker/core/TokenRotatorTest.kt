package com.aceleralock.blocker.core

import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test
import java.time.Duration
import java.time.Instant
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class TokenRotatorTest {

    private val t0: Instant = Instant.parse("2026-08-31T12:00:00Z")

    private fun pair(index: Int, expiresAt: Instant) =
        TokenPair("access-$index", expiresAt, "refresh-$index")

    @Test
    @DisplayName("feliz: token valido nao provoca rotacao")
    fun validTokenIsReused() {
        val calls = AtomicInteger()
        val rotator = TokenRotator(refreshCall = { calls.incrementAndGet(); pair(9, t0.plus(Duration.ofMinutes(15))) })
        rotator.seed(pair(1, t0.plus(Duration.ofMinutes(15))))

        assertEquals("access-1", rotator.accessTokenAt(t0))
        assertEquals(0, calls.get())
    }

    @Test
    @DisplayName("feliz: token expirado rotaciona uma vez")
    fun expiredTokenRotatesOnce() {
        val calls = AtomicInteger()
        val rotator = TokenRotator(refreshCall = {
            val index = calls.incrementAndGet()
            pair(index + 1, t0.plus(Duration.ofMinutes(30)))
        })
        rotator.seed(pair(1, t0))

        assertEquals("access-2", rotator.accessTokenAt(t0))
        assertEquals(1, calls.get())
    }

    @Test
    @DisplayName("regressao: 20 chamadas concorrentes produzem UMA rotacao, nao 20")
    fun concurrentCallersProduceASingleRotation() {
        val calls = AtomicInteger()
        val rotator = TokenRotator(refreshCall = { presented: String ->
            assertEquals("refresh-1", presented, "so o token corrente pode ser apresentado")
            val index = calls.incrementAndGet()
            pair(index + 1, t0.plus(Duration.ofMinutes(30)))
        })
        rotator.seed(pair(1, t0))

        val threads = 20
        val pool = Executors.newFixedThreadPool(threads)
        val start = CountDownLatch(1)
        val done = CountDownLatch(threads)
        repeat(threads) {
            pool.submit {
                start.await()
                rotator.accessTokenAt(t0)
                done.countDown()
            }
        }
        start.countDown()
        assertTrue(done.await(10, TimeUnit.SECONDS))
        pool.shutdown()

        assertEquals(1, calls.get(), "duas rotacoes seriam indistinguiveis de token roubado")
        assertEquals(1, rotator.rotationCount())
    }

    @Test
    @DisplayName("regressao: o refresh apresentado e sempre o corrente, nunca um ja consumido")
    fun neverPresentsAConsumedRefreshToken() {
        val presented = mutableListOf<String>()
        val calls = AtomicInteger()
        val rotator = TokenRotator(refreshCall = { token: String ->
            presented += token
            val index = calls.incrementAndGet()
            pair(index + 1, t0.plus(Duration.ofMinutes(15)))
        })
        rotator.seed(pair(1, t0))

        rotator.accessTokenAt(t0)
        rotator.accessTokenAt(t0.plus(Duration.ofMinutes(20)))
        rotator.accessTokenAt(t0.plus(Duration.ofMinutes(40)))

        assertEquals(listOf("refresh-1", "refresh-2", "refresh-3"), presented)
        assertEquals(presented.distinct(), presented, "reapresentar um refresh revogaria a familia")
    }

    @Test
    @DisplayName("borda: rotaciona 30s antes de expirar, para nao correr contra o relogio")
    fun rotatesAheadOfExpiryBySkew() {
        val calls = AtomicInteger()
        val rotator = TokenRotator(refreshCall = { calls.incrementAndGet(); pair(2, t0.plus(Duration.ofMinutes(30))) })
        rotator.seed(pair(1, t0.plus(Duration.ofSeconds(20))))

        rotator.accessTokenAt(t0)

        assertEquals(1, calls.get())
    }
}
