package com.aceleralock.blocker.core

import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test
import java.time.Duration
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class WaitingPeriodTest {

    private val instagram = "com.instagram.android"

    private val store = InMemoryStore()
    private val monotonic = FakeMonotonicClock()
    private val waiting = WaitingPeriod(store, monotonic)

    private fun elapse(duration: Duration) {
        monotonic.advance(duration.toMillis())
        waiting.tick()
    }

    @Test
    @DisplayName("feliz: espera cumprida entrega o alvo e consome o pedido")
    fun fulfilledWaitReleasesTheTarget() {
        waiting.request(WaitTarget.UnlockApp(instagram))

        elapse(Duration.ofMinutes(30))

        assertEquals(WaitTarget.UnlockApp(instagram), waiting.consumeIfReady())
        assertNull(waiting.pending(), "pedido consumido nao pode continuar pendente")
    }

    @Test
    @DisplayName("feliz: espera em curso nao libera nada")
    fun waitInProgressReleasesNothing() {
        waiting.request(WaitTarget.UnlockApp(instagram))

        elapse(Duration.ofMinutes(29))

        assertNull(waiting.consumeIfReady())
        assertEquals(Duration.ofMinutes(1), waiting.pending()?.remaining)
    }

    @Test
    @DisplayName("regressao A1: so o tempo monotonico avanca a espera; parado ele, ela nao anda")
    fun onlyMonotonicTimeAdvancesTheWait() {
        waiting.request(WaitTarget.UnlockApp(instagram))

        repeat(100) { waiting.tick() }

        assertEquals(Duration.ZERO, waiting.pending()?.accumulated)
        assertNull(waiting.consumeIfReady(), "relogio de parede nao tem como influir: ele nao entra aqui")
    }

    @Test
    @DisplayName("regressao G8: reboot e checkpoint, nao reset - 15 min, reboot, 15 min cumprem os 30")
    fun rebootIsCheckpointNotReset() {
        waiting.request(WaitTarget.UnlockApp(instagram))
        elapse(Duration.ofMinutes(15))

        monotonic.reboot()
        waiting.onServiceStart()
        waiting.tick()

        elapse(Duration.ofMinutes(15))

        assertEquals(WaitTarget.UnlockApp(instagram), waiting.consumeIfReady())
    }

    @Test
    @DisplayName("regressao G8: reiniciar a cada minuto nunca zera o progresso da espera")
    fun repeatedRebootsNeverResetProgress() {
        waiting.request(WaitTarget.UnlockApp(instagram))

        repeat(30) {
            elapse(Duration.ofMinutes(1))
            monotonic.reboot()
            waiting.onServiceStart()
            waiting.tick()
        }

        assertNotNull(waiting.consumeIfReady())
    }

    @Test
    @DisplayName("seguranca: reciclagem de processo congela a espera, nunca a adianta")
    fun processRecycleFreezesTheWait() {
        waiting.request(WaitTarget.UnlockApp(instagram))
        elapse(Duration.ofMinutes(10))

        monotonic.advance(Duration.ofMinutes(45).toMillis())
        val recycled = WaitingPeriod(store, monotonic).also { it.onServiceStart() }
        recycled.tick()

        assertEquals(Duration.ofMinutes(10), recycled.pending()?.accumulated)
        assertNull(recycled.consumeIfReady(), "o tempo fora do ar nao pode cumprir a espera")
    }

    @Test
    @DisplayName("borda: sem pedido pendente, tick nao acumula nada")
    fun tickWithoutRequestAccumulatesNothing() {
        elapse(Duration.ofMinutes(30))

        assertNull(waiting.pending())
        assertNull(waiting.consumeIfReady())
    }

    @Test
    @DisplayName("regressao: pedido novo substitui o anterior e recomeca do zero")
    fun newRequestRestartsFromZero() {
        waiting.request(WaitTarget.UnlockApp(instagram))
        elapse(Duration.ofMinutes(29))

        waiting.request(WaitTarget.StopProtection)

        assertEquals(Duration.ZERO, waiting.pending()?.accumulated)
        assertNull(waiting.consumeIfReady())
    }

    @Test
    @DisplayName("feliz: cancelar e livre e zera o progresso")
    fun cancellingIsFree() {
        waiting.request(WaitTarget.UnlockApp(instagram))
        elapse(Duration.ofMinutes(20))

        waiting.cancel()

        assertNull(waiting.pending())
    }

    @Test
    @DisplayName("regra 1: desligar a protecao passa pela mesma espera")
    fun stoppingProtectionGoesThroughTheSameWait() {
        waiting.request(WaitTarget.StopProtection)

        elapse(Duration.ofMinutes(29))
        assertNull(waiting.consumeIfReady(), "desligar a um toque tornaria a espera por app encenacao")

        elapse(Duration.ofMinutes(1))
        assertEquals(WaitTarget.StopProtection, waiting.consumeIfReady())
    }

    @Test
    @DisplayName("regra 2: reduzir a espera esta sujeita a espera vigente")
    fun shorteningTheWaitIsItselfSubjectToTheWait() {
        waiting.request(WaitTarget.ChangeDurations(Duration.ofMinutes(1), Duration.ofMinutes(15)))

        elapse(Duration.ofMinutes(29))
        assertEquals(Duration.ofMinutes(30), waiting.waitDuration(), "ainda nao valeu")

        elapse(Duration.ofMinutes(1))
        assertNotNull(waiting.consumeIfReady())
        assertEquals(Duration.ofMinutes(1), waiting.waitDuration())
    }

    @Test
    @DisplayName("regra 2: a duracao da concessao muda pela mesma porta, nunca direto")
    fun grantDurationChangesThroughTheSameDoor() {
        assertEquals(Duration.ofMinutes(15), waiting.grantDuration())

        waiting.request(WaitTarget.ChangeDurations(Duration.ofMinutes(30), Duration.ofHours(8)))
        elapse(Duration.ofMinutes(29))
        assertEquals(Duration.ofMinutes(15), waiting.grantDuration())

        elapse(Duration.ofMinutes(1))
        waiting.consumeIfReady()
        assertEquals(Duration.ofHours(8), waiting.grantDuration())
    }

    @Test
    @DisplayName("borda: configuracao inicial vale uma vez; a segunda ja exige espera")
    fun initialConfigurationWorksOnlyOnce() {
        assertTrue(waiting.configureInitial(Duration.ofMinutes(45), Duration.ofMinutes(10)))
        assertEquals(Duration.ofMinutes(45), waiting.waitDuration())

        assertFalse(waiting.configureInitial(Duration.ofMinutes(1), Duration.ofMinutes(1)))
        assertEquals(Duration.ofMinutes(45), waiting.waitDuration())
    }

    @Test
    @DisplayName("borda: duracao invalida e recusada, nunca vira espera zero")
    fun invalidDurationIsRejected() {
        assertFalse(waiting.configureInitial(Duration.ZERO, Duration.ofMinutes(15)))
        assertFalse(waiting.request(WaitTarget.ChangeDurations(Duration.ZERO, Duration.ofMinutes(15))))
        assertFalse(waiting.request(WaitTarget.ChangeDurations(Duration.ofMinutes(30), Duration.ZERO)))

        assertNull(waiting.pending())
        assertEquals(Duration.ofMinutes(30), waiting.waitDuration())
    }
}
