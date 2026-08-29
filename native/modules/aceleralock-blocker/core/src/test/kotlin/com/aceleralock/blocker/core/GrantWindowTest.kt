package com.aceleralock.blocker.core

import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test
import java.time.Duration
import kotlin.test.assertEquals
import kotlin.test.assertNull

class GrantWindowTest {

    private val instagram = "com.instagram.android"

    private val store = InMemoryStore()
    private val monotonic = FakeMonotonicClock()
    private val window = GrantWindow(store, monotonic) { Duration.ofMinutes(15) }

    private fun elapse(duration: Duration) {
        monotonic.advance(duration.toMillis())
        window.tick()
    }

    @Test
    @DisplayName("feliz: concessao vale enquanto ha saldo e acaba quando ele zera")
    fun grantLastsItsDurationAndThenEnds() {
        window.open(instagram)

        elapse(Duration.ofMinutes(14))
        assertEquals(instagram, window.activePackage())

        elapse(Duration.ofMinutes(1))
        assertNull(window.activePackage(), "saldo zerado encerra a concessao")
    }

    @Test
    @DisplayName("regressao A2: relogio de parede nao existe aqui, entao atrasar a hora nao estica nada")
    fun wallClockCannotExtendTheGrant() {
        window.open(instagram)

        elapse(Duration.ofMinutes(15))
        assertNull(window.activePackage())

        window.tick()
        window.tick()

        assertNull(window.activePackage(), "sem instante de fim para comparar, nao ha o que atrasar")
        assertEquals(Duration.ZERO, window.remaining())
    }

    @Test
    @DisplayName("regressao A2: concessao encerrada some do armazenamento, nao vira chave guardada")
    fun finishedGrantIsErasedNotArchived() {
        window.open(instagram)
        elapse(Duration.ofMinutes(15))

        assertNull(store.getString("grant.package"), "concessao morta nao pode continuar no arquivo")
        assertEquals(0L, store.getLong("grant.remaining_millis", -1L))
    }

    @Test
    @DisplayName("regressao A2: reboot encerra a concessao em vez de ressuscita-la")
    fun rebootEndsTheGrant() {
        window.open(instagram)
        elapse(Duration.ofMinutes(5))

        monotonic.reboot()
        window.tick()

        assertNull(window.activePackage(), "reiniciar para prolongar tem de custar a concessao")
    }

    @Test
    @DisplayName("regressao A2: desligar o aparelho nao congela o saldo a favor de quem desligou")
    fun powerOffDoesNotPreserveTheGrant() {
        window.open(instagram)
        elapse(Duration.ofMinutes(1))

        monotonic.reboot()
        window.onBoot()
        window.tick()

        assertNull(window.activePackage())
        assertEquals(Duration.ZERO, window.remaining())
    }

    @Test
    @DisplayName("borda: abrir concessao para pacote em branco e recusado")
    fun blankPackageIsRejected() {
        assertEquals(false, window.open("  "))
        assertNull(window.activePackage())
    }

    @Test
    @DisplayName("borda: sem concessao aberta, tick nao inventa saldo")
    fun tickWithoutGrantDoesNothing() {
        elapse(Duration.ofMinutes(30))

        assertNull(window.activePackage())
        assertEquals(Duration.ZERO, window.remaining())
    }

    @Test
    @DisplayName("regressao: concessao nova substitui a anterior, sem somar saldo")
    fun openingAgainReplacesTheBalance() {
        window.open(instagram)
        elapse(Duration.ofMinutes(10))

        window.open(instagram)

        assertEquals(Duration.ofMinutes(15), window.remaining())
    }
}
