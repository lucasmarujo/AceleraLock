"""
Gerador do mark do AceleraLock (letra A + cadeado + circulo), de todos os
assets de icone derivados dele — decisao do usuario, 2026-08-29 — e do badge
de splash (BADGE, decisao do usuario 2026-08-30), que reaproveita o MESMO
cadeado dentro do disco e do anel gradiente herdados da logo do AceleraDev.

Uma unica definicao de geometria (GRID abaixo, unidades de 0 a 100) alimenta
os tres formatos de saida: os SVG de origem, os PNG de Expo/iOS/Android e os
resources XML do adaptive icon. Sem rasterizador SVG neste ambiente (nem
ImageMagick, nem cairosvg, nem sharp — so Pillow), entao o desenho e feito
duas vezes a partir das MESMAS constantes: em SVG (texto) e em Pillow
(primitivas equivalentes — elipse com outline, retangulo arredondado, arco e
traco com cap redondo). Alterar geometria = alterar GRID, nunca um dos dois
lados.

Cor: `brand.turquesa` (#03c3bf) sobre `brand.tema` (#04141c) — o par de marca
de src/theme/tokens.ts / docs/design-system.md §1.1. O icone do app tem fundo
proprio (nao herda o tema do sistema), entao ele fixa a combinacao de maior
contraste do par; as duas variantes de cor do mark continuam existindo como
SVG, mesma regra do shield (§1.2, "a cor que contrasta com o fundo").

Uso: python assets/brand/build-icons.py
"""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw

TURQUESA = "#03c3bf"
TEMA = "#04141c"
BRANCO = "#ffffff"
# Pontas do gradiente do anel — a linhagem do AceleraDev, `brand.acelera*`.
AZUL = "#014D93"
CIANO = "#08EFD5"

# Geometria do mark, em unidades de uma caixa 100x100 (viewBox "0 0 100 100").
# ring    — o circulo que envolve os dois; traco centrado no raio.
# body    — corpo do cadeado, retangulo arredondado preenchido.
# shackle — a haste do cadeado; termina exatamente na borda de cima do corpo,
#           por isso cap reto: cap redondo criaria uma saliencia ali.
# a_*     — o "A", vazado no corpo (alpha zerado, nao pintado de escuro): assim
#           o mesmo layer serve pro icone opaco e pro foreground transparente
#           do adaptive icon do Android.
GRID = {
    "ring_c": 50.0,
    "ring_r": 43.0,
    "ring_w": 6.0,
    "body": (27.0, 38.0, 73.0, 80.0),
    "body_r": 12.0,
    "shackle_c": (50.0, 38.0),
    "shackle_r": 15.0,
    "shackle_w": 5.5,
    "a_apex": (50.0, 47.0),
    "a_feet": ((37.5, 72.0), (62.5, 72.0)),
    "a_bar": ((41.5, 64.0), (58.5, 64.0)),
    "a_w": 6.0,
}

# Fracao da tela ocupada pela caixa 100x100 do mark.
# FULL — icone de tela cheia (iOS, Play Store, launcher legado).
# SAFE — foreground do adaptive icon do Android: a tela e 108dp e so os 66dp
#        centrais sao area segura (o launcher recorta e anima o resto).
SCALE_FULL = 0.80
SCALE_SAFE = 0.65

MARK_DIAM = (GRID["ring_r"] + GRID["ring_w"] / 2) * 2 / 100
assert MARK_DIAM * SCALE_SAFE <= 66 / 108, "mark estoura a area segura do adaptive icon"
assert MARK_DIAM * SCALE_FULL <= 1.0, "mark estoura a tela do icone"

