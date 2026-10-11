import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { Button } from '@/components/Button';
import { IconeApp } from '@/components/IconeApp';
import { InlineAlert } from '@/components/InlineAlert';
import { Sheet } from '@/components/Sheet';
import type { InstalledApp } from '@/native/blocker';
import { radius, spacing, typography } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

import {
  DIAS_DA_SEMANA,
  MAX_FAIXAS,
  ajustarMinuto,
  atravessaMeiaNoite,
  avisoDoHorario,
  descreverFaixa,
  faixaInicial,
  formatarHora,
  mesmasFaixas,
  validarFaixa,
  type Faixa,
} from './horarioLivre';

type Props = {
  /** Montado com `key` do pacote: abrir outro app recomeca do que esta gravado. */
  app: InstalledApp;
  faixasSalvas: Faixa[];
  restricted: boolean;
  automaticTime: boolean;
  automaticZone: boolean;
  onClose: () => void;
  /** Grava no nativo. Lanca se a gravacao falhar — a folha fica aberta e avisa. */
  onSalvar: (faixas: Faixa[]) => void;
};

/** Faixa no formulario: `indice` null e faixa nova. */
type Rascunho = { indice: number | null; faixa: Faixa };

/**
 * Horarios livres de um app bloqueado. A gravacao e no "Salvar", como a lista: o
 * formulario so mexe no rascunho local.
 *
 * Com o modo restrito ligado a folha fica so de leitura — nenhuma faixa vale nesse
 * modo (decisao do usuario), e mexer nelas daria a impressao contraria.
 */
export function EditorDeHorarios({
  app,
  faixasSalvas,
  restricted,
  automaticTime,
  automaticZone,
  onClose,
  onSalvar,
}: Props) {
  const theme = useTheme();
  const { height } = useWindowDimensions();
  const [faixas, setFaixas] = useState<Faixa[]>(faixasSalvas);
  const [rascunho, setRascunho] = useState<Rascunho | null>(null);
  const [falhou, setFalhou] = useState(false);

  const aviso = avisoDoHorario({ restricted, automaticTime, automaticZone });
  const editavel = !restricted;
  const erroDoRascunho = rascunho ? validarFaixa(rascunho.faixa) : null;
  const alterado = !mesmasFaixas(faixas, faixasSalvas);

  const confirmarRascunho = () => {
    if (!rascunho || erroDoRascunho) {
      return;
    }
    setFaixas((atuais) =>
      rascunho.indice === null
        ? [...atuais, rascunho.faixa]
        : atuais.map((faixa, i) => (i === rascunho.indice ? rascunho.faixa : faixa))
    );
    setRascunho(null);
  };

  const salvar = () => {
    try {
      onSalvar(faixas);
    } catch (error) {
      console.warn('[EditorDeHorarios] falha ao gravar horarios livres', error);
      setFalhou(true);
    }
  };

  return (
    <Sheet visible onClose={onClose} accessibilityLabel={`Horários livres do ${app.label}`}>
      <ScrollView
        style={{ maxHeight: height * 0.72 }}
        contentContainerStyle={styles.conteudo}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.cabecalho}>
          <IconeApp iconUri={app.iconUri} tamanho={40} />
          <View style={styles.textos}>
            <Text
              accessibilityRole="header"
              style={[styles.titulo, { color: theme.colors.textPrimary }]}
            >
              Horários livres
            </Text>
            <Text style={[styles.subtitulo, { color: theme.colors.textSecondary }]}>
              {app.label}
            </Text>
          </View>
        </View>

        <Text style={[styles.corpo, { color: theme.colors.textSecondary }]}>
          Nesses horários o {app.label} abre sem bloqueio. Fora deles, continua bloqueado.
        </Text>

        {aviso && (
          <InlineAlert
            title={aviso.titulo}
            message={aviso.mensagem}
            icon={restricted ? 'lock-closed-outline' : 'time-outline'}
            actionLabel={aviso.podeAbrirConfiguracoes ? 'Abrir data e hora' : undefined}
            onAction={
              aviso.podeAbrirConfiguracoes
                ? () =>
                    Linking.sendIntent('android.settings.DATE_SETTINGS').catch(() =>
                      Linking.openSettings()
                    )
                : undefined
            }
          />
        )}

        {faixas.length === 0 && !rascunho && (
          <Text style={[styles.vazio, { color: theme.colors.textTertiary }]}>
            Nenhum horário livre: o {app.label} fica bloqueado o tempo todo.
          </Text>
        )}

        {faixas.length > 0 && (
          <View
            style={[
              styles.lista,
              { backgroundColor: theme.colors.bgSurface, borderColor: theme.colors.borderDefault },
            ]}
          >
            {faixas.map((faixa, indice) => (
              <View
                key={`${indice}-${faixa.start}-${faixa.end}`}
                style={[
                  styles.linha,
                  indice > 0 && {
                    borderTopWidth: 1,
                    borderTopColor: theme.colors.borderDefault,
                  },
                ]}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Editar ${descreverFaixa(faixa)}`}
                  disabled={!editavel}
                  onPress={() => setRascunho({ indice, faixa })}
                  style={styles.descricaoFaixa}
                >
                  <Ionicons name="time-outline" size={20} color={theme.colors.textBrand} />
                  <Text style={[styles.textoFaixa, { color: theme.colors.textPrimary }]}>
                    {descreverFaixa(faixa)}
                  </Text>
                </Pressable>
                {editavel && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Remover ${descreverFaixa(faixa)}`}
                    hitSlop={4}
                    onPress={() => setFaixas((atuais) => atuais.filter((_, i) => i !== indice))}
                    style={styles.remover}
                  >
                    <Ionicons name="close" size={20} color={theme.colors.textSecondary} />
                  </Pressable>
                )}
              </View>
            ))}
          </View>
        )}

        {rascunho && (
          <Formulario
            rascunho={rascunho}
            erro={erroDoRascunho}
            onChange={(faixa) => setRascunho({ ...rascunho, faixa })}
            onCancelar={() => setRascunho(null)}
            onConfirmar={confirmarRascunho}
          />
        )}

        {editavel && !rascunho && faixas.length < MAX_FAIXAS && (
          <Button
            label="Adicionar horário livre"
            variant="secondary"
            size="md"
            onPress={() => setRascunho({ indice: null, faixa: faixaInicial() })}
          />
        )}

        {falhou && (
          <Text
            accessibilityLiveRegion="polite"
            style={[styles.erro, { color: theme.colors.textDanger }]}
          >
            Não deu para salvar. Tente de novo.
          </Text>
        )}
      </ScrollView>

      <View style={styles.acoes}>
        {editavel ? (
          <>
            <Button label="Salvar" disabled={!alterado || rascunho !== null} onPress={salvar} />
            <Button label="Cancelar" variant="secondary" onPress={onClose} />
          </>
        ) : (
          <Button label="Fechar" variant="secondary" onPress={onClose} />
        )}
      </View>
    </Sheet>
  );
}

