package com.aceleralock.blocker.core

import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test
import kotlin.test.assertEquals

class BlockDeciderTest {

    private val instagram = "com.instagram.android"
    private val dialer = "com.android.dialer"

    private val decider = BlockDecider()

    @Test
    @DisplayName("feliz: alvo bloqueado sem concessao e bloqueado")
    fun blocksBlockedTarget() {
        val verdict = decider.decide(instagram, BlockPolicy(setOf(instagram)), emptySet(), null)

        assertEquals(BlockOutcome.BLOCK, verdict.outcome)
        assertEquals(null, verdict.allowReason)
    }

    @Test
    @DisplayName("feliz: alvo fora da lista de bloqueio nao e bloqueado")
    fun allowsNonTarget() {
        val verdict = decider.decide("com.whatsapp", BlockPolicy(setOf(instagram)), emptySet(), null)

        assertEquals(BlockOutcome.ALLOW, verdict.outcome)
        assertEquals(AllowReason.NOT_A_TARGET, verdict.allowReason)
    }

    @Test
    @DisplayName("barreira 2: app critico nunca recebe overlay, mesmo se estiver na lista")
    fun criticalAppIsNeverBlocked() {
        val verdict = decider.decide(dialer, BlockPolicy(setOf(dialer)), setOf(dialer), null)

        assertEquals(BlockOutcome.ALLOW, verdict.outcome)
        assertEquals(AllowReason.CRITICAL_APP, verdict.allowReason)
    }

    @Test
    @DisplayName("feliz: concessao ativa libera o alvo dela")
    fun activeGrantAllowsItsTarget() {
        val verdict = decider.decide(instagram, BlockPolicy(setOf(instagram)), emptySet(), instagram)

        assertEquals(BlockOutcome.ALLOW, verdict.outcome)
        assertEquals(AllowReason.ACTIVE_GRANT, verdict.allowReason)
    }

    @Test
    @DisplayName("regressao: concessao de outro pacote nao afeta decisao de outro alvo")
    fun grantIsScopedToItsPackage() {
        val policy = BlockPolicy(setOf(instagram, "com.tiktok"))

        val verdict = decider.decide(instagram, policy, emptySet(), "com.tiktok")

        assertEquals(BlockOutcome.BLOCK, verdict.outcome)
    }

    private val chrome = "com.android.chrome"
    private val sites = BlockPolicy(blockedDomains = setOf("instagram.com"))

    @Test
    @DisplayName("barreira D5: site bloqueado aberto no navegador em foco e bloqueado")
    fun blocksBlockedSiteInForegroundBrowser() {
        val address = BrowserAddress(chrome, "https://m.instagram.com/reels")

        val verdict = decider.decide(chrome, sites, emptySet(), null, address)

        assertEquals(BlockOutcome.BLOCK, verdict.outcome)
        assertEquals("m.instagram.com", verdict.blockedHost)
    }

    @Test
    @DisplayName("feliz: site fora da lista no navegador nao e bloqueado")
    fun allowsOtherSite() {
        val verdict = decider.decide(chrome, sites, emptySet(), null, BrowserAddress(chrome, "wikipedia.org"))

        assertEquals(BlockOutcome.ALLOW, verdict.outcome)
        assertEquals(AllowReason.NOT_A_TARGET, verdict.allowReason)
    }

    @Test
    @DisplayName("regressao: endereco lido de outro navegador nao bloqueia o app em foco")
    fun staleAddressFromOtherPackageIsIgnored() {
        val address = BrowserAddress(chrome, "instagram.com")

        val verdict = decider.decide("com.whatsapp", sites, emptySet(), null, address)

        assertEquals(BlockOutcome.ALLOW, verdict.outcome)
    }

    @Test
    @DisplayName("barreira 2: app critico nunca recebe overlay, mesmo com endereco bloqueado")
    fun criticalAppWinsOverBlockedSite() {
        val verdict = decider.decide(chrome, sites, setOf(chrome), null, BrowserAddress(chrome, "instagram.com"))

        assertEquals(AllowReason.CRITICAL_APP, verdict.allowReason)
    }

