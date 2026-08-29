# AceleraLock — Matriz de cenários de burla (teste adversarial)

**Versão:** 1.0 — 2026-08-28
**Autor:** QA
**Status:** documento de referência pré-código. Rege a validação do produto. `dev` e `mobile` devem planejar contra esta matriz.

---

## Modelo de ameaça

O adversário é **o próprio dono do aparelho**:

- Acesso físico total e ilimitado ao device.
- É administrador do sistema operacional (não é um device supervisionado por MDM corporativo, não é um menor sob controle parental de terceiro).
- Está **motivado** e tem tempo. Vai pesquisar, vai tentar de novo, vai aceitar fricção.
- Pode ter um segundo aparelho, um PC, e um amigo disposto a ajudar.
- **Não** assumimos root/jailbreak como caso comum, mas ele está no radar como teto.

Restrições de arquitetura já fixadas pelo usuário (limitam o que dá para defender):

- Android: `UsageStatsManager` + overlay (`SYSTEM_ALERT_WINDOW`). **Sem** Device Admin. **Sem** AccessibilityService.
- iOS: Family Controls / Screen Time (`ManagedSettings` + `DeviceActivityMonitor`). Sem MDM supervisionado.
- Cooldown cronometrado **no servidor** + aprovação de parceiro de confiança.

Consequência direta: várias ações destrutivas do dono (desinstalar, forçar parada, limpar dados, revogar permissão) **não são impedíveis** nessas APIs. Só são **detectáveis a posteriori**. Isso não é falha de implementação — é o limite das APIs escolhidas.

---

## Convenção de classificação

| Classe | Significado |
|---|---|
| **Bloqueável** | Dá para impedir de forma confiável com decisão de design correta. Se vazar, é bug. |
| **Mitigável** | Não dá para impedir 100%, mas dá para encarecer, detectar, alertar o parceiro e degradar com dignidade. Resta risco residual. |
| **Impossível de impedir** | O dono do device sempre consegue, dadas as APIs escolhidas. O produto **não pode prometer** que isso não acontece. Só cabe detectar e reportar. |

Plataforma: `AND` = Android, `iOS` = iOS, `AMBOS`, `SRV` = lado servidor.

---

## Primitivas de defesa recorrentes (referência para `dev`/`mobile`)

Aparecem repetidas na coluna "esperado". Definidas uma vez aqui:

- **P1 — Tempo é do servidor.** O fim do cooldown é calculado e verificado no servidor (UTC monotônico do servidor). O cliente nunca decide "já passou" com base no relógio local. O cliente só exibe uma contagem *estimada*; a liberação real vem de resposta assinada do servidor.
- **P2 — Fail-closed.** Sem rede, sem resposta do servidor, resposta inválida ou expirada → **permanece bloqueado**. Offline nunca libera — exceto pelo failsafe de P8.
- **P3 — Estado no servidor, atrelado à conta.** O estado de bloqueio vive no servidor por `userId` + lista de apps. Reinstalar, limpar dados ou trocar de aparelho **restaura** o bloqueio no próximo login. Sem login → app inútil, mas isso não desbloqueia nada (o alvo continua bloqueado enquanto o AceleraLock estiver instalado; se for desinstalado, ver seção E).
- **P4 — Heartbeat + detecção de silêncio.** O cliente envia heartbeat periódico assinado. O servidor sabe quando o agente parou de reportar. Silêncio acima do limiar → evento "proteção interrompida" → **notifica o parceiro** e registra na linha do tempo do usuário.
- **P5 — Sem artefato de autorização portátil (contrato 2026-08-28).** Não há token de liberação. A autorização de desbloqueio é a **lista de liberações ativas** no payload de sync, escopada ao device e **recalculada pelo servidor a cada leitura** — nada para expirar, roubar ou reapresentar. A aprovação do parceiro é uma **chamada autenticada com o id do pedido na URL**: o backend exige o chamador autenticado e parceiro daquele pedido. Sem nonce, sem replay, sem forja. TLS pinning no cliente protege o canal.
- **P6 — Re-arme automático.** Boot, atualização do app, retorno de rede, retorno do processo → o agente re-sincroniza com o servidor e re-aplica o bloqueio antes de considerar-se ativo.
- **P7 — Válvula de escape do desbloqueio (decidida 2026-08-28).** Todo pedido de desbloqueio se resolve sozinho em **48 h** sem nenhuma aprovação — evento `UNLOCK_GRANTED_UNILATERALLY` na trilha (nome sem número embutido: o prazo é configurável). Com parceiro presente e aprovando, a espera é de **30 min** (`UNLOCK_APPROVED_BY_PARTNER`) — **desde que o vínculo tenha ≥ 48 h de idade** (ver F1). Sem parceiro (sumiu, bloqueou o contato, perdeu o celular), o pedido libera em 48 h. Ninguém fica preso. A fricção do fluxo normal continua de pé; os 48 h são o piso irrevogável, não o caminho esperado.
- **P8 — Failsafe offline do agente (decidida 2026-08-28).** Se o app passar **7 dias** sem conseguir contato com o servidor, libera sozinho. Evento próprio na trilha: `UNLOCK_GRANTED_OFFLINE_FAILSAFE`. O prazo (7 dias) é servido pelo servidor e cacheado, **não** cravado no binário. Impede que uma pane de servidor prenda a base inteira. Cria os vetores N4 e G7/G8.
  - **Modelo de tempo (crítico):** nem relógio de parede (burlável adiantando a hora — G7), nem `elapsedRealtime` puro (zera no reboot, e aí o failsafe nunca dispara para quem reinicia o celular uma vez por semana — G8). Tem de ser **tempo offline acumulado e persistido**: soma de deltas monotônicos gravada em armazenamento seguro; o reboot é um checkpoint, não um reset; o contador só zera quando um sync com o servidor completa de verdade.