# Badge de splash — a logo do AceleraLock (decisao do usuario, 2026-08-30).
#
# Nao e variante do mark: e um lockup proprio, na linguagem visual da logo do
# AceleraDev (`assets/acelera-logo.svg`). O disco escuro e o anel fino com
# gradiente azul->ciano foram MEDIDOS daquele arquivo — anel com 2.87% do
# diametro, gradiente da baixo-esquerda pra cima-direita — pra que as duas
# logos leiam como irmas quando aparecem juntas na splash.
#
# O que diferencia: dentro do disco vai o cadeado-com-A (o mesmo GRID, sem o
# anel do mark — o anel do badge ja faz esse papel) e, embaixo, uma fileira de
# app tiles atenuados. O cadeado diz "lock", os tiles dizem "apps": junto,
# "bloqueador de apps". O launcher continua com o mark puro (SCALE_FULL); o
# badge e a marca completa, so onde ha espaco pra ela.
BADGE = {
    "ring_r": 48.5,
    "ring_w": 3.0,
    "disc_r": 47.0,
    # Cadeado reescalado e subido pra abrir a faixa dos tiles sem encostar nele.
    "lock_k": 0.82,
    "lock_dy": -6.0,
    "tiles": 3,
    "tile_side": 11.0,
    "tile_gap": 6.0,
    "tile_y": 78.0,
    # Tiles atenuados de proposito: o cadeado e que e o primario da marca.
    "tile_opacity": 0.686,
    "tile_r": 0.28,  # fracao do lado — squircle de icone de app
}

# Fracao da tela ocupada pelo badge (que preenche a caixa 100x100 inteira).
# FULL — badge dentro do app, onde o <Image> e que define o tamanho.
# SAFE — icone da splash NATIVA: o Android 12+ so mostra o miolo do drawable,
#        entao o badge precisa caber ali com folga ou aparece recortado.
SPLASH_SCALE_FULL = 0.96
SPLASH_SCALE_SAFE = 0.62

_TILE_SPAN = BADGE["tiles"] * BADGE["tile_side"] + (BADGE["tiles"] - 1) * BADGE["tile_gap"]
_TILE_CORNER = (
    (_TILE_SPAN / 2) ** 2 + (BADGE["tile_y"] + BADGE["tile_side"] - 50) ** 2
) ** 0.5
assert _TILE_CORNER <= BADGE["disc_r"], "tiles do badge saem do disco"
assert BADGE["ring_r"] + BADGE["ring_w"] / 2 <= 50, "anel do badge estoura a caixa 100"
assert SPLASH_SCALE_SAFE <= 2 / 3, "badge estoura a mascara circular da splash do Android 12+"

RENDER = 2048  # tudo e desenhado neste tamanho e reduzido com LANCZOS

ROOT = Path(__file__).resolve().parents[2]
ASSETS = ROOT / "assets"
BRAND = ASSETS / "brand"
ICON = BRAND / "icon"

ANDROID_DENSITIES = {"mdpi": 1, "hdpi": 1.5, "xhdpi": 2, "xxhdpi": 3, "xxxhdpi": 4}


def _unit(scale: float):
    """Converte unidade do GRID em pixel de um canvas RENDER x RENDER."""
    span = RENDER * scale
    off = (RENDER - span) / 2
    return (lambda v: off + v * span / 100), span / 100


def _stroke(draw: ImageDraw.ImageDraw, pts, width: int, fill) -> None:
    """Traco de cap e junta redondos — o `joint` do Pillow so cobre a junta."""
    draw.line(pts, fill=fill, width=width, joint="curve")
    r = width / 2
    for x, y in (pts[0], pts[-1]):
        draw.ellipse([x - r, y - r, x + r, y + r], fill=fill)


