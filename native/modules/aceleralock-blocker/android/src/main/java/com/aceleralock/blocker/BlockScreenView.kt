package com.aceleralock.blocker

import android.content.Context
import android.content.Intent
import android.graphics.drawable.GradientDrawable
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.widget.Button
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView

/**
 * A tela que a pessoa ve por cima do app bloqueado.
 *
 * Nao existe botao de desbloquear aqui, de proposito: o unico caminho e abrir o
 * AceleraLock e pedir, com a espera. E o tom nao repreende — quem chegou aqui pediu
 * ajuda e a ajuda esta funcionando; a tela confirma isso, nao cobra.
 *
 * O corpo nao instrui, motiva: uma frase sorteada de mil, diferente a cada tentativa.
 * Quem chega aqui ja sabe que o app esta bloqueado — repetir o procedimento seria
 * dar a ele mais uma porta pra olhar. A espera ao vivo mora dentro do app.
 *
 * Cores e icone vem de recurso, com variante -night nas cores, para o **sistema**
 * decidir o tema. Ler uiMode aqui seria um segundo lugar decidindo o que o Android
 * ja decide.
 */
class BlockScreenView(
    context: Context,
    private val blockedPackage: String
) : LinearLayout(context) {

    init {
        orientation = VERTICAL
        gravity = Gravity.CENTER
        setBackgroundColor(color(R.color.aceleralock_canvas))
        setPadding(dp(32), dp(32), dp(32), dp(32))
        isClickable = true

        addView(brandMark())
        addView(titleText())
        addView(motivationText())
        addView(closeButton())
    }

    /**
     * O cadeado da marca, o mesmo dos icones do app. Um asset so serve os dois temas:
     * o turquesa com alfa le tanto sobre o canvas claro quanto sobre o escuro, entao
     * nao ha par claro/escuro a manter em sincronia aqui.
     */
    private fun brandMark(): View = ImageView(context).apply {
        setImageResource(R.drawable.ic_aceleralock_mark)
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

    /**
     * O sorteio acontece aqui, na construcao da view — e nao num ciclo de refresh —
     * porque o OverlayPresenter so constroi uma view nova quando o pacote em primeiro
     * plano muda. Uma view nova por tentativa e exatamente "frase diferente toda vez
     * que ele tentar abrir"; sortear no refresh trocaria a frase debaixo dos olhos de
     * quem esta lendo.
     */
    private fun motivationText(): View = ShimmerTextView(
        context,
        color(R.color.aceleralock_text_secondary),
        color(R.color.aceleralock_text_brand)
    ).apply {
        text = resources.getStringArray(R.array.aceleralock_block_motivation).random()
        setTextSize(TypedValue.COMPLEX_UNIT_SP, 17f)
        gravity = Gravity.CENTER
        layoutParams = LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT)
            .apply { bottomMargin = dp(32) }
    }

    /**
     * "Fechar" nao pode so esconder o overlay: o detector continuaria vendo o app
     * bloqueado em primeiro plano e o overlay voltaria no proximo tick, em ate um
     * segundo. Ir para a home tira do primeiro plano, que e a condicao que sustenta o
     * bloqueio — sem fechar nem punir o app-alvo, que segue em recentes.
     *
     * E a unica acao da tela, que e como a regra anti-dark-pattern quer: a saida sem
     * friccao nunca com peso menor que outra coisa.
     */
    private fun closeButton(): View = Button(context).apply {
        text = context.getString(R.string.aceleralock_block_close)
        setTextColor(color(R.color.aceleralock_primary_on_fill))
        background = GradientDrawable().apply {
            // Capsula em qualquer altura: o GradientDrawable limita o raio a
            // min(largura, altura) / 2 antes de desenhar, entao um raio grande e
            // exatamente "100% arredondado" sem depender da altura medida do botao.
            cornerRadius = dp(100).toFloat()
            setColor(color(R.color.aceleralock_primary_fill))
        }
        setPadding(dp(24), dp(14), dp(24), dp(14))
        layoutParams = LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT)
        setOnClickListener { goHome() }
    }

    private fun goHome() {
        context.startActivity(
            Intent(Intent.ACTION_MAIN)
                .addCategory(Intent.CATEGORY_HOME)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        )
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
}
