# Decisões

Ordem cronológica. Cada entrada diz **o que** foi decidido e **por quê** — decisão
sem motivo é a que alguém desfaz em seis meses achando que está limpando.

Onde o motivo não foi declarado, a entrada diz isso em vez de inventar um.

---

## Produto, antes do código

### Android e iOS em paralelo desde o dia 1

Decisão do usuário, **motivo não declarado**. Foi contra a recomendação de fazer
Android primeiro.

Consequência que já se manifestou: as duas plataformas exigiram decisões opostas
de implementação — no iOS adaptar biblioteca, no Android escrever do zero (ver
`decisao-modulos-nativos.md`).

### O alvo de bloqueio é opaco para o servidor

No iOS o Family Controls devolve `ApplicationToken`, e o `bundleIdentifier` é
`nil` por design para tudo que vem do `FamilyActivityPicker`. O identificador do
app **não sai do aparelho** — não por escolha de modelagem, mas porque a
plataforma não deixa.

Foi a restrição que explicou o domínio inteiro enquanto havia servidor. Depois do
pivô o servidor sumiu, mas a restrição continua governando o lado iOS.

### Bloqueio forte, sem travar a desinstalação

Sem Device Admin no Android. Device Admin foi **vetado pelo usuário**.

Motivo duplo. Política do Google Play: app que impede a própria remoção cai em
*Deceptive Behavior*. E produto: um app que não se deixa desinstalar vira malware
e perde a confiança de quem instalou.

A detecção de **app** em primeiro plano continua sem AccessibilityService, e o custo
é medido e aceito: reativa, entre 0,5 e 2 segundos. A escolha é fricção, não prisão.

**(mudou, 2026-09-13)** AccessibilityService entrou, para uma coisa só: ler a barra de
endereço de navegadores listados, no bloqueio de sites. Não detecta app, não desenha
overlay, não impede desinstalação e é opcional — fora do onboarding e de
`coreGranted`. Ver "Bloqueio de sites".

### Onboarding inescapável

As permissões essenciais não têm "pular": sem elas o app não bloqueia nada, então
concluir o onboarding pela metade produziria um app instalado que não faz nada.

É desvio deliberado da diretriz de *User Freedom*. Não é dark pattern **porque**
a saída existe e é declarada: link visível, e o caminho para desinstalar continua
livre. Prender quem mudou de ideia seria hostil.

---

## Backend (2026-08-28) — hoje arquivado em `backend.bkp/`

Estas decisões não regem mais o produto. Ficam registradas porque o código existe,
foi testado, e pode voltar.

### Sem `@Scheduled` em lugar nenhum

Nenhum estado mudava por relógio de fundo; `UnlockRequestService.evaluate(...)`
era o único ponto que decidia estado, chamado por todo caminho de leitura e
escrita. Avaliação preguiçosa tornava concessão offline **impossível por
construção**, não por regra escrita.

### Dois prazos em vez de um estado `EXPIRED`

Estado que só muda quando alguém roda um job é estado que mente entre uma rodada
e outra. Prazo comparado no momento da leitura não mente.

### Redução de cooldown só valia depois do cooldown vigente

Aumentar valia na hora; reduzir esperava. Sem essa assimetria, "edita para 1
minuto e pede de novo" seria o atalho que anula a fricção. **Esse padrão
sobreviveu ao pivô** — ver *mudar a duração está sujeita à espera*.

### Recurso de outra conta respondia 404, nunca 403

403 confirmaria que o id existe.

### Postgres real nos testes, sem H2

H2 mente sobre `timestamptz`, sobre constraint e sobre índice parcial, e o
produto dependia dos três.

### Java 21 como baseline

Troca de plataforma apenas — nada no código usava recurso de linguagem acima de
17. Suíte verde em 21 (81 testes) antes do arquivamento.

---

## Módulos nativos (2026-08-29)

### iOS adapta biblioteca, Android escreve do zero

A resposta é diferente por plataforma; a apuração completa está em
`decisao-modulos-nativos.md`.

### `clientRef` aleatório, não hash do `packageName`

Hash de valor enumerável **não esconde, só parece esconder** — e "parece" é o
pior estado possível, porque a gente passa a confiar. O conjunto de
`packageName` é pequeno e público: quem tem o hash tem a lista.

