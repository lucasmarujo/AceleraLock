package com.aceleralock.blocker

import com.aceleralock.blocker.core.TokenPair
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.time.Instant

/**
 * Ponte fina para o React Native. Deliberadamente fina: toda decisao de bloqueio
 * vive no core (Kotlin puro, testado em JVM) e toda persistencia de sessao vive no
 * TokenStore nativo.
 *
 * O JS nunca ve o refresh token e nunca chama /v1/auth/refresh — pede um access
 * token pronto. Dois rotacionadores seriam indistinguiveis de um token roubado
 * para o backend, que revogaria a familia e deslogaria o usuario.
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

        Function("clientRefFor") { packageName: String ->
            LocalTargetMap.clientRefFor(packageName)
        }

        Function("rememberTarget") { targetId: String, packageName: String ->
            LocalTargetMap.remember(targetId, packageName)
        }

        Function("adoptSession") { baseUrl: String, deviceId: String, accessToken: String,
                                   expiresInSeconds: Int, refreshToken: String ->
            val store = EncryptedKeyValueStore(context)
            store.putString(SyncCoordinator.KEY_BASE_URL, baseUrl)
            store.putString(SyncCoordinator.KEY_DEVICE_ID, deviceId)
            TokenStore(context, BackendClient(baseUrl)).adopt(
                TokenPair(
                    accessToken = accessToken,
                    accessExpiresAt = Instant.now().plusSeconds(expiresInSeconds.toLong()),
                    refreshToken = refreshToken
                )
            )
        }

        Function("start") { BlockerService.start(context) }

        Function("stop") { BlockerService.stop(context) }

        Function("requestSync") { BlockerService.requestSync(context) }
    }

    private val context
        get() = requireNotNull(appContext.reactContext) { "sem contexto do React" }
}
