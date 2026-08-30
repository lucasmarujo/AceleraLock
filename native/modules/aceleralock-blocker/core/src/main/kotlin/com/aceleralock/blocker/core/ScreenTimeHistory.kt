package com.aceleralock.blocker.core

import java.time.Duration
import java.time.LocalDate

/**
 * Historico diario de tempo de tela, acumulado pelo proprio app.
 *
 * Existe porque o Android **nao guarda** o que a tela do calendario precisa: a
 * granularidade diaria do UsageStatsManager some depois de poucos dias, entao
 * um calendario do mes lido direto do sistema ficaria vazio pra sempre da
 * segunda semana pra tras. Aqui o app grava o que leu enquanto o dado ainda
 * existia.
 *
 * Consequencia honesta: o historico **nasce raso**. Na primeira execucao ele
 * tem so o que o sistema ainda tinha (~7 dias), nao o mes. Ele enche com o
 * tempo, e nao ha como inventar o passado anterior a instalacao.
 */
class ScreenTimeHistory(
    private val store: KeyValueStore,
    private val wall: WallClock
) {

    /**
     * Grava o total de um dia.
     *
     * **A regra que sustenta o historico:** dia passado nunca e sobrescrito por
     * leitura menor. Quando o sistema ja esqueceu aquele dia, a releitura
     * devolve zero — e gravar esse zero apagaria um dado verdadeiro que so nos
     * ainda tinhamos. O dia corrente e o oposto: sempre vale a leitura nova,
     * porque ele so cresce enquanto o dia corre.
     */
    fun record(day: LocalDate, total: Duration) {
        val atual = totals().toMutableMap()
        val gravado = atual[day]

        if (day.isBefore(wall.today()) && gravado != null && total < gravado) {
            return
        }

        atual[day] = total
        write(podar(atual))
    }

    fun totals(): Map<LocalDate, Duration> {
        val cru = store.getString(KEY_TOTALS) ?: return emptyMap()
        return cru.split(SEPARADOR_ENTRADAS)
            .filter { it.isNotBlank() }
            .mapNotNull { entrada ->
                val partes = entrada.split(SEPARADOR_CAMPOS)
                if (partes.size != 2) {
                    return@mapNotNull null
                }
                // Entrada corrompida e descartada em vez de derrubar a leitura:
                // diferente da politica de bloqueio, um dia ilegivel no grafico
                // nao muda o que o app faz — perder o historico inteiro, sim.
                runCatching {
                    LocalDate.parse(partes[0]) to Duration.ofMillis(partes[1].toLong())
                }.getOrNull()
            }
            .toMap()
    }

    private fun podar(totais: Map<LocalDate, Duration>): Map<LocalDate, Duration> {
        val corte = wall.today().minusDays(RETENCAO_DIAS)
        return totais.filterKeys { !it.isBefore(corte) }
    }

    private fun write(totais: Map<LocalDate, Duration>) {
        val serializado = totais.entries
            .sortedBy { it.key }
            .joinToString(SEPARADOR_ENTRADAS) { "${it.key}$SEPARADOR_CAMPOS${it.value.toMillis()}" }
        store.putString(KEY_TOTALS, serializado)
    }

    private companion object {
        /**
         * Formato proprio (`2026-08-30=1234;2026-08-29=5678`) em vez de JSON: o
         * `core` e JVM pura e nao tem `org.json` (que e do Android) nem
         * dependencia de serializacao — e um mapa de data pra numero nao paga
         * uma.
         */
        const val SEPARADOR_ENTRADAS = ";"
        const val SEPARADOR_CAMPOS = "="
        const val RETENCAO_DIAS = 90L
        const val KEY_TOTALS = "screentime.daily_totals"
    }
}
