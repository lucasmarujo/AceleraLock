package com.aceleralock.blocker

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.Settings
import android.telecom.TelecomManager

/**
 * Barreira 2. Resolve os papeis SEMPRE dinamicamente — OEM e configuracao do
 * usuario mudam os pacotes, e o discador padrao pode mudar depois de o usuario
 * ter configurado os bloqueios. Nome de pacote fixo aqui seria o caminho para
 * alguem bloquear o proprio discador e ficar sem emergencia.
 *
 * O discador vem do [TelecomManager], nao do `RoleManager`: a API publica de
 * papeis so responde sobre o PROPRIO app (`isRoleHeld`), nunca sobre quem
 * detem um papel. `getRoleHoldersAsUser` existe, mas e `@SystemApi` — exige
 * MANAGE_ROLE_HOLDERS e nao esta no SDK publico, entao nao compila. Nao
 * "voltar" para RoleManager aqui.
 *
 * O conjunto e uma lista de nunca-bloquear: aumentar e sempre seguro, diminuir
 * nao. Na duvida, incluir.
 */
class CriticalAppResolver(private val context: Context) {

    fun resolve(): Set<String> {
        val packages = mutableSetOf<String>()
        packages += context.packageName
        val telecom = runCatching {
            context.getSystemService(TelecomManager::class.java)
        }.getOrNull()
        if (telecom != null) {
            // defaultDialer e o que o usuario escolheu; systemDialer e o do
            // fabricante, que continua atendendo emergencia mesmo se o padrao
            // for um discador de terceiros. Os dois entram.
            runCatching { telecom.defaultDialerPackage }.getOrNull()?.let(packages::add)
            runCatching { telecom.systemDialerPackage }.getOrNull()?.let(packages::add)
        }
        resolveDefault(Intent(Intent.ACTION_DIAL, Uri.parse("tel:")))?.let(packages::add)
        resolveDefault(Intent(Settings.ACTION_SETTINGS))?.let(packages::add)
        resolveDefault(Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME))?.let(packages::add)
        packages += KNOWN_EMERGENCY_PACKAGES
        return packages.filter { it.isNotBlank() }.toSet()
    }

    private fun resolveDefault(intent: Intent): String? =
        runCatching {
            context.packageManager.resolveActivity(intent, 0)?.activityInfo?.packageName
        }.getOrNull()

    private companion object {
        val KNOWN_EMERGENCY_PACKAGES = setOf("com.android.emergency")
    }
}