---

## Design system (2026-08-29)

### Nenhuma biblioteca de UI externa

O `StyleSheet` do React Native resolve o inventário inteiro.

### `surfaces.*` como objeto único, não tokens soltos

`fill`, `pressedFill` e `onFill` viajam juntos. O motivo é mecânico: nome que
promete par, sem tipo que imponha o par, é convenção com cara de garantia.

### Toda superfície tem duas relações de contraste, não uma

O que está em cima dela (4,5:1) **e** o canvas embaixo (3:1). Foi checar só a
primeira que deixou `amber.500` reprovando desde a primeira versão.

### Primário invertido no tema claro

Fundo `#04141c`, rótulo turquesa. Decisão do usuário. Regra derivada: o primário
é sempre a cor que contrasta com o canvas, e o rótulo é sempre a oposta.

### Marca: `#03c3bf` principal, `#04141c` de tema

O rótulo sobre o primário é o quase-preto, e o motivo é medido, não estético:
branco sobre `#03c3bf` dá **2,20:1** e reprova; `#04141c` sobre a mesma cor dá
**8,52:1**.

### Cor nomeada na escala, nunca hex órfão

`amber.550` (`#b37718`) entrou na escala em vez de virar hex solto. `red.500` nos
dois temas, em vez de inventar o `red.400` que a documentação citava e que não
existia. Lint bloqueia hex literal fora de `tokens.ts`.

Erros pré-existentes corrigidos junto: a documentação afirmava 7,1:1 num par que
mede 5,92:1.

### Disciplina: ao separar um variant do vizinho, cheque o vizinho do outro lado

---

## App React Native (2026-08-29)

### Expo com prebuild e development build

Expo Go não roda foreground service nem overlay.

### Toda versão fixada em patch exato

Nada de faixa.

### `app/` virou `native/`

O Expo Router exige `./app` para rotas. Restrição da ferramenta, não estética.

### Uma verdade só para o estado de proteção

`ProtectionVerdictContext` com instância única do hook. Duas leituras decidiriam
vereditos diferentes ao mesmo tempo.

### Estado `loading` explícito enquanto as leituras assíncronas não voltam

O splash só esconde depois. Sem isso, ou pisca onboarding em quem já concluiu, ou
mostra tela protegida sem proteção confirmada.

### iOS é `plataforma-nao-suportada`, verificado antes de qualquer leitura de permissão

No iOS não é permissão pendente, é recurso inexistente. Representar como permissão
era o que produzia o loop.

### Voltar engolido só quando não há passo anterior

Via `useFocusEffect`: o React Navigation mantém telas anteriores montadas, e um
`useEffect` comum vazaria o listener para a tela seguinte.

---

## O pivô (2026-08-29)

O produto passou a ser **100% local no aparelho**: sem backend, sem banco, sem
autenticação, sem parceiro de confiança, sem cerimônia arbitrada por servidor.

O motivo, nas palavras do usuário:

> o MVP já tem que ser funcional, e colocar backend e banco num app como esse é só
> complexidade desnecessária.

**A arquitetura anterior não estava errada, estava cara.** Ela resolvia problemas
reais — tempo autoritativo, aprovação de parceiro, estado que sobrevive à
reinstalação — ao custo de servidor, banco, autenticação e deploy, para um MVP que
precisa funcionar antes de escalar. O pivô troca garantias por entregabilidade, e a
seção de dívidas conhecidas é a conta dessa troca. Foi escolha, não descuido.

O que morreu junto: a cerimônia de desbloqueio com cooldown do servidor **e**
aprovação de parceiro; a válvula unilateral de 48 h; o failsafe local de 7 dias
sem servidor; a âncora de relógio em `serverTime`.

Consequência que precisa ficar dita: sem servidor, **o relógio do aparelho é do
dono do aparelho**. Toda defesa de tempo que sobrou tem de ser monotônica, e é
por isso que as decisões seguintes existem.

---

## Atrito local, depois do pivô (2026-08-29)

### Atrito é espera monotônica

Sem servidor, desbloqueio impossível não existe — desinstalar sempre está
disponível. O objetivo muda de **impedir** para **custar mais que o impulso**:
impulso de abrir o Instagram dura segundos, espera de 30 minutos derrota isso, e
quem desinstala e reconfigura decidiu em vez de ceder.