---

## A. Manipulação de tempo (vencer o cooldown)

| # | Vetor | Reprodução | Esperado | Classe | Plat. |
|---|---|---|---|---|---|
| A1 | Adiantar relógio do sistema | Ajustes → Data e hora → desativar automático → pôr data no futuro | Cooldown não se move. Servidor é a fonte (P1). Cliente pode até detectar divergência relógio-local × servidor e sinalizar. | Bloqueável | AMBOS |
| A2 | Atrasar relógio do sistema | Igual A1, data no passado | Sem efeito no cooldown (P1). Lógica de cliente não pode usar `delta` de relógio local para nada crítico. | Bloqueável | AMBOS |
| A3 | Trocar fuso horário | Ajustes → fuso manual | Servidor trabalha em UTC. Sem efeito (P1). | Bloqueável | AMBOS |
| A4 | Cache de "liberado às HH:MM" comparado ao relógio local | Pedir unlock, ficar offline, adiantar relógio, abrir app | **Deve continuar bloqueado** (P2). Este é o bug clássico da categoria: cliente que confia em timestamp local cacheado. Teste obrigatório. | Bloqueável | AMBOS |
| A5 | NTP falso / manipular sincronização de horário | Redirecionar `time.android.com` via DNS local | Servidor não usa horário do cliente (P1). Sem efeito. | Bloqueável | AMBOS |
| A6 | Drift/bug de relógio no próprio servidor | — | Servidor com NTP confiável e relógio monotônico para medir duração; teste de sanidade de clock no backend. | Bloqueável | SRV |

---

## B. Ciclo de vida do processo e dos dados

| # | Vetor | Reprodução | Esperado | Classe | Plat. |
|---|---|---|---|---|---|
| B1 | Forçar parada do app | Ajustes → Apps → AceleraLock → Forçar parada | Serviço morre. Overlay some. App alvo fica acessível até o re-arme. Servidor detecta silêncio de heartbeat (P4) → **alerta o parceiro**. Re-arme no próximo boot/abertura (P6). Sem Accessibility/Device Admin **não há como impedir a parada**. | Impossível de impedir | AND |
| B2 | Limpar dados / limpar armazenamento | Ajustes → Apps → AceleraLock → Armazenamento → Limpar dados | Estado local zera. No próximo abrir, exige login; servidor restaura o bloqueio (P3). Janela de exposição entre limpar e reabrir. Parceiro é notificado (P4). | Mitigável | AND |
| B3 | Limpar cache | idem, só cache | Sem efeito sobre o bloqueio (dados sensíveis não moram só em cache). | Bloqueável | AND |
| B4 | Reiniciar o aparelho | Desligar/ligar | `BOOT_COMPLETED` re-sobe o agente e re-aplica o bloqueio antes de "ativo" (P6). Janela entre boot e agente subir: alvo acessível por alguns segundos. Em OEMs que atrasam/bloqueiam `BOOT_COMPLETED`, janela maior — ver seção C. | Mitigável | AMBOS |
| B5 | Modo avião durante toda a janela de bloqueio | Ligar modo avião, usar o alvo | Fail-closed (P2): sem servidor, permanece bloqueado. O motor de foreground é local, não precisa de rede para bloquear. Rede só é necessária para *liberar*. | Bloqueável | AMBOS |
| B6 | Desinstalar o AceleraLock | Segurar ícone → Desinstalar | **O alvo fica 100% livre.** Sem Device Admin, nada impede a desinstalação no Android. Servidor detecta silêncio (P4) → alerta parceiro. Reinstalar restaura o bloqueio (P3). | Impossível de impedir | AND |
| B7 | Desinstalar e reinstalar para zerar contagem | Desinstalar, reinstalar, logar | Cooldown e estado vêm do servidor por conta (P3). Reinstalar **não** zera nada. Se logar em conta nova, ver seção F (conluio). | Bloqueável | AMBOS |
| B8 | Reinstalar e **não** fazer login | idem, pular login | App alvo permanece bloqueado *enquanto o AceleraLock rodar*, mas sem login o usuário também não sofre o bloqueio — na prática equivale a B6 (desinstalado). | Impossível de impedir | AND |
| B9 | Desativar o app sem desinstalar (`disable`) | Ajustes → Apps → Desativar (alguns OEMs) / via ADB | Agente para. Equivale a B1 + persistente. Detecção por silêncio (P4). | Impossível de impedir | AND |
| B10 | Limpar dados de "Serviços do Google Play" / componentes de sistema | Ajustes → Apps → Google Play Services → Limpar dados | Pode derrubar FCM (push do parceiro/servidor) e WorkManager agendado. Agente precisa re-registrar push no próximo start e não depender só de push para re-armar (polling de fallback). | Mitigável | AND |
| B11 | Restaurar backup do device anterior ao bloqueio | iOS: restaurar backup iCloud; Android: idem | Estado do servidor prevalece no login (P3). Autorização de Family Controls pode não sobreviver ao restore → agente re-solicita; enquanto não concede, servidor sabe que está desprotegido (P4). | Mitigável | AMBOS |
| B12 | Reset de fábrica | Apagar tudo | Tudo some. Servidor detecta silêncio (P4). Nada a fazer no device. | Impossível de impedir | AMBOS |

