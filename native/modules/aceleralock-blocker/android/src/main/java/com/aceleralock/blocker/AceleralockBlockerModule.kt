package com.aceleralock.blocker

import com.aceleralock.blocker.core.BlockPolicy
import com.aceleralock.blocker.core.PolicyRead
import com.aceleralock.blocker.core.ProtectionLog
import com.aceleralock.blocker.core.WaitTarget
import com.aceleralock.blocker.core.WaitingPeriod
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.time.Duration

/**
 * Ponte fina para o React Native. Toda decisao de bloqueio vive no core
 * (Kotlin puro, testado em JVM). Esta camada so (1) le estado de permissao,
 * (2) resolve a lista de apps criticos, e (3) entrega ao nativo a BlockPolicy
 * calculada pelo JS a partir do que o user configurou.
 *
 * Nao existe funcao que libere um app na hora. Liberar exige pedir e esperar, e
 * desligar a protecao passa pela mesma espera — porta dos fundos aqui tornaria a
 * espera do outro lado encenacao.
 */
class AceleralockBlockerModule : Module() {

    override fun definition() = ModuleDefinition {
        Name("AceleralockBlocker")

        Function("probePermissions") {
            val state = PermissionProbe(context).probe()
            mapOf(
                "usageAccess" to state.usageAccess,
                "overlay" to state.overlay,
                "batteryExempt" to state.batteryExempt,
                "notifications" to state.notifications,
                "coreGranted" to state.coreGranted
            )
        }

        Function("criticalPackages") {
            CriticalAppResolver(context).resolve().toList()
        }

        /**
         * AsyncFunction, ao contrario de todo o resto daqui: as outras leituras
         * sao SharedPreferences ou AppOps, baratas o bastante para a thread de JS.
         * Esta varre o PackageManager e resolve o rotulo de cada app instalado —
         * numa lista de duzentos apps isso trava a UI se for sincrono.
         */
        AsyncFunction("installedApps") {
            InstalledAppsResolver(context, CriticalAppResolver(context)).resolve().map {
                mapOf("packageName" to it.packageName, "label" to it.label, "iconUri" to it.iconUri)
            }
        }

        /**
         * A politica vigente, para a tela de selecao abrir ja marcando o que esta
         * bloqueado. Herda de currentPolicy() a recusa em politica ilegivel: devolver
         * lista vazia diria "nada bloqueado" para quem tem tudo bloqueado, e a tela
         * salvaria esse apagamento por cima.
         */
        Function("blockedPackages") {
            currentPolicy().blockedPackages.toList()
        }

        Function("setBlockedPackages") { packages: Array<String> ->
            BlockerService.writePolicy(context, currentPolicy().copy(blockedPackages = packages.toSet()))
        }

        Function("configureInitialDurations") { waitMinutes: Int, grantMinutes: Int ->
            waiting().configureInitial(
                Duration.ofMinutes(waitMinutes.toLong()),
                Duration.ofMinutes(grantMinutes.toLong())
            )
        }

        Function("requestUnlock") { packageName: String ->
            request(WaitTarget.UnlockApp(packageName))
        }

        Function("requestStopProtection") {
            request(WaitTarget.StopProtection)
        }

        Function("requestDurationChange") { waitMinutes: Int, grantMinutes: Int ->
            request(
                WaitTarget.ChangeDurations(
                    Duration.ofMinutes(waitMinutes.toLong()),
                    Duration.ofMinutes(grantMinutes.toLong())
                )
            )
        }

        Function("cancelRequest") { waiting().cancel() }

        Function("protectionState") {
            val period = waiting()
            val pending = period.pending()
            val log = ProtectionLog(SharedPreferencesStore(context), SystemMonotonicClock)
            mapOf(
                // Flag persistida, nunca "o servico esta no ar agora": servico morto por
                // falta de memoria diria "pausado" a quem nunca pausou.
                "protectionActive" to log.isActive(),
                "downtimeTotalSeconds" to log.totalMeasuredDowntime().seconds,
                // null = houve interrupcao que atravessou reboot e nao da para cronometrar.
                "downtimeLastSeconds" to log.lastInterruption()?.duration?.seconds,
                "downtimeUnknownCount" to log.unknownInterruptions(),
                "configured" to period.isConfigured(),
                "waitMinutes" to period.waitDuration().toMinutes(),
                "grantMinutes" to period.grantDuration().toMinutes(),
                "pendingTarget" to pending?.let(::describeTarget),
                "pendingRemainingSeconds" to pending?.remaining?.seconds,
                "pendingReady" to (pending?.isReady ?: false)
            )
        }

        Function("start") { BlockerService.start(context) }

        /**
         * Desligar exige a espera cumprida. O servico desliga a si mesmo quando o
         * pedido amadurece; aqui a chamada crua so pode recusar.
         */
        Function("stop") {
            throw IllegalStateException(
                "desligar a protecao exige requestStopProtection e a espera cumprida"
            )
        }
    }

    private fun request(target: WaitTarget): Boolean {
        val accepted = waiting().request(target)
        if (accepted) {
            BlockerService.start(context)
        }
        return accepted
    }

    private fun describeTarget(pending: com.aceleralock.blocker.core.PendingWait): String =
        when (pending.target) {
            is WaitTarget.UnlockApp -> "UNLOCK_APP"
            is WaitTarget.StopProtection -> "STOP_PROTECTION"
            is WaitTarget.ChangeDurations -> "CHANGE_DURATIONS"
        }

    private fun waiting(): WaitingPeriod =
        WaitingPeriod(SharedPreferencesStore(context), SystemMonotonicClock)

    /**
     * Toda escrita aqui e read-modify-write. Com a leitura antiga, politica ilegivel
     * virava BlockPolicy() vazia e a gravacao seguinte apagava os bloqueios de vez —
     * corromper o arquivo e chamar qualquer uma destas funcoes era o suficiente.
     * Agora a escrita e recusada em vez de persistir o apagamento.
     */
    private fun currentPolicy(): BlockPolicy = when (val read = BlockerService.readPolicy(context)) {
        is PolicyRead.Absent -> BlockPolicy()
        is PolicyRead.Loaded -> read.policy
        is PolicyRead.Unreadable ->
            throw IllegalStateException("politica ilegivel: gravar agora apagaria os bloqueios")
    }

    private val context
        get() = requireNotNull(appContext.reactContext) { "sem contexto do React" }
}
