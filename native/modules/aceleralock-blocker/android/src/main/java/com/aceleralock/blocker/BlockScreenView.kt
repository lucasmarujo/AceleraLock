package com.aceleralock.blocker

import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.util.Log
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.widget.Button
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import java.time.Duration

/**
 * A tela que a pessoa ve por cima do app bloqueado.
 *
 * Nao existe botao de desbloquear aqui, de proposito: o unico caminho e abrir o
 * AceleraLock e pedir, com a espera. E o tom nao repreende — quem chegou aqui pediu
 * ajuda e a ajuda esta funcionando; a tela confirma isso, nao cobra.
 *
 * Cores e icone vem de recurso, com variante -night, para o **sistema** decidir o tema.
 * Ler uiMode aqui seria um segundo lugar decidindo o que o Android ja decide.
 */
class BlockScreenView(
    context: Context,
    private val blockedPackage: String,
    private val remainingOf: (String) -> Duration?
) : LinearLayout(context) {

    private val bodyText: TextView

    init {
        orientation = VERTICAL
        gravity = Gravity.CENTER
        setBackgroundColor(color(R.color.aceleralock_canvas))
        setPadding(dp(32), dp(32), dp(32), dp(32))
        isClickable = true

        addView(shieldIcon())
        addView(titleText())
        bodyText = bodyText()
        addView(bodyText)
        addView(primaryButton())
        addView(secondaryButton())
    }

    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        postDelayed(refreshBody, REFRESH_INTERVAL_MILLIS)
    }

    override fun onDetachedFromWindow() {
        removeCallbacks(refreshBody)
        super.onDetachedFromWindow()
    }

    /**
     * O texto de espera nao precisa de precisao de segundo: aqui e contexto, e o
     * contador ao vivo mora no app. Meio minuto cumpre "sempre visivel e verdadeiro"
     * sem parecer contagem regressiva de bomba.
     */
    private val refreshBody = object : Runnable {
        override fun run() {
            bodyText.text = bodyMessage()
            postDelayed(this, REFRESH_INTERVAL_MILLIS)
        }
    }

    private fun shieldIcon(): View = ImageView(context).apply {
        setImageResource(R.drawable.ic_shield)
        layoutParams = LayoutParams(dp(72), dp(72)).apply { bottomMargin = dp(24) }
    }

    private fun titleText(): View = TextView(context).apply {
        text = appLabel()
            ?.let { context.getString(R.string.aceleralock_block_title, it) }
            ?: context.getString(R.string.aceleralock_block_title_unknown)
        setTextColor(color(R.color.aceleralock_text_primary))
        setTextSize(TypedValue.COMPLEX_UNIT_SP, 22f)
        typeface = android.graphics.Typeface.DEFAULT_BOLD
        gravity = Gravity.CENTER
        layoutParams = LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT)
            .apply { bottomMargin = dp(12) }
    }

    private fun bodyText(): TextView = TextView(context).apply {
        text = bodyMessage()
        setTextColor(color(R.color.aceleralock_text_secondary))
        setTextSize(TypedValue.COMPLEX_UNIT_SP, 17f)
        gravity = Gravity.CENTER
        layoutParams = LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT)
            .apply { bottomMargin = dp(32) }
    }

    private fun bodyMessage(): String {
        val remaining = remainingOf(blockedPackage)
            ?: return context.getString(R.string.aceleralock_block_body_no_request)
        val minutes = maxOf(remaining.toMinutes(), 1L)
        return context.resources.getQuantityString(
            R.plurals.aceleralock_block_body_waiting, minutes.toInt(), minutes.toInt()
        )
    }

    /**
     * "Fechar" nao pode so esconder o overlay: o detector continuaria vendo o app
     * bloqueado em primeiro plano e o overlay voltaria no proximo tick, em ate um
     * segundo. Ir para a home tira do primeiro plano, que e a condicao que sustenta o
     * bloqueio — sem fechar nem punir o app-alvo, que segue em recentes.
     */
    private fun primaryButton(): View = Button(context).apply {
        text = context.getString(R.string.aceleralock_block_close)
        setTextColor(color(R.color.aceleralock_primary_on_fill))
        background = GradientDrawable().apply {
            cornerRadius = dp(12).toFloat()
            setColor(color(R.color.aceleralock_primary_fill))
        }
        setPadding(dp(24), dp(14), dp(24), dp(14))
        layoutParams = LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT)
            .apply { bottomMargin = dp(12) }
        setOnClickListener { goHome() }
    }

    private fun secondaryButton(): View = Button(context).apply {
        text = context.getString(R.string.aceleralock_block_open_app)
        setTextColor(color(R.color.aceleralock_text_brand))
        setBackgroundColor(Color.TRANSPARENT)
        layoutParams = LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT)
        setOnClickListener { openAceleralock() }
    }

    private fun goHome() {
        context.startActivity(
            Intent(Intent.ACTION_MAIN)
                .addCategory(Intent.CATEGORY_HOME)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        )
    }

    /**
     * Abrir o app e iniciar uma Activity de fora de uma Activity, o que o Android 10+
     * restringe. A excecao que sustenta isto e ter SYSTEM_ALERT_WINDOW concedida — a
     * mesma excecao que o OverlayPresenter documenta como fragil e que a Google ja
     * apertou duas vezes.
     *
     * ESTE E O PRIMEIRO BOTAO A QUEBRAR se apertarem de novo. Se um dia ele parar de
     * abrir o app, o problema esta aqui e nao no deep link. Nao ha alternativa: abrir
     * um app e abrir uma Activity.
     */
    private fun openAceleralock() {
        val deepLink = Intent(Intent.ACTION_VIEW, Uri.parse(WAITING_SCREEN_URI))
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        if (deepLink.resolveActivity(context.packageManager) != null) {
            runCatching { context.startActivity(deepLink) }.onSuccess { return }
        }
        val launch = context.packageManager.getLaunchIntentForPackage(context.packageName)
        if (launch != null) {
            runCatching { context.startActivity(launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
                .onSuccess { return }
        }
        Log.w(TAG, "nao foi possivel abrir o AceleraLock; caindo na home do sistema")
        goHome()
    }

    /**
     * Nome do app coberto. O fallback e caminho real, nao decoracao: a partir do
     * Android 11 a visibilidade de pacotes e restrita, e resolver o rotulo pode falhar
     * sem uma entrada <queries> no manifesto. Isso so se confirma com o modulo
     * compilando num aparelho — se o titulo aparecer generico no device, e aqui que
     * se olha.
     */
    private fun appLabel(): String? = runCatching {
        val manager = context.packageManager
        manager.getApplicationLabel(manager.getApplicationInfo(blockedPackage, 0)).toString()
    }.getOrNull()

    private fun color(id: Int): Int = context.getColor(id)

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

    private companion object {
        const val TAG = "BlockScreenView"
        const val REFRESH_INTERVAL_MILLIS = 30_000L
        const val WAITING_SCREEN_URI = "aceleralock://esperando"
    }
}
