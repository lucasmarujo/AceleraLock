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
}
