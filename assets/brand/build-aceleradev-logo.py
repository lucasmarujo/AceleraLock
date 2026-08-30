"""
Rasteriza a logo do AceleraDev (assets/acelera-logo.svg) pro PNG que a splash
do app consome — a assinatura "Made By" da tela de splash.

Por que existe um rasterizador aqui em vez de um `<Svg>` na tela: o app nao
tem react-native-svg (package.json), e este ambiente nao tem rasterizador de
SVG nenhum (nem ImageMagick, nem cairosvg, nem sharp — a mesma restricao que
build-icons.py descreve). Como o arquivo de origem usa so um subconjunto
minusculo de SVG, rasterizar aqui sai muito mais barato que uma dependencia
nova dos dois lados.

O subconjunto suportado e exatamente o que acelera-logo.svg usa, e nada mais:

- `<path fill="..." d="...">` com os comandos M, L, C e Z;
- um unico subpath por path, sem furo — os contornos internos das letras sao
  paths escuros desenhados por cima, entao nao existe fill-rule pra respeitar;
- `<linearGradient>` com `gradientUnits="userSpaceOnUse"` e dois stops.

Se o arquivo de origem mudar e passar a usar arco, subpath multiplo ou
gradiente radial, este script levanta em vez de entregar um PNG errado em
silencio. **A logo do AceleraDev nao e nossa — nao editar o SVG, so trocar.**

Uso: python assets/brand/build-aceleradev-logo.py
"""

from __future__ import annotations

import re
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
ASSETS = ROOT / "assets"
SOURCE = ASSETS / "acelera-logo.svg"
OUT = ASSETS / "aceleradev-logo.png"

SIZE = 512  # a splash mostra a assinatura pequena; 512 ja e 4x o maior uso
SUPERSAMPLE = 4
CURVE_STEPS = 24  # segmentos por bezier cubica

NUMBER = re.compile(r"-?\d*\.?\d+(?:e-?\d+)?")
PATH = re.compile(r'<path\s+fill="([^"]+)"\s+d="([^"]+)"')
GRADIENT = re.compile(r'<linearGradient id="([^"]+)"([^>]*)>(.*?)</linearGradient>', re.S)
STOP = re.compile(r'offset="([^"]+)"\s+stop-color="([^"]+)"')
ATTR = re.compile(r'(\w+)="([^"]+)"')
VIEWBOX = re.compile(r'viewBox="0 0 (\d+(?:\.\d+)?) ')


def _rgb(hex_color: str) -> tuple[int, int, int]:
    h = hex_color.lstrip("#")
    return tuple(int(h[i : i + 2], 16) for i in (0, 2, 4))


def read_source() -> str:
    """SVG sem o bloco <metadata> — o C2PA do gerador ocupa 20 KB de base64."""
    return re.sub(r"<metadata>.*?</metadata>", "", SOURCE.read_text(encoding="utf-8"), flags=re.S)


def flatten(d: str) -> list[tuple[float, float]]:
    """Subpath unico de M/L/C/Z -> poligono. Levanta no que nao suportamos."""
    unsupported = set(re.findall(r"[A-Za-z]", d)) - set("MLCZ")
    if unsupported:
        raise ValueError(f"comando SVG nao suportado: {sorted(unsupported)}")
    if d.count("M") != 1:
        raise ValueError("path com mais de um subpath — poderia ter furo")

    points: list[tuple[float, float]] = []
    current = start = (0.0, 0.0)
    for command, args in re.findall(r"([MLCZ])([^MLCZ]*)", d):
        values = [float(n) for n in NUMBER.findall(args)]
        if command == "Z":
            points.append(start)
            current = start
        elif command == "C":
            for i in range(0, len(values), 6):
                p0 = current
                p1, p2, p3 = (
                    (values[i], values[i + 1]),
                    (values[i + 2], values[i + 3]),
                    (values[i + 4], values[i + 5]),
                )
                for step in range(1, CURVE_STEPS + 1):
                    t = step / CURVE_STEPS
                    u = 1 - t
                    points.append(
                        (
                            u**3 * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t**3 * p3[0],
                            u**3 * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t**3 * p3[1],
                        )
                    )
                current = p3
        else:  # M e L: pares de coordenada; o M so define o inicio do subpath
            for i in range(0, len(values), 2):
                current = (values[i], values[i + 1])
                points.append(current)
                if command == "M" and i == 0:
                    start = current
    return points


def parse_gradients(source: str) -> dict[str, tuple]:
    gradients = {}
    for gid, attrs, stops in GRADIENT.findall(source):
        attributes = dict(ATTR.findall(attrs))
        if attributes.get("gradientUnits") != "userSpaceOnUse":
            raise ValueError(f"{gid}: so gradientUnits=userSpaceOnUse e suportado")
        pairs = [(float(o), _rgb(c)) for o, c in STOP.findall(stops)]
        if len(pairs) != 2:
            raise ValueError(f"{gid}: esperados 2 stops, achados {len(pairs)}")
        gradients[gid] = (
            (float(attributes["x1"]), float(attributes["y1"])),
            (float(attributes["x2"]), float(attributes["y2"])),
            pairs[0][1],
            pairs[1][1],
        )
    return gradients


def gradient_image(size: int, viewbox: float, spec: tuple) -> Image.Image:
    """Gradiente linear projetado no eixo x1,y1 -> x2,y2 (coordenadas do SVG)."""
    (x1, y1), (x2, y2), color_a, color_b = spec
    k = size / viewbox
    x1, y1, x2, y2 = x1 * k, y1 * k, x2 * k, y2 * k
    dx, dy = x2 - x1, y2 - y1
    span = dx * dx + dy * dy
    image = Image.new("RGB", (size, size))
    px = image.load()
    for y in range(size):
        for x in range(size):
            t = ((x - x1) * dx + (y - y1) * dy) / span
            t = 0.0 if t < 0 else 1.0 if t > 1 else t
            px[x, y] = tuple(round(a + (b - a) * t) for a, b in zip(color_a, color_b))
    return image


def render(px: int) -> Image.Image:
    source = read_source()
    viewbox = float(VIEWBOX.search(source)[1])
    gradients = parse_gradients(source)
    size = px * SUPERSAMPLE
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    cache: dict[str, Image.Image] = {}

    paths = PATH.findall(source)
    if not paths:
        raise ValueError("nenhum <path> encontrado — o SVG de origem mudou de forma")

    for fill, d in paths:
        polygon = [(x * size / viewbox, y * size / viewbox) for x, y in flatten(d)]
        mask = Image.new("L", (size, size), 0)
        ImageDraw.Draw(mask).polygon(polygon, fill=255)
        reference = re.match(r"url\(#([^)]+)\)", fill)
        if reference:
            gid = reference[1]
            if gid not in cache:
                cache[gid] = gradient_image(size, viewbox, gradients[gid]).convert("RGBA")
            layer = cache[gid]
        else:
            layer = Image.new("RGBA", (size, size), _rgb(fill) + (255,))
        canvas.paste(layer, (0, 0), mask)

    return canvas.resize((px, px), Image.LANCZOS)


def main() -> None:
    image = render(SIZE)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    image.save(OUT, "PNG", optimize=True)
    print(f"  {OUT.relative_to(ROOT).as_posix()}  {image.size[0]}x{image.size[1]}")


if __name__ == "__main__":
    main()
