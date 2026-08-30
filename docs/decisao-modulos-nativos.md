# Decisão — módulos nativos (iOS e Android)

> Rodada de decisão. Documento, não código. Avalia se as bibliotecas
> candidatas servem para o enforcement nativo do AceleraLock.
>
> **Data:** 2026-08-29 · **Autor:** dev
> **Insumos:** `docs/onboarding-permissoes-nativas.md` (inventário de permissões),
> `docs/qa/matriz-cenarios-burla.md` (critério de segurança J-S4).
>
> **Veredito:** iOS → **adaptar** (`react-native-device-activity`, com fork fixado).
> Android → **escrever do zero**. A resposta é diferente por plataforma.

---

## 1. Critério de eliminação, e uma correção de premissa

O requisito registrado era: *"na extensão de shield do iOS o identificador do app
volta a ser legível, e precisamos disso para remover discador, emergência,
Ajustes e launcher do bloqueio mesmo quando entraram por seleção de categoria
inteira. Biblioteca que não exponha a extensão de shield não serve."*

O objetivo é correto e inegociável. **O mecanismo descrito não é.** Dois fatos
apurados:

1. **A extensão de shield não desbloqueia nada.** `ShieldConfigurationDataSource`
   retorna um `ShieldConfiguration` — título, cor, botões, blur. É aparência.
   Não existe "retornar nil para deixar passar". Um app que chegou na loja de
   bloqueio continua bloqueado por mais que a extensão saiba quem ele é.

2. **`Application.bundleIdentifier` é `nil` por design** para tudo que vem do
   `FamilyActivityPicker` no app principal — é a mesma restrição de privacidade
   que fundou nosso modelo de alvo opaco. Dentro das extensões há relatos de o
   identificador ficar disponível, mas a evidência é ambígua, e o sinal mais
   forte é prático: **a própria biblioteca usa `application.localizedDisplayName`,
   não `bundleIdentifier`**, no `ShieldConfigurationExtension.swift`. Quem
   mantém o código escolheu o nome de exibição. Tratar o bundle id como
   disponível é apostar num comportamento não documentado.

**O mecanismo que de fato existe** é o parâmetro `except:` da política de
categoria do `ManagedSettingsStore`:

```swift
store.shield.applicationCategories = .specific(categoryTokens, except: whitelistTokens)
store.shield.applicationCategories = .all(except: whitelistTokens)
```

Isso remove apps específicos de um bloqueio de categoria inteira — exatamente o
resultado que o requisito quer. O custo é que `except:` consome
**`ApplicationToken`**, e token só nasce de uma seleção do usuário no
`FamilyActivityPicker`. Não dá para sintetizar o token do discador a partir de
`com.apple.mobilephone`.

**Consequência de produto, que precisa de decisão do usuário:** proteger o
discador no iOS exige um passo de onboarding em que o próprio usuário seleciona,
num segundo picker, os apps críticos que nunca podem ser bloqueados. Não é
possível fazer isso silenciosamente por lista fixa. É uma tela a mais no fluxo
de `docs/onboarding-permissoes-nativas.md` (§4I), e é `uxui`/`mobile`.

**Isso torna o critério de eliminação mais exigente, não menos:** a biblioteca
precisa expor a extensão de shield **e** o `except:` das políticas de categoria.

---

## 2. iOS — `react-native-device-activity` → **ADAPTAR**

### Evidência

| Item | Valor |
|---|---|
| Repositório | `kingstinct/react-native-device-activity` |
| Último push | **2026-03-09** (~6 meses) |
| Última atividade no repo | 2026-08-15 |
| Versão npm | 0.6.1 |
| Estrelas / forks | 175 / 33 |
| Issues abertas | 17 |
| Licença | MIT |
| Linguagem | Swift |
| Arquivado | não |

### Cobertura de API — passa no critério

Entrega os três targets nativos como *Expo targets*, verificáveis no Xcode após
o prebuild: `ActivityMonitorExtension`, `ShieldAction`, `ShieldConfiguration`.

- `ShieldConfigurationExtension.swift` sobrescreve os **quatro** métodos do
  `ShieldConfigurationDataSource` (app, app-em-categoria, domínio,
  domínio-em-categoria) e resolve o conteúdo por token via app group, o que
  permite ramificação por app e por categoria.
- `ShieldActionExtension.swift` existe — é por onde chega o `ApplicationToken`
  quando o usuário toca no shield.