A mecânica é soma de deltas monotônicos persistida, recuperada do
`OfflineFailsafeCounter` do backend arquivado: adiantar o relógio não avança
nada, e reboot troca o cursor sem zerar o acumulado.

### Um pedido por vez

Esperas em paralelo fariam a fricção custar 30 minutos **uma vez**, e não uma vez
por decisão.

### Desligar a proteção passa pela mesma espera

Espera por app é encenação se desligar tudo continua a uma chamada.

### Mudar a duração está sujeita à espera

Senão a pessoa põe zero e desbloqueia na hora, e a espera passa a proteger apenas
quem não pensou nisso. É o mesmo padrão do cooldown do backend arquivado, sem o
banco.

### Cancelar é livre

Desistir de desbloquear é o resultado desejado. Cancelar caro empurraria a pessoa
a esperar por teimosia, e o que se quer é que ela comece, espere e mude de ideia.

### Concessão de 15 minutos, configurável pela mesma porta

### Modo restrito: ligar é imediato, desligar pede 30min

Configuração nova do produto. A pessoa liga o modo restrito no Perfil e, enquanto
ele estiver ativo, a tela de escolha de apps mostra um aviso em vez da lista — nem
ver nem editar. Ativar é imediato: é o compromisso com o próprio futuro da pessoa.
Desativar passa pelo mesmo motor de espera monotônica de `WaitingPeriod`, com
alvo próprio `WaitTarget.RestrictedModeOff` (kind `RESTRICTED_MODE_OFF`).

A escolha de "ativar imediato, desativar com espera" não é simétrica de propósito.
Ligar é o caso em que a pessoa decidiu antes: ela quer endurecer o bloqueio e o
ato de ligar é o resultado dessa decisão. Desligar é o que o impulso tenta, e
custa exatamente o mesmo tempo que custa tirar um app da lista de bloqueio ou
desligar a proteção inteira — quem ativa o modo restrito já aceitou a regra das
outras esperas, e tratar esta como exceção abriria um atalho. Espelha a regra
"desligar a proteção passa pela mesma espera" acima.

Estado persistido em `BlockPolicy.restricted` (no `core/`, ao lado de
`blockedPackages`) e nunca no AsyncStorage do JS: a fonte única da configuração
do bloqueio continua sendo o nativo, e `policy.json` ilegível continua recusando
gravação em vez de aceitar um apagamento silencioso. A UI lê do
`protectionState()` do nativo; `restricted` **não** vira sexto valor de
`ProtectionVerdict` porque é chave de configuração, não chave de roteamento
(ver `src/state/verdict.ts` — `Snapshot.restricted` existe, `computeVerdict`
não muda de ramo com ela). O gate na tela `/apps` é uma condicional simples,
não um `Stack.Protected`.

A barreira de burla A1, A7, A11 e "um pedido por vez" valem para este alvo pelo
mesmo motivo: `WaitingPeriod` é o motor, `RestrictedModeOff` é só mais um caso
no `sealed interface WaitTarget`. Reboot congela a espera, adiantar relógio não
adianta, trocar de alvo zera o progresso, cancelar é livre — todos os
comportamentos já provados em `WaitingPeriodTest` (novos cenários em
`disablingRestrictedModeGoesThroughTheWait`, `onlyMonotonicTimeAdvancesRestrictedModeOffWait`,
`rebootFreezesRestrictedModeOffWait`, `switchingTargetFromRestrictedModeOffRestarts`,
`pendingUnlockForIgnoresRestrictedModeOff`, `cancellingRestrictedModeOffIsFree`).

A matriz de burla ganha uma linha nova no Grupo A (A12) — ver
`docs/qa/matriz-cenarios-burla.md`.

### A concessão não é uma lista, é um saldo

Antes, concessão era entrada em `BlockPolicy` com `grantEndsAt` em relógio de
parede, e concessão expirada nunca era removida. Juntando as duas coisas, cada
liberação já obtida virava **chave permanente**: bastava atrasar o relógio para
antes do `grantEndsAt` e uma concessão morta voltava a valer.