---

## C. Otimização de bateria e "background killers" de OEM

| # | Vetor | Reprodução | Esperado | Classe | Plat. |
|---|---|---|---|---|---|
| C1 | Doze / App Standby mata o serviço | Deixar o device parado, tela apagada | Foreground Service com notificação persistente + `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` solicitado no onboarding. WorkManager periódico como watchdog. | Mitigável | AND |
| C2 | MIUI (Xiaomi): "Autostart" negado + "sem restrições" não marcado | App novo no MIUI já vem com autostart off | Onboarding **guiado por fabricante** levando o usuário às telas certas. Se autostart estiver off, o agente não sobe no boot → janela grande. Servidor detecta ausência de heartbeat pós-boot. | Mitigável | AND |
| C3 | Samsung: "Colocar app para dormir" / "Apps em suspensão profunda" | Ajustes → Bateria → o app cai na lista automática | Pedir exclusão da lista no onboarding; re-checar periodicamente e avisar o usuário (e o parceiro) se voltou para a lista. | Mitigável | AND |
| C4 | Huawei/Honor: "Gerenciar manualmente" + EMUI killer | idem | idem C2. Huawei sem Google Services agrava B10. | Mitigável | AND |
| C5 | Oppo/Vivo/Realme (ColorOS/FuntouchOS/OriginOS) | idem | idem C2. | Mitigável | AND |
| C6 | "Limpar tudo" nos Recentes / swipe no card | Abrir Recentes, limpar tudo | Foreground Service deve sobreviver ao swipe na maioria dos OEMs; alguns (Xiaomi) matam mesmo assim → `START_STICKY` + `AlarmManager` exato de re-subida + watchdog. | Mitigável | AND |
| C7 | Modo de economia de bateria extrema | Ligar economia extrema | Restringe background agressivamente. Foreground Service persiste na maioria dos casos; testar em cada OEM. | Mitigável | AND |
| C8 | Task killer de terceiro (Greenify, etc.) | Instalar e "hibernar" o AceleraLock | Equivale a B1 recorrente. Detecção por silêncio (P4). | Impossível de impedir | AND |
| C9 | Adaptive Battery restringe após "uso raro" | Nunca abrir a UI do AceleraLock por semanas | Não depender de o usuário abrir o app. Foreground Service + trabalho agendado mantêm relevância. | Mitigável | AND |
| C10 | iOS: extensão `DeviceActivityMonitor` com orçamento de execução curto | — | Não fazer trabalho pesado na extensão. Agendamento tem granularidade (~15 min) — o shield em si é aplicado pelo sistema, não pela extensão, então continua valendo mesmo com a extensão ociosa. | Mitigável | iOS |

**Nota transversal C:** os killers de OEM são o maior risco prático de confiabilidade do produto no Android. Nenhum é "burla" no sentido de derrotar a criptografia — todos produzem o mesmo efeito: **o agente para de rodar e o alvo fica acessível**. A defesa real é P4 (o parceiro descobre) + onboarding por fabricante. A promessa honesta é "se a proteção cair, seu parceiro fica sabendo na hora", não "a proteção nunca cai".

---

## D. Caminhos laterais até o app bloqueado

O motor de detecção no Android é "qual pacote está em foreground". Isso cobre **qualquer** caminho que resulte no app alvo em foreground — os itens abaixo não são furos individuais, são variações que precisam entrar no roteiro de teste para confirmar que o detector dispara em todos.

