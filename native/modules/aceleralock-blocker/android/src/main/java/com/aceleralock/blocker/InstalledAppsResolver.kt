package com.aceleralock.blocker

import android.content.Context
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.drawable.Drawable
import java.io.File
import java.text.Collator

data class InstalledApp(val packageName: String, val label: String, val iconUri: String?)

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
            .map {
                InstalledApp(
                    packageName = it.packageName,
                    label = manager.getApplicationLabel(it).toString(),
                    iconUri = cachedIconUri(it)
                )
            }
            .sortedWith(byLabel)
            .toList()
    }

    /**
     * Arquivo no cache e `file://`, nao data URI base64: um aparelho com cem
     * apps mandaria alguns megabytes de string pela ponte a cada abertura da
     * tela, e o RN ainda teria de decodificar cada uma na thread de JS. Com
     * arquivo, a ponte leva so o caminho e o carregamento fica com o
     * componente de imagem, fora do JS.
     *
     * Regrava so quando o APK e mais novo que o PNG (atualizacao do app trocou
     * o icone). `sourceDir` ja vem no ApplicationInfo — nao custa uma consulta
     * a mais ao PackageManager so pra saber a data.
     *
     * Icone que falha vira null e a linha aparece sem ele: um Drawable
     * problematico nao pode sumir com o app da lista de escolha.
     */
    private fun cachedIconUri(info: ApplicationInfo): String? = runCatching {
        val directory = File(context.cacheDir, ICON_DIRECTORY).apply { mkdirs() }
        val file = File(directory, "${info.packageName}.png")
        val apkUpdatedAt = File(info.sourceDir).lastModified()

        if (!file.exists() || file.lastModified() < apkUpdatedAt) {
            val bitmap = render(context.packageManager.getApplicationIcon(info))
            file.outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
            bitmap.recycle()
        }

        "file://${file.absolutePath}"
    }.getOrNull()

    /**
     * Desenha em Canvas em vez de ler o bitmap de dentro do Drawable: icone
     * adaptativo (Android 8+) e a composicao de duas camadas, e nao tem bitmap
     * pronto pra pegar — so desenhando sai o icone que o launcher mostra.
     */
    private fun render(drawable: Drawable): Bitmap {
        val bitmap = Bitmap.createBitmap(ICON_PIXELS, ICON_PIXELS, Bitmap.Config.ARGB_8888)
        drawable.setBounds(0, 0, ICON_PIXELS, ICON_PIXELS)
        drawable.draw(Canvas(bitmap))
        return bitmap
    }

    private companion object {
        const val ICON_DIRECTORY = "app-icons"

        /** 48dp em xxhdpi — a linha da lista desenha 40dp, sobra pra tela densa. */
        const val ICON_PIXELS = 144
    }
}
