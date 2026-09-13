package com.aceleralock.blocker

import android.accessibilityservice.AccessibilityService
import android.content.Intent
import android.view.accessibility.AccessibilityEvent
import com.aceleralock.blocker.core.BrowserAddress

/**
 * Le a barra de endereco dos navegadores listados, e nada alem disso. Nao detecta
 * app em primeiro plano (isso segue no UsageStatsManager), nao desenha overlay e nao
 * impede desinstalacao: so publica o ultimo endereco visto para o BlockerService
 * decidir no proprio tick.
 *
 * O endereco fica so em memoria. Gravar em disco seria historico de navegacao, e o
 * produto nao guarda isso. Tambem nao inicia o BlockerService: um evento de navegador
 * religaria uma protecao que a pessoa pausou.
 *
 * Os view ids mudam entre versoes dos navegadores e nao tem teste possivel fora do
 * aparelho. Se um site da lista parar de bloquear num navegador, e aqui que se olha.
 * A lista de pacotes repete `packageNames` do XML de configuracao, que e o que faz o
 * sistema nem entregar evento de outro app.
 */
class SiteAccessibilityService : AccessibilityService() {

    override fun onAccessibilityEvent(event: AccessibilityEvent) {
        val pacote = event.packageName?.toString() ?: return
        val barra = URL_BARS[pacote] ?: return
        // Com o overlay focavel por cima, a janela ativa e a nossa. Ignorar em vez de
        // limpar: o endereco do navegador coberto continua valendo.
        val raiz = rootInActiveWindow ?: return
        if (raiz.packageName?.toString() != pacote) return
        val texto = raiz.findAccessibilityNodeInfosByViewId(barra)
            .firstOrNull()?.text?.toString() ?: return
        lastAddress = BrowserAddress(pacote, texto)
    }

    override fun onInterrupt() = Unit

    override fun onUnbind(intent: Intent?): Boolean {
        lastAddress = null
        return super.onUnbind(intent)
    }

    companion object {
        @Volatile
        var lastAddress: BrowserAddress? = null
            private set

        private val URL_BARS = mapOf(
            "com.android.chrome" to "com.android.chrome:id/url_bar",
            "com.sec.android.app.sbrowser" to "com.sec.android.app.sbrowser:id/location_bar_edit_text",
            "org.mozilla.firefox" to "org.mozilla.firefox:id/mozac_browser_toolbar_url_view",
            "com.microsoft.emmx" to "com.microsoft.emmx:id/url_bar",
            "com.brave.browser" to "com.brave.browser:id/url_bar"
        )
    }
}