| # | Vetor | Reprodução | Esperado | Classe | Plat. |
|---|---|---|---|---|---|
| D1 | Abrir por notificação do alvo | Tocar numa notificação do Instagram | Instagram vai a foreground → overlay sobe. Vale a latência D-lat abaixo. | Mitigável | AMBOS |
| D2 | Abrir por widget na home | Widget do alvo → toque | idem D1. | Mitigável | AMBOS |
| D3 | Deep link / URL scheme (`instagram://`) | Link em outro app | idem D1. | Mitigável | AMBOS |
| D4 | Universal/App Link abrindo o app | `https://instagram.com/...` que resolve no app | idem D1. | Mitigável | AMBOS |
| D5 | **Versão web no navegador** | Abrir `instagram.com` no Chrome e ficar na web | O alvo é o *app*; o navegador é outro pacote. Só bloqueia se o usuário também bloquear navegadores, ou se houver bloqueio por conteúdo/domínio (não previsto na arquitetura atual). | Impossível de impedir | AMBOS |
| D6 | PWA / "adicionar à tela de início" do site | Instalar o PWA do alvo | Vira um pacote de navegador/WebAPK distinto. Mesma limitação de D5. | Impossível de impedir | AMBOS |
| D7 | App clonado (Dual Apps, Ilha Paralela, Island, Shelter, Samsung Dual Messenger) | Clonar o Instagram no espaço dual | O clone roda com **outro `userId`/pacote**. O agente do AceleraLock roda no espaço primário e **não enxerga** o outro perfil. | Impossível de impedir | AND |
| D8 | Perfil de trabalho / usuário secundário do Android | Criar usuário secundário, instalar o alvo lá | O AceleraLock está no usuário primário. Outro usuário do Android é isolado. | Impossível de impedir | AND |
| D9 | Assistente de voz | "Ok Google, abrir Instagram" | O alvo vai a foreground → detector dispara. Vale D-lat. | Mitigável | AMBOS |
| D10 | Recentes / app já aberto antes do bloqueio | Alvo aberto, ativar bloqueio, voltar pelo card de Recentes | Overlay deve subir ao trazer o alvo a foreground (P6 cobre o momento da ativação: forçar o alvo para background). Snapshot/thumbnail nos Recentes pode vazar um frame de conteúdo. | Mitigável | AND |
| D11 | Split screen / janela flutuante | Alvo em tela dividida com outro app | Overlay precisa cobrir a partição do alvo; testar. Android pode limitar overlay em multi-window. | Mitigável | AND |
| D12 | App "Lite" do alvo (Instagram Lite, etc.) | Instalar o Lite | Pacote diferente. Só bloqueia se o usuário adicionar o Lite à lista. UI deve sugerir variantes conhecidas ao bloquear um app. | Mitigável | AND |
| D13 | Conteúdo do alvo dentro de outro app | Ver Reels via embed no navegador, no Telegram, etc. | Fora do alcance. Não é o app alvo em foreground. | Impossível de impedir | AMBOS |
| D14 | Segundo dispositivo / desktop | Abrir o alvo no tablet, no PC, no celular antigo | O AceleraLock só protege o device onde está instalado. | Impossível de impedir | — |
| **D-lat** | **Janela de latência do `UsageStatsManager`** | Abrir o alvo e consumir conteúdo nos ~0,5–2 s antes de o overlay subir; fechar; repetir | O overlay sobe "logo depois". Sempre há um intervalo em que conteúdo do alvo fica visível. Polling mais rápido reduz, não elimina, e custa bateria. | Impossível de impedir | AND |

**Nota transversal D:** no Android, sem AccessibilityService, a detecção é **reativa e com atraso**. O produto entrega "assim que você abre, aparece uma tela te barrando e registrando a tentativa" — não "você fisicamente nunca vê um pixel do app". iOS com Family Controls é mais forte aqui: o shield é aplicado pelo sistema **antes** de a UI do app renderizar.

---

## E. Revogar permissões / desarmar a proteção

| # | Vetor | Reprodução | Esperado | Classe | Plat. |
|---|---|---|---|---|---|
| E1 | Revogar "Acesso ao uso" (Usage Access) com bloqueio ativo | Ajustes → Acesso especial → Acesso ao uso → AceleraLock → off | Detector para de funcionar. Agente detecta a perda da permissão (checa no boot e periodicamente) → reporta ao servidor → **alerta o parceiro** (P4). Overlay pode continuar pedindo a permissão de volta de forma insistente, mas **não impede** a revogação. | Impossível de impedir | AND |
| E2 | Revogar "Sobrepor a outros apps" (overlay) | Ajustes → Acesso especial → Sobreposição → off | Sem overlay, não há tela de bloqueio. Mesma detecção/alerta de E1. Sem Accessibility não dá para reabrir a tela de ajustes à força de forma confiável. | Impossível de impedir | AND |
| E3 | Revogar permissão via ADB (`pm revoke`, `appops set`) | PC com depuração USB | idem E1/E2. ADB é onipotente no lado do dono. | Impossível de impedir | AND |
| E4 | `adb shell pm clear` / `am force-stop` | PC | Equivale a B1/B2 via cabo. Detecção por silêncio. | Impossível de impedir | AND |
| E5 | Boot em Modo de Segurança do Android | Segurar "Desligar" → Modo de segurança | Apps de terceiros ficam desabilitados. AceleraLock não roda. Ao sair do modo, re-arme (P6). Janela = tempo no modo seguro. | Impossível de impedir | AND |
| E6 | iOS: desativar Tempo de Uso | Ajustes → Tempo de Uso → Desativar | Sem MDM supervisionado, o dono do device controla o Tempo de Uso. O agente detecta que `AuthorizationCenter` não está mais autorizado → alerta o parceiro (P4). | Impossível de impedir | iOS |
| E7 | iOS: revogar autorização de Family Controls do app | Ajustes → Tempo de Uso → apps/serviços autorizados | idem E6. | Impossível de impedir | iOS |
| E8 | iOS: apagar/"Offload" o app | Segurar ícone → Remover App / App Store offload automático | Remove o `ManagedSettings` shield. Reinstalar restaura via login (P3). Servidor detecta silêncio. | Impossível de impedir | iOS |
| E9 | Definir/alterar o código do Tempo de Uso para trancar o AceleraLock fora | O produto poderia pedir para *ser* o gestor do código do Tempo de Uso | Fora da arquitetura atual e frágil (o dono pode resetar via Apple ID). Não prometer. | Mitigável | iOS |
| E10 | Root / jailbreak: Frida, Xposed/LSPosed, hook no cliente | Device rootado + framework de hooking | Pode forjar respostas locais, desabilitar checagens, patchar o binário. Defesas: TLS pinning, detecção de root/hook (best-effort), lógica crítica só no servidor (P1/P2/P5). Nada disso é definitivo contra root determinado. | Impossível de impedir | AMBOS |
| E11 | Remover perfil de configuração / MDM (se algum dia usado) | Ajustes → Geral → VPN e Gerenciamento | Sem supervisão, perfil é removível pelo dono. | Impossível de impedir | iOS |