- `Shared.swift` implementa `.all(except:)` e `.specific(_, except:)` para
  aplicações e domínios, com conjunto de whitelist. **É o mecanismo da §1.**
- `ScreenTimeActivityPicker.swift` cobre o `FamilyActivityPicker` (I2).

### Riscos apurados, com número de issue

- **#95 (aberta, 2026-05-17) — `FamilyActivityPicker` promove seleção
  individual para categoria inteira.** É a issue mais grave para nós: descreve
  o iOS transformando "bloqueei o Instagram" em "bloqueei a categoria Social".
  É *precisamente* o cenário em que o discador entra no bloqueio sem ninguém
  pedir. Não é bug da biblioteca — é comportamento do sistema — mas confirma
  que o caso da §1 é real e frequente, não hipotético.
- **#81 (2026-01-01)** — ação `openApp` do shield não funciona; TODO no código.
  Só nos afeta se a UI do shield tiver botão "abrir o AceleraLock".
- **#69 (2025-08-08)** e **#66 (2025-08-07)** — "Couldn't communicate with a
  helper application" ao revogar autorização e no `onSelectionChange`. Toca o
  fluxo de revogação de permissão (§6 do onboarding). Precisa de teste em
  device real cedo.
- Lacunas de relatório de uso (#64, #29, #43): irrelevantes para o **iOS**, que
  segue só bloqueando.

  > **Revisto em 2026-08-30.** Esta linha dizia "não medimos tempo de tela, só
  > bloqueamos", e valia para os dois lados. Não vale mais no Android: as telas
  > de Início e Perfil mostram tempo de tela real, lido por `queryEvents` do
  > `UsageStatsManager` e reconstruído em sessões no `core/`
  > (`ScreenTimeSessions`, `ScreenTimeBuckets`, `ScreenTimeHistory`).
  >
  > **O que não mudou:** a recusa ao wrapper de analytics do §3 continua de pé,
  > e pelo mesmo motivo — o que precisávamos era da leitura crua, não de uma
  > camada de métricas por cima dela. Medir é uma tela de leitura para quem
  > instalou; não vira telemetria, não sai do aparelho.
  >
  > **O que isso custou:** o histórico diário passou a ser acumulado por nós,
  > porque o Android retém pouca granularidade diária, e o relógio de parede
  > entrou no produto (restrito ao histórico — a espera continua monotônica).
  > Ver `WallClock.kt`.

### Recomendação

**Adaptar, com fork fixado em commit.** Não escrever do zero: reimplementar
três extensões de sistema, o empacotamento de app group, o plugin de config do
Expo e a ponte de tokens custaria semanas e chegaria pior. Mas também não
depender do `main`:

1. Fork no nosso controle, versão **fixada por commit** (não por range de
   semver). O produto inteiro depende dessa camada e 17 issues abertas com
   bugs de comunicação com helper não são ruído.
2. `except:` é o ponto de integração da regra de apps críticos. É onde a lista
   de proteção do usuário entra.
3. Validar em device físico, antes de qualquer outra coisa: (a) revogação de
   autorização (#69), (b) o comportamento de #95 com a nossa seleção.

**Custo estimado:** 3–5 dias para integrar, empacotar e validar em device;
mais 1–2 dias para o segundo picker de apps críticos. Escrever do zero seria
15–25 dias com resultado inferior.

**Bloqueio externo que não muda com a escolha:** o entitlement
`com.apple.developer.family-controls` para distribuição exige aprovação manual
da Apple, com prazo de dias a semanas (D1 do onboarding). **Deve ser
solicitado agora**, não quando o app estiver pronto — é o item de maior
lead time do projeto e independe de biblioteca.

---

## 3. Android — `@brighthustle/react-native-usage-stats-manager` → **NÃO USAR, ESCREVER**

### Evidência

| Item | Valor |
|---|---|
| Repositório | `Bright-Hustle/react-native-usage-stats-manager` |
| **Último push** | **2023-10-29** — 2 anos e 10 meses |
| Última publicação npm | 0.1.5, **2023-10-29** |
| Estrelas / forks | 14 / 4 |
| Issues abertas | 2 |
| Licença | MIT |
| Config plugin do Expo | **não tem** |

O repo aparece "atualizado" em 2026-04-15, mas isso é metadado (estrelas,
descrição). **O último commit é de outubro de 2023** — antes do Android 14 ser
o alvo obrigatório do Play, e antes de `FOREGROUND_SERVICE_SPECIAL_USE` (API
34+) passar a exigir declaração e justificativa.

### O problema maior não é o abandono: é o escopo

A descrição do próprio projeto é *"Track user interactions in your React Native
app... Optimize user experience based on data-driven insights"*. É um wrapper
de **analytics** sobre as APIs de consulta do `UsageStatsManager`. Nós não
queremos analytics: queremos enforcement contínuo.

Comparando com o inventário de `docs/onboarding-permissoes-nativas.md`:

| Precisamos | A lib entrega |
|---|---|
| A1 — ler o app em primeiro plano via `UsageStatsManager` | **parcial** — é o que ela faz |
| A1 — checar `AppOpsManager.checkOpNoThrow(OPSTR_GET_USAGE_STATS)` | não |
| A2 — overlay `SYSTEM_ALERT_WINDOW` + `canDrawOverlays` | **não** |
| Foreground service com poll contínuo + notificação persistente | **não** |
| `RECEIVE_BOOT_COMPLETED` / religar após reboot | **não** |
| A3 — exceção de bateria e detecção do estado | **não** |
| A4 — `POST_NOTIFICATIONS` (Android 13+) | não |
| Latência D-lat (0,5–2 s até o overlay subir) | não trata |

Ela cobre aproximadamente **um item de oito**, e justamente o mais fácil. As
partes difíceis — foreground service que sobrevive a OEM agressivo, overlay que
sobe a partir do background sob as restrições do Android 10+, e a corrida do
D-lat — não estão lá e não estariam mesmo se estivesse mantida.

### Não há alternativa mantida

Busca por biblioteca de detecção de app em primeiro plano para RN em 2026 não
retorna nada mantido: o `react-native-usage-stats-manager` sem escopo (outro
pacote) tem última publicação de ~8 anos, e o `UsageStatsModule` de
`mvincent7891` é um exemplo antigo. **Não existe hoje um pacote que faça o que
precisamos.**

### Recomendação

**Escrever do zero**, como módulo nativo Kotlin próprio com config plugin do
Expo. Composição mínima:

- Foreground service (`FOREGROUND_SERVICE_SPECIAL_USE`) com poll de
  `UsageStatsManager.queryEvents` — intervalo curto por causa do D-lat.
- `Activity` de overlay (`SYSTEM_ALERT_WINDOW`), que é o que de fato bloqueia.
- Checagens de estado: `AppOpsManager`, `Settings.canDrawOverlays`,
  `PowerManager.isIgnoringBatteryOptimizations`.
- `BroadcastReceiver` de `BOOT_COMPLETED`.
- Ponte para a lista de alvos vinda do sync (`packageName` real no Android —
  aqui o alvo opaco carrega o `client_ref` que o app resolve localmente).

**Custo estimado:** 8–12 dias até funcionar de forma confiável, sendo que a
maior parte é sobrevivência a OEM (Xiaomi, Samsung, Oppo, Vivo) e afinação do
D-lat, não a API em si. Partir da lib não reduziria esse número — o trabalho
que ela poupa é meio dia de `queryEvents`.

**Aviso de Play Console:** `FOREGROUND_SERVICE_SPECIAL_USE` exige justificativa
na submissão (D6 do onboarding). É risco de política, não técnico, e vale
resolver cedo.

---

## 4. Resumo

| Plataforma | Decisão | Base |
|---|---|---|
| **iOS** | **Adaptar** `react-native-device-activity`, fork fixado por commit | Push em 2026-03-09, MIT, entrega as 3 extensões e o `except:` das políticas de categoria. Reescrever custaria 15–25 dias por um resultado pior. |
| **Android** | **Escrever do zero** em Kotlin | Lib parada desde 2023-10-29, é wrapper de analytics, cobre 1 de 8 requisitos e nenhum dos difíceis. Sem alternativa mantida. |

**Dois itens de lead time externo que independem desta decisão e devem começar
agora:** entitlement Family Controls da Apple (dias a semanas) e justificativa
de `FOREGROUND_SERVICE_SPECIAL_USE` no Play Console.

**Uma decisão de produto em aberto (§1):** proteger apps críticos no iOS exige
que o usuário selecione esses apps num picker próprio durante o onboarding.
Não há lista fixa possível. Precisa de decisão do usuário e vira tela para
`uxui`/`mobile`.