    @Test
    @DisplayName("regressao: concessao do navegador como app nao libera site bloqueado")
    fun grantForBrowserDoesNotUnlockSite() {
        val policy = sites.copy(blockedPackages = setOf(chrome))

        val verdict = decider.decide(chrome, policy, emptySet(), chrome, BrowserAddress(chrome, "instagram.com"))

        assertEquals(BlockOutcome.BLOCK, verdict.outcome)
    }

    // Horario livre: seg 12:00-13:00, com relogio de 2026-10-12 (segunda).
    private val almoco = ExceptionWindow(setOf(java.time.DayOfWeek.MONDAY), 12 * 60, 13 * 60)

    private fun relogio(hora: Int, automatico: Boolean = true) =
        LocalClockReading(java.time.LocalDateTime.of(2026, 10, 12, hora, 30), automatico, automatico)

    private val comHorarioLivre =
        BlockPolicy(setOf(instagram), exceptions = mapOf(instagram to listOf(almoco)))

    @Test
    @DisplayName("feliz: dentro do horario livre o alvo abre")
    fun scheduledExceptionAllowsTarget() {
        val verdict = decider.decide(instagram, comHorarioLivre, emptySet(), null, null, relogio(12))

        assertEquals(BlockOutcome.ALLOW, verdict.outcome)
        assertEquals(AllowReason.SCHEDULED_EXCEPTION, verdict.allowReason)
    }

    @Test
    @DisplayName("feliz: fora do horario livre o alvo continua bloqueado")
    fun outsideTheWindowStillBlocks() {
        val verdict = decider.decide(instagram, comHorarioLivre, emptySet(), null, null, relogio(14))

        assertEquals(BlockOutcome.BLOCK, verdict.outcome)
    }

    @Test
    @DisplayName("barreira: com modo restrito ligado o horario livre nao vale")
    fun restrictedModeKeepsBlockingInsideTheWindow() {
        val restrito = comHorarioLivre.copy(restricted = true)

        val verdict = decider.decide(instagram, restrito, emptySet(), null, null, relogio(12))

        assertEquals(BlockOutcome.BLOCK, verdict.outcome)
    }

    @Test
    @DisplayName("barreira: relogio manual mantem o bloqueio mesmo na faixa")
    fun manualClockKeepsBlockingInsideTheWindow() {
        val verdict = decider.decide(
            instagram, comHorarioLivre, emptySet(), null, null, relogio(12, automatico = false)
        )

        assertEquals(BlockOutcome.BLOCK, verdict.outcome)
    }

    @Test
    @DisplayName("regressao: sem leitura de relogio o decisor se comporta como antes")
    fun withoutClockTheDecisionIsUnchanged() {
        val verdict = decider.decide(instagram, comHorarioLivre, emptySet(), null)

        assertEquals(BlockOutcome.BLOCK, verdict.outcome)
    }

    @Test
    @DisplayName("barreira: horario livre do navegador nao libera site da lista")
    fun browserExceptionDoesNotUnlockSite() {
        val policy = sites.copy(
            blockedPackages = setOf(chrome),
            exceptions = mapOf(chrome to listOf(almoco))
        )

        val verdict = decider.decide(
            chrome, policy, emptySet(), null, BrowserAddress(chrome, "instagram.com"), relogio(12)
        )

        assertEquals(BlockOutcome.BLOCK, verdict.outcome)
        assertEquals("instagram.com", verdict.blockedHost)
    }

    @Test
    @DisplayName("barreira 2: app critico continua liberado por ser critico, nao pelo horario")
    fun criticalStillWinsOverException() {
        val policy = BlockPolicy(setOf(dialer), exceptions = mapOf(dialer to listOf(almoco)))

        val verdict = decider.decide(dialer, policy, setOf(dialer), null, null, relogio(12))

        assertEquals(AllowReason.CRITICAL_APP, verdict.allowReason)
    }
}