**Nota transversal E:** esta seção é o núcleo do que a arquitetura escolhida **não pode impedir**. `UsageStats` e `SYSTEM_ALERT_WINDOW` são permissões que o SO sempre deixa o dono revogar; Family Controls sem supervisão é autorização que o dono sempre pode retirar. O valor do produto aqui é inteiramente **detecção + transparência para o parceiro**, não prevenção.

---

## F. Conluio social / o "parceiro de confiança"

**Reenquadramento após P7 (2026-08-28):** com a válvula de 48 h, o conluio deixou de "destravar o que seria intravável" e passou a "encurtar 48 h → 30 min". O incentivo a burlar o lado social caiu bastante — quem quer o app e não tem pressa simplesmente espera dois dias. As linhas abaixo continuam válidas, mas a severidade de todas cai um nível: o pior caso do conluio bem-sucedido é ganhar 47 h e meia, não acesso irrestrito.

| # | Vetor | Reprodução | Esperado | Classe | Plat. |
|---|---|---|---|---|---|
| F1 | Ser o próprio parceiro com uma segunda conta | Criar 2ª conta (2º Apple ID / Google), indicá-la como parceiro, aprovar a si mesmo | Regras adotadas pelo `dev` (2026-08-28): (a) parceiro na **mesma instalação de aparelho** é recusado no aceite; (b) **vínculo tem idade mínima de 48 h antes de poder aprovar** — nas primeiras 48 h o pedido não encurta nem com aprovação; (c) vínculo recíproco é sinalizado na trilha. Nunca elimina — 2º aparelho + 2 dias de paciência resolvem — mas remove o "burla em dois toques". Severidade real: encurtar 48 h → 30 min, e só depois de 48 h de vínculo. | Mitigável | SRV |
| F2 | Identidade do parceiro fraca (conta descartável) | Criar 2º Apple ID / Google só para ser parceiro | Identidade é Apple/Google, **não há telefone no modelo**. Verificação de telefone / detecção de número virtual foi avaliada e **não adotada** — decisão de produto, não lacuna. Mitigação que resta: idade mínima de vínculo (F1b) e sinal de recíproco (F1c). | Mitigável (mitigação de identidade não adotada) | SRV |
| F3 | Amigo real que aprova sem critério / combinação prévia | Pedir a um colega que aceite ser parceiro e aprove tudo | Fora do controle técnico. O design pode: mostrar ao parceiro o histórico de pedidos e a frequência; exigir que o parceiro escreva um motivo; "cool-down" mínimo mesmo com aprovação (o parceiro acelera, não anula a espera). | Impossível de impedir | — |
| F4 | Engenharia social no parceiro ("emergência, só hoje") | Mensagem fora do app pressionando o parceiro | idem F3. Mitigar com UX: o app lembra o parceiro do propósito ("você concordou em ajudar a manter esse limite"). | Impossível de impedir | — |
| F5 | Usuário tem acesso ao device/conta do parceiro | Cônjuge, familiar, device compartilhado, senha conhecida | Notificação de aprovação deve exigir reautenticação (biometria/PIN) no device do parceiro, não só um toque no push. Não resolve device totalmente comprometido. | Mitigável | AMBOS |
| F6 | Pacto mútuo: A é parceiro de B e B é parceiro de A, aprovam-se sempre | Dois usuários reais combinam | Relação recíproca é **sinalizada na trilha**, não bloqueada nem penalizada com espera extra (decisão do `dev`) — pode ser um casal legítimo. O registro auditável é o suficiente. | Mitigável | SRV |
| F7 | Forjar a aprovação na API | Chamar a rota de aprovação sem ser o parceiro daquele pedido | **Bug se funcionar.** A rota nomeia o pedido na URL; o backend exige o chamador autenticado **e** parceiro daquele pedido específico. Sem isso → `403/404`. | Bloqueável | SRV |
| F8 | Reapresentar / repetir a chamada de aprovação | Repetir a mesma requisição de aprovação | Não há artefato assinado nem nonce a reusar — a autorização é recalculada. Chamada repetida é **idempotente**: mesmo estado terminal, sem segundo efeito. | Bloqueável | SRV |
| F9 | Interceptar o canal de aprovação | Se aprovação fosse por link mágico em SMS/e-mail e o usuário lê o SMS do parceiro | Aprovação **dentro do app** do parceiro, autenticada, nunca por link clicável que carrega a ação. | Bloqueável | SRV |
| F10 | Trocar de parceiro para um mais permissivo no meio do bloqueio | Durante o cooldown, remover parceiro atual e indicar um cúmplice | Troca de parceiro deve exigir a mesma fricção do desbloqueio (espera + aprovação do parceiro atual), senão vira porta dos fundos. | Bloqueável | SRV |

---

## G. Rede e canal cliente–servidor