def mark_layer(
    color: str, scale: float, k: float = 1.0, dy: float = 0.0, ring: bool = True
) -> Image.Image:
    """RGBA RENDER x RENDER: mark na cor pedida, fundo e "A" transparentes.

    `k`/`dy` reescalam e sobem/descem o desenho dentro da caixa 100, e `ring`
    desliga o circulo do mark: e assim que o badge de splash reaproveita o
    MESMO cadeado do icone em vez de ter uma segunda geometria pra manter em
    sincronia. Nos defaults (k=1, dy=0, ring=True) e o mark do icone.
    """
    to_px, unit = _unit(scale)
    unit *= k

    def at(x: float, y: float) -> tuple[float, float]:
        return to_px(50 + (x - 50) * k), to_px(50 + (y - 50) * k + dy)

    layer = Image.new("RGBA", (RENDER, RENDER), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)

    if ring:
        cx, cy = at(GRID["ring_c"], GRID["ring_c"])
        ro = (GRID["ring_r"] + GRID["ring_w"] / 2) * unit
        draw.ellipse(
            [cx - ro, cy - ro, cx + ro, cy + ro], outline=color, width=round(GRID["ring_w"] * unit)
        )

    bx0, by0, bx1, by1 = GRID["body"]
    draw.rounded_rectangle(
        [at(bx0, by0), at(bx1, by1)], radius=GRID["body_r"] * unit, fill=color
    )

    sx, sy = at(*GRID["shackle_c"])
    so = (GRID["shackle_r"] + GRID["shackle_w"] / 2) * unit
    draw.arc(
        [sx - so, sy - so, sx + so, sy + so],
        180,
        360,
        fill=color,
        width=round(GRID["shackle_w"] * unit),
    )

    cut = Image.new("L", (RENDER, RENDER), 0)
    cut_draw = ImageDraw.Draw(cut)
    aw = round(GRID["a_w"] * unit)
    left, right = GRID["a_feet"]
    _stroke(cut_draw, [at(*left), at(*GRID["a_apex"]), at(*right)], aw, 255)
    _stroke(cut_draw, [at(*p) for p in GRID["a_bar"]], aw, 255)
    layer.putalpha(ImageChops.subtract(layer.getchannel("A"), cut))
    return layer


def compose(
    px: int, color: str, scale: float, bg: str | None = None, shape: str = "square"
) -> Image.Image:
    canvas = Image.new("RGBA", (RENDER, RENDER), (0, 0, 0, 0))
    if bg is not None:
        plate = ImageDraw.Draw(canvas)
        if shape == "circle":
            plate.ellipse([0, 0, RENDER - 1, RENDER - 1], fill=bg)
        elif shape == "rounded":
            plate.rounded_rectangle([0, 0, RENDER - 1, RENDER - 1], radius=RENDER * 0.22, fill=bg)
        else:
            plate.rectangle([0, 0, RENDER, RENDER], fill=bg)
    return Image.alpha_composite(canvas, mark_layer(color, scale)).resize((px, px), Image.LANCZOS)


def _rgb(hex_color: str) -> tuple[int, int, int]:
    h = hex_color.lstrip("#")
    return tuple(int(h[i : i + 2], 16) for i in (0, 2, 4))


def _diag_gradient(a: str, b: str, small: int = 64) -> Image.Image:
    """Gradiente linear baixo-esquerda -> cima-direita, como o anel do AceleraDev.

    Desenhado num canvas `small` e ampliado: gradiente e suave, o upscale nao
    perde nada visivel e evita um laco de RENDER x RENDER pixels em Python
    puro (que sozinho custava mais que o resto do gerador inteiro).
    """
    rgb_a, rgb_b = _rgb(a), _rgb(b)
    grad = Image.new("RGB", (small, small))
    px = grad.load()
    for y in range(small):
        for x in range(small):
            t = ((x / (small - 1)) + (1 - y / (small - 1))) / 2
            px[x, y] = tuple(round(p + (q - p) * t) for p, q in zip(rgb_a, rgb_b))
    return grad.resize((RENDER, RENDER), Image.BICUBIC)


def badge_plate(scale: float) -> Image.Image:
    """Disco escuro + anel com gradiente — a parte herdada do AceleraDev."""
    to_px, unit = _unit(scale)
    c = to_px(50.0)
    layer = Image.new("RGBA", (RENDER, RENDER), (0, 0, 0, 0))
    disc = BADGE["disc_r"] * unit
    ImageDraw.Draw(layer).ellipse([c - disc, c - disc, c + disc, c + disc], fill=TEMA)

    ring = Image.new("L", (RENDER, RENDER), 0)
    ro = BADGE["ring_r"] * unit
    ImageDraw.Draw(ring).ellipse(
        [c - ro, c - ro, c + ro, c + ro], outline=255, width=round(BADGE["ring_w"] * unit)
    )
    layer.paste(_diag_gradient(AZUL, CIANO), (0, 0), ring)
    return layer


