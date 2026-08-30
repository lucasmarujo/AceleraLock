package com.aceleralock.blocker.core

import kotlin.test.assertEquals
import kotlin.test.assertTrue
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test

class ScreenTimeSessionsTest {

    private fun evento(pacote: String, tipo: UsageEventType, em: Long) =
        RawUsageEvent(pacote, tipo, em)

    @Test
    @DisplayName("feliz: abre no FOREGROUND e fecha no BACKGROUND do mesmo app")
    fun singleSession() {
        val sessions = ScreenTimeSessions.reconstruct(
            listOf(
                evento("com.a", UsageEventType.FOREGROUND, 1_000),
                evento("com.a", UsageEventType.BACKGROUND, 61_000)
            ),
            windowEndMillis = 100_000
        )

        assertEquals(1, sessions.size)
        assertEquals("com.a", sessions[0].packageName)
        assertEquals(60_000, sessions[0].duration.toMillis())
    }

    @Test
    @DisplayName("borda: troca de app sem BACKGROUND — o FOREGROUND seguinte fecha o anterior")
    fun switchWithoutPause() {
        val sessions = ScreenTimeSessions.reconstruct(
            listOf(
                evento("com.a", UsageEventType.FOREGROUND, 0),
                evento("com.b", UsageEventType.FOREGROUND, 30_000),
                evento("com.b", UsageEventType.BACKGROUND, 50_000)
            ),
            windowEndMillis = 100_000
        )

        assertEquals(listOf("com.a", "com.b"), sessions.map { it.packageName })
        assertEquals(30_000, sessions[0].duration.toMillis())
        assertEquals(20_000, sessions[1].duration.toMillis())
    }

    @Test
    @DisplayName("borda: sessao ainda aberta conta ate o fim da janela — e o app em uso agora")
    fun openSessionClosesAtWindowEnd() {
        val sessions = ScreenTimeSessions.reconstruct(
            listOf(evento("com.a", UsageEventType.FOREGROUND, 10_000)),
            windowEndMillis = 70_000
        )

        assertEquals(1, sessions.size)
        assertEquals(60_000, sessions[0].duration.toMillis())
    }

    @Test
    @DisplayName("borda: tela apagada encerra a sessao, mesmo sem BACKGROUND do app")
    fun screenOffClosesSession() {
        val sessions = ScreenTimeSessions.reconstruct(
            listOf(
                evento("com.a", UsageEventType.FOREGROUND, 0),
                evento("", UsageEventType.SCREEN_OFF, 20_000)
            ),
            windowEndMillis = 900_000
        )

        assertEquals(1, sessions.size)
        assertEquals(20_000, sessions[0].duration.toMillis())
    }

    @Test
    @DisplayName("borda: tela acesa nao abre sessao — celular no bolso nao e uso de app")
    fun screenOnDoesNotOpenSession() {
        val sessions = ScreenTimeSessions.reconstruct(
            listOf(
                evento("", UsageEventType.SCREEN_ON, 0),
                evento("", UsageEventType.SCREEN_OFF, 60_000)
            ),
            windowEndMillis = 100_000
        )

        assertTrue(sessions.isEmpty())
    }

    @Test
    @DisplayName("borda: sessao abaixo de 1s e ruido de troca de tela, nao uso")
    fun discardsNoise() {
        val sessions = ScreenTimeSessions.reconstruct(
            listOf(
                evento("com.a", UsageEventType.FOREGROUND, 0),
                evento("com.b", UsageEventType.FOREGROUND, 500),
                evento("com.b", UsageEventType.BACKGROUND, 30_000)
            ),
            windowEndMillis = 30_000
        )

        assertEquals(listOf("com.b"), sessions.map { it.packageName })
    }

    @Test
    @DisplayName("borda: BACKGROUND de outro app nao encerra a sessao aberta")
    fun ignoresPauseFromOtherPackage() {
        val sessions = ScreenTimeSessions.reconstruct(
            listOf(
                evento("com.a", UsageEventType.FOREGROUND, 0),
                evento("com.b", UsageEventType.BACKGROUND, 10_000),
                evento("com.a", UsageEventType.BACKGROUND, 40_000)
            ),
            windowEndMillis = 40_000
        )

        assertEquals(1, sessions.size)
        assertEquals(40_000, sessions[0].duration.toMillis())
    }

    @Test
    @DisplayName("borda: eventos fora de ordem sao reordenados antes de reconstruir")
    fun sortsBeforeReconstructing() {
        val sessions = ScreenTimeSessions.reconstruct(
            listOf(
                evento("com.a", UsageEventType.BACKGROUND, 60_000),
                evento("com.a", UsageEventType.FOREGROUND, 0)
            ),
            windowEndMillis = 60_000
        )

        assertEquals(1, sessions.size)
        assertEquals(60_000, sessions[0].duration.toMillis())
    }

    @Test
    @DisplayName("borda: janela sem evento nenhum nao inventa sessao")
    fun emptyWindow() {
        assertTrue(ScreenTimeSessions.reconstruct(emptyList(), windowEndMillis = 1_000).isEmpty())
    }
}