| # | Vetor | Reprodução | Esperado | Classe | Plat. |
|---|---|---|---|---|---|
| G1 | Bloquear o domínio do backend (hosts, Pi-hole, DNS, firewall, VPN local) | Adicionar o domínio do AceleraLock a uma blocklist | Fail-closed (P2) por até 7 dias: sem servidor, **não libera** e o bloqueio local continua; o usuário nem consegue *pedir* unlock. Passados 7 dias corridos sem contato, P8 dispara e libera (`UNLOCK_GRANTED_OFFLINE_FAILSAFE`). Bloqueável na janela curta; ver N4 para a janela longa. | Bloqueável (≤7d) | AMBOS |
| G2 | Proxy / MITM para forjar "aprovado" | Charles/mitmproxy + CA instalada | TLS pinning no cliente; CA de usuário não quebra pinning. Mesmo com o canal comprometido, não há resposta de "liberado" a forjar que o cliente aceite como autorização — ele relê a lista do servidor no próximo sync (P5). | Bloqueável | AMBOS |
| G3 | Repetir uma resposta de sync antiga (replay) | Salvar e reenviar um payload de sync que continha uma liberação | O cliente sempre usa o sync mais recente; um payload velho é substituído no próximo ciclo. Fail-closed enquanto não há sync novo (P2). | Bloqueável | AMBOS |
| G4 | Servir do cache local um sync antigo com liberação | Congelar o app num payload de sync favorável | P2 + P5: o cache não concede autorização por si; passado o prazo daquela liberação, o próprio cliente a descarta (recalcula localmente contra o `expiresAt` do item) e, sem sync novo, cai em fail-closed. | Bloqueável | AMBOS |
| G5 | Desregistrar o push token para o parceiro não ser avisado | Limpar dados do FCM/APNs, revogar notificações | Servidor não confia só em push: detecção de silêncio de heartbeat (P4) roda no servidor independentemente do push. Parceiro vê o alerta ao abrir o app mesmo sem push. | Mitigável | AMBOS |
| G6 | Manipular relógio + offline + cache (combo A4+G4+B5) | Sequência combinada | Continua bloqueado. Teste-canário da arquitetura: nenhuma combinação de offline + relógio + cache pode liberar **antes** dos 7 dias de P8. Se liberar antes, o design de P1/P2/P8 está furado — atenção especial a relógio adiantado enganando o contador de "dias sem servidor" (o failsafe deve medir tempo por fonte monotônica do device, não por relógio de parede). | Bloqueável | AMBOS |
| G7 | Adiantar o relógio para disparar o failsafe de 7 dias mais cedo | Cortar a rede + adiantar o relógio do sistema em +7 dias | **Não** deve liberar. O contador de P8 soma deltas monotônicos, não lê o relógio de parede. Bug se +7 dias no relógio adiantar o failsafe. | Bloqueável | AMBOS |
| G8 | Reiniciar o aparelho para zerar o contador do failsafe (ou explorar `elapsedRealtime` puro que zera no boot) | Cortar a rede; a cada 1–2 dias reiniciar o celular; observar se o failsafe nunca chega | Reboot é **checkpoint**, não reset: o tempo offline acumulado persiste em armazenamento seguro e continua somando após o boot. Aos 7 dias reais acumulados, o failsafe dispara mesmo com N reboots no meio. Bug (implementação ingênua) se o reboot zerar o progresso. | Bloqueável | AMBOS |

---

## H. Específico Android — `UsageStats` + overlay

| # | Vetor | Reprodução | Esperado | Classe | Plat. |
|---|---|---|---|---|---|
| H1 | Consumir conteúdo na janela de latência | Ver seção D-lat | Intervalo de conteúdo visível sempre existe. | Impossível de impedir | AND |
| H2 | Overlay não cobre barra de status / navegação | Interagir pela área não coberta; puxar a cortina de notificações por cima | Overlay com dimensões de tela cheia e flags corretas; ainda assim a cortina de notificações **sempre** abre sobre qualquer overlay (comportamento do sistema). | Mitigável | AND |
| H3 | Botão Home / Recentes por baixo do overlay | Tocar Home enquanto o overlay está no ar | Aceitável — leva o usuário para fora do alvo, que é o objetivo. Recentes pode mostrar thumbnail do alvo. | Mitigável | AND |
| H4 | Notificação de tela cheia (full-screen intent) sobre o overlay | Receber uma chamada / alarme enquanto o overlay está ativo | Full-screen intents passam por cima. Ao retornar, overlay deve re-subir. Testar. | Mitigável | AND |
| H5 | Matar o processo no instante em que o overlay ia subir | Force-stop com timing / device lento | Vira B1. Detecção por silêncio. | Impossível de impedir | AND |
| H6 | Girar tela / mudar configuração para derrubar o overlay | Rotacionar durante o bloqueio | Overlay deve se recriar em mudança de config. Bug se sumir. | Bloqueável | AND |
| H7 | Restrições de overlay do Android 12+ (`SYSTEM_ALERT_WINDOW` suprimido em certas interações, "hide overlays" durante permission dialogs) | Disparar um diálogo de permissão do sistema | Diálogos do sistema escondem overlays por design. Janela curta; overlay re-sobe depois. | Mitigável | AND |
| H8 | Abrir o alvo repetidas vezes muito rápido | Abrir/fechar em rajada | Cada abertura registra tentativa; overlay sobe a cada vez. Rate de registro no servidor não pode perder eventos. | Mitigável | AND |
| H9 | Launcher alternativo ou "abrir com" para contornar detecção | Trocar launcher | Detecção é por pacote em foreground, independente do launcher. Sem efeito. | Bloqueável | AND |