function Formulario({
  rascunho,
  erro,
  onChange,
  onCancelar,
  onConfirmar,
}: {
  rascunho: Rascunho;
  erro: string | null;
  onChange: (faixa: Faixa) => void;
  onCancelar: () => void;
  onConfirmar: () => void;
}) {
  const theme = useTheme();
  const { faixa } = rascunho;

  const alternarDia = (dia: number) =>
    onChange({
      ...faixa,
      days: faixa.days.includes(dia) ? faixa.days.filter((d) => d !== dia) : [...faixa.days, dia],
    });

  return (
    <View
      style={[
        styles.formulario,
        { backgroundColor: theme.colors.bgCanvas, borderColor: theme.colors.borderDefault },
      ]}
    >
      <Text style={[styles.rotulo, { color: theme.colors.textPrimary }]}>Dias</Text>
      <View style={styles.dias}>
        {DIAS_DA_SEMANA.map((dia) => {
          const ativo = faixa.days.includes(dia.valor);
          return (
            <Pressable
              key={dia.valor}
              accessibilityRole="checkbox"
              accessibilityLabel={dia.nome}
              accessibilityState={{ checked: ativo }}
              onPress={() => alternarDia(dia.valor)}
              style={[
                styles.dia,
                ativo
                  ? {
                      backgroundColor: theme.colors.surfaces.brand.fill,
                      borderColor: theme.colors.surfaces.brand.fill,
                    }
                  : {
                      backgroundColor: theme.colors.bgSurface,
                      borderColor: theme.colors.borderStrong,
                    },
              ]}
            >
              <Text
                style={[
                  styles.textoDia,
                  { color: ativo ? theme.colors.surfaces.brand.onFill : theme.colors.textPrimary },
                ]}
              >
                {dia.inicial}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.horarios}>
        <SeletorDeHora
          rotulo="Das"
          minuto={faixa.start}
          onChange={(start) => onChange({ ...faixa, start })}
        />
        <SeletorDeHora
          rotulo="Até"
          minuto={faixa.end}
          onChange={(end) => onChange({ ...faixa, end })}
        />
      </View>

      {atravessaMeiaNoite(faixa) && !erro && (
        <Text style={[styles.nota, { color: theme.colors.textSecondary }]}>
          Termina às {formatarHora(faixa.end)} do dia seguinte.
        </Text>
      )}
      {erro && (
        <Text
          accessibilityLiveRegion="polite"
          style={[styles.nota, { color: theme.colors.textDanger }]}
        >
          {erro}
        </Text>
      )}

      <View style={styles.botoesFormulario}>
        <View style={styles.botao}>
          <Button label="Cancelar" variant="secondary" size="md" onPress={onCancelar} />
        </View>
        <View style={styles.botao}>
          <Button
            label={rascunho.indice === null ? 'Adicionar' : 'Atualizar'}
            size="md"
            disabled={erro !== null}
            onPress={onConfirmar}
          />
        </View>
      </View>
    </View>
  );
}

/** Hora em passos de 15 minutos; ajustavel tambem pelo leitor de tela. */
function SeletorDeHora({
  rotulo,
  minuto,
  onChange,
}: {
  rotulo: string;
  minuto: number;
  onChange: (minuto: number) => void;
}) {
  const theme = useTheme();
  const botao = (passos: number, icone: 'remove' | 'add', descricao: string) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${descricao} 15 minutos em ${rotulo.toLowerCase()}`}
      hitSlop={4}
      onPress={() => onChange(ajustarMinuto(minuto, passos))}
      style={({ pressed }) => [
        styles.passo,
        {
          backgroundColor: pressed ? theme.colors.bgSunken : theme.colors.bgSurface,
          borderColor: theme.colors.borderStrong,
        },
      ]}
    >
      <Ionicons name={icone} size={18} color={theme.colors.textPrimary} />
    </Pressable>
  );

  return (
    <View
      style={styles.seletor}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={rotulo}
      accessibilityValue={{ text: formatarHora(minuto) }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(evento) =>
        onChange(ajustarMinuto(minuto, evento.nativeEvent.actionName === 'increment' ? 1 : -1))
      }
    >
      <Text style={[styles.rotulo, { color: theme.colors.textSecondary }]}>{rotulo}</Text>
      <View style={styles.linhaSeletor}>
        {botao(-1, 'remove', 'Menos')}
        <Text style={[styles.hora, { color: theme.colors.textPrimary }]}>
          {formatarHora(minuto)}
        </Text>
        {botao(1, 'add', 'Mais')}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  conteudo: {
    gap: spacing[4],
    paddingHorizontal: spacing[1],
    paddingBottom: spacing[1],
  },
  cabecalho: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  textos: {
    flex: 1,
    gap: 2,
  },
  titulo: {
    fontSize: typography.title2.fontSize,
    lineHeight: typography.title2.lineHeight,
    fontWeight: '700',
  },
  subtitulo: {
    fontSize: typography.footnote.fontSize,
    lineHeight: typography.footnote.lineHeight,
  },
  corpo: {
    fontSize: typography.callout.fontSize,
    lineHeight: 22,
  },
  vazio: {
    fontSize: typography.footnote.fontSize,
    lineHeight: typography.footnote.lineHeight,
  },
  lista: {
    borderWidth: 1,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    paddingLeft: spacing[4],
    paddingRight: spacing[2],
  },
  descricaoFaixa: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[3],
  },
  textoFaixa: {
    flex: 1,
    fontSize: typography.callout.fontSize,
    lineHeight: typography.callout.lineHeight,
  },
  remover: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formulario: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing[4],
    gap: spacing[3],
  },
  rotulo: {
    fontSize: typography.footnote.fontSize,
    lineHeight: typography.footnote.lineHeight,
    fontWeight: '600',
  },
  dias: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing[1],
  },
  dia: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textoDia: {
    fontSize: typography.callout.fontSize,
    lineHeight: typography.callout.lineHeight,
    fontWeight: '700',
  },
  horarios: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  seletor: {
    flex: 1,
    gap: spacing[1],
  },
  linhaSeletor: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  passo: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hora: {
    fontSize: typography.title3.fontSize,
    lineHeight: typography.title3.lineHeight,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  nota: {
    fontSize: typography.footnote.fontSize,
    lineHeight: typography.footnote.lineHeight,
  },
  botoesFormulario: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  botao: {
    flex: 1,
  },
  erro: {
    fontSize: typography.footnote.fontSize,
    lineHeight: typography.footnote.lineHeight,
  },
  acoes: {
    gap: spacing[2] + 2,
  },
});