Agora existe uma concessão ativa por vez, guardada como saldo que só diminui,
descontado em delta monotônico. **Não há instante de fim para comparar**, então
não há o que atrasar; e concessão encerrada é apagada, não arquivada. O defeito
deixou de ter onde acontecer, em vez de ser tratado — purga é um passo que alguém
esquece de chamar.

### Reboot encerra a concessão, e preserva a espera

As políticas são opostas de propósito. Com saldo puramente monotônico, desligar o
aparelho congelaria o desconto: bastaria desligar três horas para a concessão
sobreviver intacta.

O custo recai sobre quem não fez nada — reinício por bateria ou crash tira a
liberação. É aceitável porque erra para o lado conservador. **Não conserte isso
preservando a concessão no boot**: reabre o flanco de desligar para preservar
saldo, que é indistinguível de um reinício legítimo.

### Sem quota de emergência

Local, viraria botão de desbloqueio imediato que todo mundo aprende a usar. A
emergência real já está coberta pela isenção de apps críticos — emergência é
ligar para alguém, não abrir o Instagram.

### Grant sem hora de início

Sem caso de uso.

### A fonte única da lista de bloqueados é o nativo

O serviço decide com o app fechado, e o AsyncStorage é inalcançável sem JS
rodando.

### Auto Backup ligado como conveniência, nunca como defesa

`allowBackup` explícito no `app.json`. Ele pode devolver a configuração a quem
troca de aparelho ou desinstala sem querer — mas **não** fecha o caminho da
desinstalação, e não deve ser descrito como se fechasse: o dono do aparelho
desliga backup em Ajustes, e defesa que o adversário desliga não é defesa.

### O teto declarado: desinstalar derrota tudo

Sem Device Admin, vetado pelo usuário, não há defesa contra isso. Não invente uma.

### Force-stop é o caminho mais barato, e a resposta é medir, não defender

Depois de um force-stop pelas Configurações, o app entra no *stopped state*, e nesse
estado o Android **não entrega broadcast nenhum** para ele. `BOOT_COMPLETED` não
chega, o `BootReceiver` não dispara, e o `ServiceWatchdog` não tem quem o reagende: a
proteção fica desligada **atravessando reboot**, até a pessoa abrir o app manualmente.

Custo para quem quer burlar: dois toques. É mais barato que a espera de 30 minutos e
mais barato que desinstalar — e, ao contrário de desinstalar, é reversível e não perde
a configuração. **É o vetor mais barato do produto.**

Não há defesa: sem Device Admin, um app não impede o próprio force-stop. A resposta é
**medir e mostrar**, e isso não é consolo.

Esta ferramenta é um compromisso da pessoa com ela mesma — ela não é uma invasora de
quem o app se defende, é alguém que pediu ajuda contra o próprio impulso. Para ela,
**lapso invisível é o que faz o produto falhar em silêncio**; lapso visível é
exatamente a informação que ela instalou o app para ter. E sem isso o app voltaria
dizendo "você está protegido" sobre um período em que não estava — a mesma mentira já
corrigida no iOS, no estado de pausa e na leitura da política.

O que o registro **não** sabe: por que o serviço morreu. Force-stop, morte por
memória, crash e aparelho desligado são indistinguíveis. E interrupção que atravessa
reboot é **contada sem ser cronometrada**, porque o `elapsedRealtime` zera e o relógio
de parede é do dono do aparelho. O número é honesto; o rótulo seria chute.

### O estado ativo é flag persistida, não "o serviço está no ar"

Consultar serviço rodando é limitado desde o Android 8, e pior: serviço morto por
falta de memória responderia "inativo", e o app diria "pausado" a quem nunca pausou —
a mesma mentira, invertida. A flag é gravada quando a proteção liga e quando é
desligada **deliberadamente**, e sobrevive à morte do processo.

### Criação do serviço não é sinônimo de boot

O Android recria o serviço sozinho ao reciclá-lo por pressão de memória, o que em
aparelho modesto é rotina. Tratar isso como boot encerrava a concessão de quem não
fez nada — o custo aceito no reboot, que é raro e conservador, virava frequente e
arbitrário.

O `elapsedRealtime` não zera quando o processo morre, só no boot de verdade, então o
cursor persistido separa os dois sem ambiguidade. O intervalo fora do ar tem
tratamento **oposto** nos dois mecanismos, pelo mesmo critério conservador: é
**descontado** da concessão (nada estava bloqueado, a pessoa já usou aquele tempo) e
**congelado** na espera (a espera demora mais, nunca menos).