---

## I. Específico iOS — Family Controls / Screen Time

| # | Vetor | Reprodução | Esperado | Classe | Plat. |
|---|---|---|---|---|---|
| I1 | Desautorizar Family Controls / desligar Tempo de Uso | Ver E6/E7 | Detecção + alerta ao parceiro. Não impedível sem supervisão. | Impossível de impedir | iOS |
| I2 | Apagar / offload do app | Ver E8 | Restaura no login. Silêncio detectado. | Impossível de impedir | iOS |
| I3 | Alterar data/hora | Ajustes → Geral → Data e Hora | Tempo é do servidor (P1). Tempo de Uso do iOS até restringe alteração de horário, mas irrelevante para o cooldown do AceleraLock. | Bloqueável | iOS |
| I4 | Restaurar backup anterior ao bloqueio | Ver B11 | Autorização pode não sobreviver; servidor sabe. | Mitigável | iOS |
| I5 | Granularidade do `DeviceActivitySchedule` (~15 min) | Agendar bloqueio para um horário exato | O *shield* de app (`ManagedSettings.shield.applications`) é contínuo e não depende do schedule; usar shield persistente, não janelas agendadas, para o bloqueio principal. | Mitigável | iOS |
| I6 | Bypass de shield conhecido entre versões de iOS | Sequência específica (varia por versão) | Monitorar; corrigir por atualização. Risco inerente a depender de API do sistema. | Mitigável | iOS |
| I7 | Segundo device no mesmo Apple ID sem o app | Ver D14 | Fora de alcance. | Impossível de impedir | iOS |
| I8 | Web no Safari | Ver D5 | `ManagedSettings` tem filtro de conteúdo web, mas não previsto na arquitetura atual e contornável. | Impossível de impedir | iOS |

---

## J. Perda real de acesso (não é ataque — é defeito se não tratado)

**Status 2026-08-28: resolvido por decisão de produto.** P7 (todo pedido libera em 48 h; 30 min com parceiro aprovando) fecha J1–J3. P8 (7 dias sem servidor → libera com `UNLOCK_GRANTED_OFFLINE_FAILSAFE`) fecha J4. As linhas abaixo agora são **casos de teste da suíte**, não questões abertas.

| # | Cenário | Reprodução | Esperado | Classe | Plat. |
|---|---|---|---|---|---|
| J1 | Parceiro perde o celular / troca de número | Pedir desbloqueio; parceiro nunca responde | Pedido libera sozinho em **48 h** (P7), evento `UNLOCK_GRANTED_UNILATERALLY`. | Bloqueável (via design) | SRV |
| J2 | Parceiro bloqueia o contato / briga | Pedir desbloqueio; parceiro se recusa a aprovar | idem J1 (48 h). Trocar de parceiro é possível, com a mesma fricção (F10). | Bloqueável (via design) | SRV |
| J3 | Parceiro morre ou some | Pedir desbloqueio; parceiro inexistente | idem J1 (48 h). | Bloqueável (via design) | SRV |
| J4 | Servidor do AceleraLock fora do ar | Backend indisponível / device sem rota ao servidor por 7+ dias | Bloqueio local segura até 7 dias de tempo offline **acumulado**; então P8 libera e grava `UNLOCK_GRANTED_OFFLINE_FAILSAFE`. Prazo servido pelo servidor, não cravado no app. Contador = soma de deltas monotônicos persistida (ver G7 e G8). | Bloqueável (via design) | AMBOS |
| N4 | Isolar o aparelho da rede por 7 dias para forçar o failsafe de P8 | Modo avião / device sem SIM e sem Wi-Fi por 7 dias de uso acumulado, sem tocar no relógio | **Libera após 7 dias** — é o comportamento projetado de P8, não um bug. Caminho de fuga real, mas custo altíssimo (7 dias sem internet no aparelho todo) e registrado na trilha como `UNLOCK_GRANTED_OFFLINE_FAILSAFE`, visível ao parceiro. Aceito como trade-off consciente. | Mitigável (trade-off aceito) | AMBOS |
| J5 | Deleção de conta (LGPD) | Usuário pede exclusão da conta | Deletar a conta **notifica o parceiro antes** de o dado ir embora (`ACCOUNT_DELETION_SCHEDULED`) e depois libera os bloqueios do device — não deixa device órfão travado. **Não é vetor de burla novo:** desinstalar já destravava com o mesmo esforço. O requisito é que não seja silencioso. | Bloqueável (via design) | SRV |
| J6 | Bloqueio acidental de app crítico (discador, mensagens, banco, autenticador) | Usuário adiciona o discador à lista | **Validação de device, não de servidor** — o backend nunca sabe qual app um identificador representa (o id vira opaco antes de sair do aparelho). O **seletor nativo** barra: discador, SMS/mensagens, emergência, Ajustes, o próprio AceleraLock, serviços de acessibilidade; e avisa forte antes de apps sensíveis (banco, 2FA, e-mail). Entregue ao `mobile` como requisito de segurança. | Bloqueável | AND / iOS (device) |
| J7 | Emergência legítima com app bloqueado numa viagem sem rede | Usuário precisa do WhatsApp para emergência, sem internet, cooldown ativo | Fail-closed + sem rede = sem liberação. Trade-off honesto do produto; mitigar com "quota de emergência" limitada (ex.: 1 liberação curta por mês, offline, com registro e alerta posterior ao parceiro). | Mitigável | AMBOS |
| J8 | Viagem entre fusos deixa o fim do cooldown num horário ruim | Cooldown de 12 h cruzando fuso | Servidor mede duração absoluta (P1), não "até tal hora local". Sem surpresa. | Bloqueável | SRV |
| J9 | Duplo clique / clique rápido em "pedir liberação" | Tocar várias vezes | Idempotência por `requestId`; um pedido ativo por vez. Não criar timers múltiplos. | Bloqueável | AMBOS |
| J10 | Texto muito longo / emoji / acento no nome do app ou no motivo enviado ao parceiro | Colar 5000 caracteres com emoji | Validação de tamanho e sanitização; UI não quebra; parceiro recebe truncado com segurança. | Bloqueável | AMBOS |
| J11 | Console/log limpo | Rodar os fluxos e observar console/logcat | Nenhum erro novo não tratado. Erro novo = defeito. | Bloqueável | AMBOS |

