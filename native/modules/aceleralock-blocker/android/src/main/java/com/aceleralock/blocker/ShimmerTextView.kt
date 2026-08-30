package com.aceleralock.blocker

import android.animation.ValueAnimator
import android.content.Context
import android.graphics.LinearGradient
import android.graphics.Matrix
import android.graphics.Shader
import android.provider.Settings
import android.view.animation.LinearInterpolator
import android.widget.TextView

/**
 * TextView com um brilho varrendo o texto em looping.
 *
 * Sem biblioteca: e um LinearGradient no paint da propria TextView, com a matriz
 * local do shader sendo transladada por um ValueAnimator. As duas pontas do
 * gradiente sao a mesma cor base, entao o TileMode.CLAMP fora da faixa nao cria
 * borda visivel — so a banda do meio se move.
 *
 * O sweep e ambiente, nao urgencia: nada pisca, nada acelera, nada fica vermelho.
 * A regra de §3.4 do design-system continua valendo, esta tela nao alarma ninguem.
 *
 * ponytail: invalidate a ~60fps enquanto a view estiver anexada, numa janela com
 * FLAG_KEEP_SCREEN_ON. A tela e transitoria (a pessoa toca "Fechar" e sai), entao
 * passa; se aparecer em medicao de bateria, o upgrade e parar o sweep depois de
 * alguns ciclos, nao trocar de tecnica.
 */
class ShimmerTextView(
    context: Context,
    private val baseColor: Int,
    private val highlightColor: Int
) : TextView(context) {

    private val localMatrix = Matrix()
    private var gradient: LinearGradient? = null

    private val sweep = ValueAnimator.ofFloat(0f, 1f).apply {
        duration = SWEEP_MILLIS
        repeatCount = ValueAnimator.INFINITE
        interpolator = LinearInterpolator()
        addUpdateListener { animator ->
            val shader = gradient ?: return@addUpdateListener
            val fraction = animator.animatedValue as Float
            localMatrix.setTranslate(width * (fraction * (1f + BAND_RATIO) - BAND_RATIO), 0f)
            shader.setLocalMatrix(localMatrix)
            invalidate()
        }
    }

    init {
        setTextColor(baseColor)
    }

    /**
     * O shader so pode ser montado depois da medida — antes do layout a largura e
     * zero e o gradiente sairia degenerado. Sob reduce-motion nenhum shader e
     * instalado, e ai o setTextColor do init e quem manda na cor.
     */
    override fun onSizeChanged(width: Int, height: Int, oldWidth: Int, oldHeight: Int) {
        super.onSizeChanged(width, height, oldWidth, oldHeight)
        if (width == 0 || !animationsEnabled()) {
            return
        }
        gradient = LinearGradient(
            0f,
            0f,
            width * BAND_RATIO,
            0f,
            intArrayOf(baseColor, highlightColor, baseColor),
            floatArrayOf(0f, 0.5f, 1f),
            Shader.TileMode.CLAMP
        ).also { paint.shader = it }
    }

    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        if (animationsEnabled()) {
            sweep.start()
        }
    }

    override fun onDetachedFromWindow() {
        sweep.cancel()
        super.onDetachedFromWindow()
    }

    /**
     * Respeitar reduce-motion e regra do design-system (§3.3), nao gentileza. Quem
     * desligou animacao no sistema tem motivo — enjoo, vertigem, atencao. A escala
     * de duracao do Animator em zero e o sinal que o Android da pra isso.
     */
    private fun animationsEnabled(): Boolean = Settings.Global.getFloat(
        context.contentResolver,
        Settings.Global.ANIMATOR_DURATION_SCALE,
        1f
    ) != 0f

    private companion object {
        const val SWEEP_MILLIS = 2_400L

        /** Largura da banda de brilho, em fracao da largura da view. */
        const val BAND_RATIO = 0.6f
    }
}
