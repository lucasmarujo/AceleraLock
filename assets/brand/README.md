# Marks do AceleraLock — assets

Dois marks, com donos diferentes — não são variantes um do outro:

- **`alock-mark*.svg` — o mark do produto.** Letra "A" vazada no corpo de um
  cadeado, os dois dentro de um círculo (decisão do usuário, 2026-08-29). É o
  ícone do app: launcher, App Store/Play Store, splash de loja. **É o único
  mark que aparece fora do app.**
- **`shield-mark*.svg` — o ícone de estado "protegido" dentro do app.** Mesma
  silhueta do `shield` do Feather (`@expo/vector-icons`, família única por
  design, `docs/design-system.md` §5), reaproveitada para o estado protegido
  não divergir do ícone que aparece nas próprias telas — `BlockScreen` (§3.4),
  `ProtectedCard` (§3.3), drawable de notificação.

Mudar um **não** implica mudar o outro. O ícone do app é uma marca; o escudo é
vocabulário de UI.

## Regra de cor — nunca a mesma nos dois temas

`#03c3bf` (turquesa) sobre fundo escuro · `#04141c` (quase-preto) sobre fundo
claro. Mesma regra do resto do sistema (§1.2): a cor do mark é a que contrasta
com o fundo em que ele está, não um valor fixo.

O **ícone do app é a exceção deliberada**: ele carrega o próprio fundo
(`#04141c`, o mesmo `adaptiveIcon.backgroundColor` do `app.json`), não herda o
tema do sistema, então fixa turquesa-sobre-quase-preto — a combinação de maior
contraste do par (8.52:1). Por isso o `foregroundImage` do Android é turquesa:
o launcher sempre o compõe sobre esse fundo, nunca sobre um claro.

## Como os assets do ícone são gerados

**`build-icons.py` é a fonte.** Uma constante `GRID` define a geometria em
unidades de uma caixa 100×100, e dela saem os três formatos: os SVG, todos os
PNG e os XML do adaptive icon. Não existe rasterizador SVG neste ambiente
(sem ImageMagick / cairosvg / sharp — só Pillow), então o desenho é feito duas
vezes a partir das mesmas constantes: em SVG (texto) e em Pillow (primitivas
equivalentes). **Editar `GRID`, nunca um arquivo gerado** — SVG e PNG sairiam
de sincronia em silêncio.

```
python assets/brand/build-icons.py
```

`tests/brandIcon.test.ts` cobre o que o gerador promete: dimensões de cada
PNG, ausência de canal alfa no ícone opaco (a App Store rejeita com alfa), a
escada de densidades do Android e as cores saindo de `brand` (tokens.ts) em
vez de hex solto.

## O que sai

Consumido pelo Expo (caminhos que estão no `app.json`):

| Arquivo | Uso |
| --- | --- |
| `../icon.png` | `expo.icon` e `ios.icon.light` — 1024, opaco, sem alfa |
| `../icon-ios-dark.png` | `ios.icon.dark` — fundo transparente, iOS compõe |
| `../icon-ios-tinted.png` | `ios.icon.tinted` — mark em branco, iOS tinge |
| `../adaptive-icon-foreground.png` | `android.adaptiveIcon.foregroundImage` |
| `../adaptive-icon-monochrome.png` | `android.adaptiveIcon.monochromeImage` — ícone temático, Android 13+ |

Pronto para uso direto em projeto nativo (`expo prebuild` gera os seus a
partir do `app.json`; estes existem para o fluxo bare / Xcode / Android
Studio, e para submissão de loja):

- `icon/ios/AppIcon.appiconset/` — `Contents.json` + os três 1024 (claro,
  escuro, tingido). É o padrão atual do Xcode: **não existe mais a escada de
  20/29/40/60/76/83.5/1024** — desde o Xcode 14 o asset catalog é um 1024 por
  aparência e o resto é derivado no build.
- `icon/android/mipmap-{mdpi…xxxhdpi}/` — `ic_launcher`, `ic_launcher_round`
  (48dp), `ic_launcher_foreground`, `ic_launcher_monochrome` (108dp).
- `icon/android/mipmap-anydpi-v26/ic_launcher.xml` (+`_round`) e
  `icon/android/values/ic_launcher_background.xml`.
- `icon/android/ic_launcher-playstore.png` — 512, opaco, para o Play Console.

## Área segura do adaptive icon

A tela do foreground é 108dp e só os 66dp centrais sobrevivem ao recorte de
qualquer máscara de launcher. O gerador escala o mark para 59.8dp de diâmetro
(`SCALE_SAFE`) e trava isso num `assert` — mexer no `GRID` sem refazer a conta
quebra o build do ícone em vez de entregar um mark cortado.

## Escudo (`shield-mark*.svg`)

Path: `M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z`, viewBox `0 0 24 24`.
Origem: feathericons.com (MIT). Preenchido (`fill`), não traçado — em tamanho
pequeno (drawable de notificação) preenchimento sólido lê melhor que traço de
2px. `android/ic_shield_turquesa.xml` / `ic_shield_tema.xml` são os
`VectorDrawable` prontos (mesmo path, sem rasterização).

Se preferir a convenção nativa do Android (`res/drawable/ic_shield.xml` =
claro, `res/drawable-night/ic_shield.xml` = escuro, troca sozinho com o tema
do sistema, sem código), os dois arquivos já têm o conteúdo pronto para cada
pasta — só renomear os dois para o mesmo nome.

## Pendente

O splash (`../splash-icon-light.png` / `-dark.png`) ainda é o **escudo**. Com
o mark novo no launcher, abrir o app mostra um símbolo diferente do ícone que
foi tocado. Trocar é uma linha no `build-icons.py` — não foi feito porque a
rodada foi escopada no ícone.
