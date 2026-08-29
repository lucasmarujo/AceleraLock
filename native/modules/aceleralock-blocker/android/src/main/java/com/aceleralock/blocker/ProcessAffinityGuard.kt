package com.aceleralock.blocker

import android.app.ActivityManager
import android.content.Context
import android.os.Process

/**
 * Correcao 2 do plano: o TokenRotator usa exclusao dentro do processo. Isso so
 * basta porque o BlockerService roda no MESMO processo do app — o manifesto do
 * modulo declara o servico sem android:process, de proposito.
 *
 * Se alguem adicionar android:process no futuro, dois processos passam a ter dois
 * locks e a corrida da secao 7 volta inteira: duas rotacoes concorrentes sao
 * indistinguiveis de um refresh token roubado, o backend revoga a familia e o
 * usuario e deslogado — derrubando o bloqueio junto.
 *
 * Este guard falha alto no boot do servico em vez de deixar a corrida aparecer em
 * producao como logout aleatorio.
 */
object ProcessAffinityGuard {

    fun assertSameProcessAsApp(context: Context) {
        val current = currentProcessName(context)
        val expected = context.packageName
        check(current == expected) {
            "BlockerService esta no processo '$current', esperado '$expected'. " +
                "O TokenRotator perde a exclusao mutua entre processos e a rotacao de " +
                "refresh token vira corrida. Remova android:process do manifesto ou " +
                "troque a exclusao para entre processos antes de seguir."
        }
    }

    private fun currentProcessName(context: Context): String? {
        val pid = Process.myPid()
        val manager = context.getSystemService(Context.ACTIVITY_SERVICE) as? ActivityManager
        return manager?.runningAppProcesses?.firstOrNull { it.pid == pid }?.processName
    }
}
