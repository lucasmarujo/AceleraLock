package com.aceleralock.blocker

import android.app.role.RoleManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings

/**
 * Barreira 2. Resolve os papeis SEMPRE dinamicamente — OEM e configuracao do
 * usuario mudam os pacotes, e o discador padrao pode mudar depois de o usuario
 * ter configurado os bloqueios. Nome de pacote fixo aqui seria o caminho para
 * alguem bloquear o proprio discador e ficar sem emergencia.
 */
class CriticalAppResolver(private val context: Context) {

    fun resolve(): Set<String> {
        val packages = mutableSetOf<String>()
        packages += context.packageName
        roleHolder(RoleManager.ROLE_DIALER)?.let(packages::add)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            roleHolder(ROLE_EMERGENCY)?.let(packages::add)
        }
        resolveDefault(Intent(Intent.ACTION_DIAL, Uri.parse("tel:")))?.let(packages::add)
        resolveDefault(Intent(Settings.ACTION_SETTINGS))?.let(packages::add)
        resolveDefault(Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME))?.let(packages::add)
        packages += KNOWN_EMERGENCY_PACKAGES
        return packages.filter { it.isNotBlank() }.toSet()
    }

    private fun roleHolder(role: String): String? {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            return null
        }
        val manager = context.getSystemService(RoleManager::class.java) ?: return null
        return runCatching { manager.getRoleHoldersAsUser(role, android.os.Process.myUserHandle()) }
            .getOrNull()
            ?.firstOrNull()
    }

    private fun resolveDefault(intent: Intent): String? =
        runCatching {
            context.packageManager.resolveActivity(intent, 0)?.activityInfo?.packageName
        }.getOrNull()

    private companion object {
        const val ROLE_EMERGENCY = "android.app.role.EMERGENCY"
        val KNOWN_EMERGENCY_PACKAGES = setOf("com.android.emergency")
    }
}
