package com.aceleralock.blocker.core

import java.security.SecureRandom

/**
 * Mapa targetId -> packageName, que vive SO no aparelho. E o analogo Android do
 * mapa targetId -> ApplicationToken do iOS: o servidor conhece apenas referencias
 * opacas e nunca o identificador do app.
 *
 * O `clientRef` enviado ao servidor e ALEATORIO, nunca derivado do packageName.
 * Derivar por hash nao esconderia nada: o conjunto de pacotes Android e pequeno,
 * publico e enumeravel, entao qualquer um com a lista monta a tabela reversa.
 * Truncar piora — aumenta colisao sem aumentar segredo. Hash de valor com pouca
 * entropia so parece opaco, e acreditar nele e pior do que nao ter garantia.
 *
 * O servidor trata `clientRef` como string opaca de idempotencia e nao precisa
 * que ela signifique nada.
 */
class TargetRegistry(private val random: SecureRandom = SecureRandom()) {

    private val targetToPackage = linkedMapOf<String, String>()
    private val packageToClientRef = linkedMapOf<String, String>()

    /** Gera uma referencia nova, sem qualquer relacao com o nome do pacote. */
    @Synchronized
    fun clientRefFor(packageName: String): String =
        packageToClientRef.getOrPut(packageName) { newOpaqueRef() }

    @Synchronized
    fun rememberTarget(targetId: String, packageName: String) {
        targetToPackage[targetId] = packageName
    }

    @Synchronized
    fun packageFor(targetId: String): String = targetToPackage[targetId] ?: UNKNOWN_TARGET

    @Synchronized
    fun snapshot(): Map<String, String> = targetToPackage.toMap()

    @Synchronized
    fun restore(entries: Map<String, String>, refs: Map<String, String>) {
        targetToPackage.clear()
        targetToPackage.putAll(entries)
        packageToClientRef.clear()
        packageToClientRef.putAll(refs)
    }

    @Synchronized
    fun clientRefSnapshot(): Map<String, String> = packageToClientRef.toMap()

    private fun newOpaqueRef(): String {
        val bytes = ByteArray(REF_BYTES)
        random.nextBytes(bytes)
        return bytes.joinToString("") { "%02x".format(it) }
    }

    companion object {
        private const val REF_BYTES = 16

        /**
         * Alvo que o servidor conhece e este aparelho nao sabe resolver — por
         * exemplo, politica restaurada de backup de outro aparelho. Contem espaco,
         * entao nunca casa com um packageName real e nao bloqueia nada por engano.
         */
        const val UNKNOWN_TARGET = " unknown-target"
    }
}
