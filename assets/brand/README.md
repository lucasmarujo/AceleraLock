# Mark do AceleraLock — assets

Fonte única (`shield-mark.svg`), mesma silhueta do ícone `shield` da família
Feather (`@expo/vector-icons`, já em uso no app — família única por design,
ver `docs/design-system.md` §5). Reaproveitar a forma em vez de desenhar um
mark novo mantém o ícone dentro do app e o mark do produto como a mesma
linguagem visual.

Path: `M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z`, viewBox `0 0 24 24`.
Origem: feathericons.com (MIT). Preenchido (`fill`), não traçado — em
tamanho pequeno (ícone de app, drawable de notificação) preenchimento
sólido lê melhor que traço de 2px.

## Arquivos

- `shield-mark.svg` — fonte, `fill="currentColor"`.
- `shield-mark-turquesa.svg` / `shield-mark-tema.svg` — mesma forma, cor
  fixa, pra quem precisar de um arquivo sem `currentColor`.
- `android/ic_shield_turquesa.xml` / `android/ic_shield_tema.xml` —
  `VectorDrawable` prontos (mesmo path, sem precisar de rasterização).

## Regra de cor — nunca a mesma nos dois temas

`#03c3bf` (turquesa) sobre fundo escuro · `#04141c` (quase-preto) sobre
fundo claro. Mesma regra do resto do sistema (§1.2): a cor do mark é a que
contrasta com o fundo em que ele está, não um valor fixo.

## Sugestão pro `dev`, sem decidir por você

Os dois `VectorDrawable` têm o mesmo desenho — se o Android já resolve o
tema em outro lugar do código (via `uiMode`), pode preferir um recurso só
com a cor setada em runtime em vez de dois arquivos. Se preferir a
convenção nativa do Android (`res/drawable/ic_shield.xml` = claro,
`res/drawable-night/ic_shield.xml` = escuro, troca sozinho com o tema do
sistema, sem código), os dois arquivos aqui já têm o conteúdo pronto pra
cada pasta — só renomear os dois pro mesmo nome. Sua escolha de
implementação, os dois arquivos servem pros dois caminhos.

## Pendente — não incluído aqui

PNG do ícone do app (`expo.icon`), do `adaptiveIcon.foregroundImage` e do
splash (`expo-splash-screen`) — bloqueado neste ambiente por falta de
rasterizador SVG→PNG (sem ImageMagick/cairosvg/PIL/sharp instalados) e sem
`GEMINI_API_KEY` configurada pra a geração via IA. Os três podem ser
gerados a partir dos SVGs acima assim que um dos dois existir — ver
mensagem ao `supervisor`.
