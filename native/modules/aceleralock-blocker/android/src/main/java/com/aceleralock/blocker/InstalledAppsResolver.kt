package com.aceleralock.blocker

import android.content.Context
import android.content.Intent
import java.text.Collator

data class InstalledApp(val packageName: String, val label: String)

/**
 * O que o seletor de apps pode oferecer. So apps com icone de launcher: o que
 * a pessoa reconhece como "um app" e o que ela abre sem querer — servico de
 * sistema sem tela nao rouba tempo de ninguem, e listar centenas deles
 * afogaria a escolha.
 *
 * Os criticos ([CriticalAppResolver]) ficam de fora porque o
 * [com.aceleralock.blocker.core.BlockDecider] os libera sempre: oferecer o
 * discador na lista seria deixar marcar algo que nunca bloqueia — a tela
 * mentiria sobre o proprio efeito. Resolver e sempre dinamico pelo mesmo
 * motivo que la: o discador padrao muda depois da configuracao.
 */
class InstalledAppsResolver(
    private val context: Context,
    private val critical: CriticalAppResolver
) {

    fun resolve(): List<InstalledApp> {
        val manager = context.packageManager
        val criticalPackages = critical.resolve()
        val launcherIntent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)

        @Suppress("DEPRECATION")
        val resolved = manager.queryIntentActivities(launcherIntent, 0)

        // Collator, nao sortedBy: com nome acentuado o sort de String joga
        // "Ágenda" pro fim da lista, longe de onde a pessoa procura.
        val byLabel = Collator.getInstance().let { collator ->
            compareBy<InstalledApp> { collator.getCollationKey(it.label) }
        }

        return resolved
            .asSequence()
            .map { it.activityInfo.applicationInfo }
            .filter { it.packageName !in criticalPackages }
            .distinctBy { it.packageName }
            .map { InstalledApp(it.packageName, manager.getApplicationLabel(it).toString()) }
            .sortedWith(byLabel)
            .toList()
    }
}
