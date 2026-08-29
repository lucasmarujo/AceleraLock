package com.aceleralock.blocker.core

import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotEquals
import kotlin.test.assertTrue

class TargetRegistryTest {

    private val instagram = "com.instagram.android"

    @Test
    @DisplayName("regressao: clientRef do mesmo pacote em dois aparelhos e diferente")
    fun clientRefDiffersAcrossDevices() {
        val deviceA = TargetRegistry()
        val deviceB = TargetRegistry()

        val refA = deviceA.clientRefFor(instagram)
        val refB = deviceB.clientRefFor(instagram)

        assertNotEquals(refA, refB, "refs iguais significam que sobrou derivacao do packageName")
    }

    @Test
    @DisplayName("regressao: clientRef nao contem nem deriva do nome do pacote")
    fun clientRefLeaksNothingAboutThePackage() {
        val registry = TargetRegistry()

        val ref = registry.clientRefFor(instagram)

        assertTrue(ref.none { it !in "0123456789abcdef" }, "ref deve ser opaco em hex")
        assertEquals(32, ref.length, "128 bits de aleatoriedade")
        listOf("instagram", "com.", "android").forEach {
            assertTrue(!ref.contains(it), "ref nao pode carregar pedaco do pacote")
        }
    }

    @Test
    @DisplayName("regressao: mil pacotes distintos geram mil refs distintos, sem colisao")
    fun refsDoNotCollide() {
        val registry = TargetRegistry()

        val refs = (1..1000).map { registry.clientRefFor("com.exemplo.app$it") }.toSet()

        assertEquals(1000, refs.size)
    }

    @Test
    @DisplayName("feliz: o mesmo pacote no mesmo aparelho reusa o ref, para idempotencia")
    fun sameDeviceReusesRefForIdempotency() {
        val registry = TargetRegistry()

        assertEquals(registry.clientRefFor(instagram), registry.clientRefFor(instagram))
    }

    @Test
    @DisplayName("feliz: targetId do servidor resolve de volta para o pacote local")
    fun targetIdResolvesBackToPackage() {
        val registry = TargetRegistry()
        registry.rememberTarget("0199-abcd", instagram)

        assertEquals(instagram, registry.packageFor("0199-abcd"))
    }

    @Test
    @DisplayName("borda: alvo desconhecido nunca casa com um pacote real")
    fun unknownTargetNeverMatchesARealPackage() {
        val registry = TargetRegistry()

        val resolved = registry.packageFor("alvo-de-outro-aparelho")

        assertEquals(TargetRegistry.UNKNOWN_TARGET, resolved)
        assertTrue(resolved.contains(" "), "packageName real nunca contem espaco")
    }

    @Test
    @DisplayName("feliz: restaurar recupera mapa e refs sem regerar")
    fun restoreKeepsRefsStable() {
        val registry = TargetRegistry()
        val ref = registry.clientRefFor(instagram)
        registry.rememberTarget("t1", instagram)

        val restored = TargetRegistry()
        restored.restore(registry.snapshot(), registry.clientRefSnapshot())

        assertEquals(ref, restored.clientRefFor(instagram))
        assertEquals(instagram, restored.packageFor("t1"))
    }
}
