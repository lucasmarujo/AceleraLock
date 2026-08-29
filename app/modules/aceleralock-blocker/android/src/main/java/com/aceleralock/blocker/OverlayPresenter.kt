package com.aceleralock.blocker

import android.content.Context
import android.graphics.PixelFormat
import android.os.Build
import android.provider.Settings
import android.view.Gravity
import android.view.View
import android.view.WindowManager

/**
 * O overlay sobe via WindowManager.addView, NAO iniciando uma Activity.
 *
 * Android 10+ restringe background activity starts. SYSTEM_ALERT_WINDOW e excecao
 * a essa restricao, mas depender de excecao que a Google ja apertou duas vezes e
 * fragil. addView nao e inicio de Activity, entao a restricao nao se aplica.
 */
class OverlayPresenter(private val context: Context) {

    private val windowManager =
        context.getSystemService(Context.WINDOW_SERVICE) as WindowManager

    private var shownFor: String? = null
    private var view: View? = null

    fun canDrawOverlays(): Boolean = Settings.canDrawOverlays(context)

    fun currentlyShownFor(): String? = shownFor

    fun show(packageName: String, viewFactory: (Context) -> View) {
        if (shownFor == packageName) {
            return
        }
        hide()
        if (!canDrawOverlays()) {
            return
        }
        val created = viewFactory(context)
        windowManager.addView(created, layoutParams())
        view = created
        shownFor = packageName
    }

    fun hide() {
        view?.let { runCatching { windowManager.removeView(it) } }
        view = null
        shownFor = null
    }

    private fun layoutParams(): WindowManager.LayoutParams {
        val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        } else {
            @Suppress("DEPRECATION")
            WindowManager.LayoutParams.TYPE_SYSTEM_ALERT
        }
        return WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.MATCH_PARENT,
            type,
            WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON,
            PixelFormat.OPAQUE
        ).apply {
            gravity = Gravity.TOP or Gravity.START
        }
    }
}