def badge_tiles(scale: float) -> Image.Image:
    """Fileira de app tiles sob o cadeado — o "apps" de bloqueador de apps."""
    to_px, unit = _unit(scale)
    layer = Image.new("RGBA", (RENDER, RENDER), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    side, gap, y = BADGE["tile_side"], BADGE["tile_gap"], BADGE["tile_y"]
    x = 50 - _TILE_SPAN / 2
    for _ in range(BADGE["tiles"]):
        draw.rounded_rectangle(
            [to_px(x), to_px(y), to_px(x + side), to_px(y + side)],
            radius=side * BADGE["tile_r"] * unit,
            fill=TURQUESA,
        )
        x += side + gap
    opacity = round(255 * BADGE["tile_opacity"])
    layer.putalpha(layer.getchannel("A").point(lambda p: p * opacity // 255))
    return layer


def badge(px: int, scale: float) -> Image.Image:
    """A logo do AceleraLock: plate + cadeado-com-A + tiles. Fundo transparente."""
    out = badge_plate(scale)
    out = Image.alpha_composite(
        out, mark_layer(TURQUESA, scale, k=BADGE["lock_k"], dy=BADGE["lock_dy"], ring=False)
    )
    out = Image.alpha_composite(out, badge_tiles(scale))
    return out.resize((px, px), Image.LANCZOS)


def write_png(path: Path, img: Image.Image, opaque: bool = False) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    (img.convert("RGB") if opaque else img).save(path, "PNG", optimize=True)
    print(f"  {path.relative_to(ROOT).as_posix()}  {img.size[0]}x{img.size[1]}")


def svg_source(color: str) -> str:
    x0, y0, x1, y1 = GRID["body"]
    sx, sy = GRID["shackle_c"]
    sr = GRID["shackle_r"]
    ax, ay = GRID["a_apex"]
    (lx, ly), (rx, ry) = GRID["a_feet"]
    (bx0, by0), (bx1, _) = GRID["a_bar"]
    aw = GRID["a_w"]
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none">\n'
        '  <mask id="aceleralock-a" maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">\n'
        '    <rect width="100" height="100" fill="#fff"/>\n'
        f'    <path d="M{lx} {ly}L{ax} {ay}L{rx} {ry}" stroke="#000" stroke-width="{aw}"'
        ' stroke-linecap="round" stroke-linejoin="round"/>\n'
        f'    <path d="M{bx0} {by0}H{bx1}" stroke="#000" stroke-width="{aw}" stroke-linecap="round"/>\n'
        "  </mask>\n"
        '  <g mask="url(#aceleralock-a)">\n'
        f'    <circle cx="{GRID["ring_c"]}" cy="{GRID["ring_c"]}" r="{GRID["ring_r"]}"'
        f' stroke="{color}" stroke-width="{GRID["ring_w"]}"/>\n'
        f'    <rect x="{x0}" y="{y0}" width="{x1 - x0}" height="{y1 - y0}"'
        f' rx="{GRID["body_r"]}" fill="{color}"/>\n'
        f'    <path d="M{sx - sr} {sy}A{sr} {sr} 0 0 1 {sx + sr} {sy}"'
        f' stroke="{color}" stroke-width="{GRID["shackle_w"]}"/>\n'
        "  </g>\n"
        "</svg>\n"
    )


SVG_HEAD = """<!--
  Mark do AceleraLock: a letra "A" vazada no corpo de um cadeado, os dois
  dentro de um circulo.{extra}
  Gerado por assets/brand/build-icons.py — editar la (constante GRID), nunca
  este arquivo: os PNG de icone saem da mesma geometria e sairiam de sincronia.
-->
"""

SVG_VARIANTS = (
    (
        "alock-mark.svg",
        "currentColor",
        " Cor via `currentColor` — quem consome define;\n  as duas cores validas do sistema estao nas variantes ao lado.",
    ),
    ("alock-mark-turquesa.svg", TURQUESA, " Variante turquesa — sobre fundo escuro."),
    ("alock-mark-tema.svg", TEMA, " Variante quase-preta — sobre fundo claro."),
)

IOS_CONTENTS = {
    "images": [
        {"filename": "icon-1024.png", "idiom": "universal", "platform": "ios", "size": "1024x1024"},
        {
            "appearances": [{"appearance": "luminosity", "value": "dark"}],
            "filename": "icon-dark-1024.png",
            "idiom": "universal",
            "platform": "ios",
            "size": "1024x1024",
        },
        {
            "appearances": [{"appearance": "luminosity", "value": "tinted"}],
            "filename": "icon-tinted-1024.png",
            "idiom": "universal",
            "platform": "ios",
            "size": "1024x1024",
        },
    ],
    "info": {"author": "xcode", "version": 1},
}

ADAPTIVE_ICON_XML = (
    '<?xml version="1.0" encoding="utf-8"?>\n'
    '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n'
    '    <background android:drawable="@color/ic_launcher_background"/>\n'
    '    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>\n'
    '    <monochrome android:drawable="@mipmap/ic_launcher_monochrome"/>\n'
    "</adaptive-icon>\n"
)


def write_text(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    print(f"  {path.relative_to(ROOT).as_posix()}")


def main() -> None:
    print("SVG de origem:")
    for name, color, extra in SVG_VARIANTS:
        write_text(BRAND / name, SVG_HEAD.format(extra=extra) + svg_source(color))

    print("Expo (assets/):")
    write_png(ASSETS / "icon.png", compose(1024, TURQUESA, SCALE_FULL, bg=TEMA), opaque=True)
    write_png(ASSETS / "icon-ios-dark.png", compose(1024, TURQUESA, SCALE_FULL))
    write_png(ASSETS / "icon-ios-tinted.png", compose(1024, BRANCO, SCALE_FULL))
    write_png(ASSETS / "adaptive-icon-foreground.png", compose(1024, TURQUESA, SCALE_SAFE))
    write_png(ASSETS / "adaptive-icon-monochrome.png", compose(1024, BRANCO, SCALE_SAFE))

    print("Splash (assets/):")
    write_png(ASSETS / "splash-icon.png", badge(1024, SPLASH_SCALE_SAFE))
    write_png(ASSETS / "alock-badge.png", badge(1024, SPLASH_SCALE_FULL))

    print("iOS (AppIcon.appiconset):")
    ios = ICON / "ios" / "AppIcon.appiconset"
    write_png(ios / "icon-1024.png", compose(1024, TURQUESA, SCALE_FULL, bg=TEMA), opaque=True)
    write_png(ios / "icon-dark-1024.png", compose(1024, TURQUESA, SCALE_FULL))
    write_png(ios / "icon-tinted-1024.png", compose(1024, BRANCO, SCALE_FULL))
    write_text(ios / "Contents.json", json.dumps(IOS_CONTENTS, indent=2) + "\n")

    print("Android (res/):")
    android = ICON / "android"
    for density, factor in ANDROID_DENSITIES.items():
        mip = android / f"mipmap-{density}"
        launcher, foreground = round(48 * factor), round(108 * factor)
        write_png(
            mip / "ic_launcher.png",
            compose(launcher, TURQUESA, SCALE_FULL, bg=TEMA, shape="rounded"),
        )
        write_png(
            mip / "ic_launcher_round.png",
            compose(launcher, TURQUESA, SCALE_FULL, bg=TEMA, shape="circle"),
        )
        write_png(mip / "ic_launcher_foreground.png", compose(foreground, TURQUESA, SCALE_SAFE))
        write_png(mip / "ic_launcher_monochrome.png", compose(foreground, BRANCO, SCALE_SAFE))
    write_png(
        android / "ic_launcher-playstore.png",
        compose(512, TURQUESA, SCALE_FULL, bg=TEMA),
        opaque=True,
    )
    for name in ("ic_launcher.xml", "ic_launcher_round.xml"):
        write_text(android / "mipmap-anydpi-v26" / name, ADAPTIVE_ICON_XML)
    write_text(
        android / "values" / "ic_launcher_background.xml",
        '<?xml version="1.0" encoding="utf-8"?>\n'
        "<resources>\n"
        f'    <color name="ic_launcher_background">{TEMA}</color>\n'
        "</resources>\n",
    )


if __name__ == "__main__":
    main()