---

## Bloqueio de sites (2026-09-13)

### Domínio e subdomínios, nunca caminho

`instagram.com` bloqueia também `www.`, `m.` e `l.instagram.com`. Caminho de URL
(`youtube.com/shorts`) fica de fora: o filtro do iOS só enxerga domínio, e a barra do
navegador no Android costuma mostrar só o domínio fora de foco. Prometer caminho num
lado só seria regra diferente por plataforma.

A regra mora em `SiteMatcher` no `core/`, e a mesma função normaliza o que a pessoa
digita e o que a barra mostra. `src/state/blockedSites.ts` repete a normalização só para
a tela recusar entrada na hora; o nativo renormaliza ao gravar.

### Android lê a barra de endereço por AccessibilityService

Decisão do usuário, contra o que este documento dizia. `UsageStatsManager` só entrega o
pacote, e o Chrome é um pacote só para todos os sites. A alternativa avaliada foi VPN
local com filtro DNS: ocupa o único slot de VPN do aparelho, é contornada por DNS
privado e não diz com precisão quando desenhar o overlay.

O serviço é restrito por `packageNames` a Chrome, Samsung Internet, Firefox, Edge e
Brave — o sistema nem entrega evento de outro app. O endereço fica só em memória:
gravar seria histórico de navegação, e o produto não guarda isso. O serviço também não
inicia o `BlockerService`, senão um evento de navegador religaria proteção pausada.

Custos aceitos: declaração de uso no Play Console com divulgação em destaque (a tela
`sites.tsx` explica o que é lido **antes** de mandar para as Configurações), view ids
que mudam entre versões dos navegadores e só quebram em aparelho, e "configurações
restritas" a liberar à mão no Android 13+ fora da Play.

### iOS delega o bloqueio ao sistema

`ManagedSettings.webContent.blockedByFilter = .specific(...)` com os domínios
digitados. Quem desenha a tela é a página de restrição do iOS, não um shield nosso. Por
isso o espelho Swift de `SiteMatcher` e do `BlockDecider` existe (sincronia do
`core/`), mas não está no caminho de decisão do iOS.

### Sem concessão e sem espera por site

Adicionar e remover site é livre, como na lista de apps. Não existe pedido de
desbloqueio de site: `requestUnlock` ainda não tem tela nem para apps. E a concessão do
navegador como app **não** libera os sites da lista — liberar o Chrome não pode virar
liberar todo site bloqueado.

---

## Projeto

### Licença MIT

Decisão do usuário. Titular do copyright: **Lucas Marujo**, 2026. O arquivo
`LICENSE` está na raiz — repositório público sem licença é "todos os direitos
reservados" na prática, e isso é o oposto da intenção.

### Conventional Commits a partir de 2026-08-29

`feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`, `build:`, `ci:`, com
escopo quando ajudar, e `BREAKING CHANGE:` no rodapé quando o contrato quebrar.

Os commits anteriores ficam como estão. Reescrever histórico compartilhado para
satisfazer uma convenção adotada depois troca um problema cosmético por um real.

---

## Dívidas conhecidas

Não são decisões. São coisas que ainda não existem ou não foram verificadas, e
estão aqui para ninguém descobrir sozinho depois de duas horas.

- **A camada `android/` nunca compilou.** Só o módulo `core` (Kotlin puro) roda em
  JVM. `BlockerService`, `PlatformPorts` e a ponte Expo estão revisados e não
  compilados; a primeira `expo prebuild` é a primeira vez que esse código existe.
- **Sobrevivência do serviço em fabricante agressivo não foi verificada.** Há
  `ServiceWatchdog` e receiver de boot, mas nada disso foi medido em aparelho, e
  nenhum teste em JVM alcança.
- **O force-stop não foi verificado em aparelho.** O mecanismo do *stopped state* é
  comportamento documentado do Android e leitura de código, não medição. É o item de
  maior prioridade quando a camada `android/` compilar.
- **`performance.now()` no Hermes** não foi verificado em aparelho.
- **Nenhuma biblioteca de ícones escolhida.**
- **O entitlement da Apple para Family Controls não foi solicitado.**