---

## Seção final — O que a promessa "não consegue acessar por nada" NÃO sustenta

Lista curta e direta do que é **fisicamente impossível impedir** com a arquitetura escolhida (UsageStats + overlay, sem Device Admin, sem Accessibility / Family Controls sem supervisão). Para todos estes, o produto só consegue **detectar e avisar o parceiro** — nunca prevenir:

1. **Desinstalar o AceleraLock** (Android) ou **apagar o app** (iOS). Um toque e a proteção acaba. (B6, E8)
2. **Forçar a parada / limpar os dados** do app pelas Ajustes ou por ADB. (B1, B2, E4)
3. **Revogar a permissão** de Acesso ao Uso ou de Sobreposição (Android), ou **desligar o Tempo de Uso / desautorizar Family Controls** (iOS). (E1, E2, E6, E7)
4. **Reiniciar em Modo de Segurança** (Android) — apps de terceiros não rodam. (E5)
5. **Reset de fábrica.** (B12)
6. **Ver o conteúdo do app alvo na versão web** pelo navegador, ou por um **app clonado / segundo perfil de usuário** do Android. (D5, D7, D8)
7. **Usar outro aparelho** — tablet, PC, celular antigo — onde o AceleraLock não está. (D14)
8. **A janela de latência do Android:** sempre há de meio a dois segundos em que o conteúdo do app alvo fica visível antes de a tela de bloqueio subir. No Android, "não vê nada" é falso; o correto é "é barrado e registrado logo ao abrir". (D-lat, H1)
9. **Conluio social:** com um segundo Apple ID / Google e um segundo aparelho o usuário é o próprio parceiro; com um amigo complacente, as aprovações saem sempre. A idade mínima de vínculo de 48 h e o sinal de recíproco encarecem, não eliminam. *Severidade reduzida por P7: o conluio bem-sucedido encurta 48 h → 30 min (e só após 48 h de vínculo), não abre acesso irrestrito.* (F1, F2, F3)
10. **Device com root/jailbreak:** com hooking (Frida/Xposed) o cliente pode ser modificado à vontade. As defesas de servidor (tempo, assinatura, replay) seguram a parte crítica, mas o bloqueio *local* é contornável. (E10)

**Duas válvulas de escape são projetadas de propósito** (não são furos — são o desenho, catalogadas para não virarem surpresa):

- **48 h sem aprovação nenhuma** (P7): qualquer pedido de desbloqueio se resolve sozinho em dois dias. Quem tem paciência não precisa nem de parceiro nem de burla.
- **7 dias isolado da rede** (P8 / N4): manter o aparelho sem contato com o servidor por 7 dias de tempo offline acumulado libera o bloqueio. Reboot não zera o contador; adiantar o relógio não antecipa. Custo alto, registrado na trilha, visível ao parceiro.

**O que a arquitetura DE FATO sustenta** (para calibrar a promessa de marketing honesta):

- A espera cronometrada **não pode ser acelerada** mexendo no relógio, ficando offline, reinstalando o app ou por replay de rede — o tempo é do servidor e a liberação é assinada. O único encurtamento possível do fluxo offline é o failsafe de 7 dias, medido por tempo offline acumulado e persistido (imune a relógio de parede e a reboot). (Seção A, G)
- Toda interrupção da proteção — app parado, permissão revogada, heartbeat em silêncio, failsafe offline disparado — **gera um alerta para o parceiro** e fica registrada. O usuário não burla *silenciosamente*.
- No fluxo normal (sem desinstalar, sem revogar permissão, sem device secundário), abrir o app bloqueado **sempre** resulta na tela de bloqueio e no registro da tentativa.
- iOS é materialmente mais forte que Android: o shield do sistema barra o app **antes** de ele renderizar.
- Ninguém fica **preso para sempre**: todo pedido libera em 48 h, mesmo sem parceiro nenhum. (J1–J3, P7)

**Frase honesta sugerida:** não "você não consegue acessar por nada", e sim **"você não consegue acessar por impulso, e não consegue sem seu parceiro saber"**.
