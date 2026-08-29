package com.aceleralock.blocker

import com.aceleralock.blocker.core.BlockPolicy
import com.aceleralock.blocker.core.TemporaryGrant
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.time.Instant

/**
 * Ponte fina para o React Native. Toda decisao de bloqueio vive no core
 * (Kotlin puro, testado em JVM). Esta camada so (1) le estado de permissao,
 * (2) resolve a lista de apps criticos, e (3) entrega ao nativo a BlockPolicy
 * calculada pelo JS a partir do que o user configurou.
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

        Function("setBlockedPackages") { packages: Array<String> ->
            val current = BlockerService.readPolicy(context)
            BlockerService.writePolicy(
                context,
                current.copy(blockedPackages = packages.toSet())
            )
        }

        Function("addGrant") { packageName: String, grantEndsAtIso: String ->
            val current = BlockerService.readPolicy(context)
            val without = current.grants.filter { it.packageName != packageName }
            val updated = current.copy(
                grants = without + TemporaryGrant(packageName, Instant.parse(grantEndsAtIso))
            )
            BlockerService.writePolicy(context, updated)
        }

        Function("clearGrant") { packageName: String ->
            val current = BlockerService.readPolicy(context)
            BlockerService.writePolicy(
                context,
                current.copy(grants = current.grants.filter { it.packageName != packageName })
            )
        }

        Function("start") { BlockerService.start(context) }

        Function("stop") { BlockerService.stop(context) }
    }

    private val context
        get() = requireNotNull(appContext.reactContext) { "sem contexto do React" }
}
