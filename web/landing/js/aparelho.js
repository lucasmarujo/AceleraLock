import { amortecer, escalaQueCabe } from './movimento.js';

const BASE = { largura: 414, altura: 868 };

/** Quanto da caixa o aparelho ocupa: o heroi deixa espaco para os chips em volta. */
const FOLGA = { heroi: 0.92, historia: 0.96, chamada: 0.9 };

const RIGIDEZ = 4.5;

function aplicar(aparelho) {
  const { rx, ry, rz } = aparelho.atual;
  aparelho.corpo.style.transform = `rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) rotateZ(${rz.toFixed(2)}deg)`;
  for (const reflexo of aparelho.reflexos) {
    reflexo.style.transform = `translate3d(${(-ry * 0.8).toFixed(1)}%, 0, 0)`;
  }
  aparelho.sombra.style.transform = `translateX(${(ry * 2.4).toFixed(1)}px)`;
}

/**
 * Os celulares 3D da pagina. Cada um tem uma pose-base, que quem conhece a secao
 * define (`pose`), e por cima dela o ponteiro e um balanco lento — o mesmo
 * `sin` lento do video de lancamento. O laco so roda com algum aparelho na tela.
 */
export function criarAparelhos({ reduzido }) {
  const aparelhos = [...document.querySelectorAll('[data-aparelho]')].map((el) => ({
    nome: el.dataset.aparelho,
    el,
    corpo: el.querySelector('.aparelho-corpo'),
    sombra: el.querySelector('.aparelho-sombra'),
    reflexos: [...el.querySelectorAll('[data-reflexo]')],
    segueOPonteiro: el.dataset.aparelho !== 'historia',
    pose: { rx: 0, ry: 0, rz: 0 },
    atual: { rx: 0, ry: 0, rz: 0 },
    visivel: false,
  }));
  const porNome = new Map(aparelhos.map((aparelho) => [aparelho.nome, aparelho]));
  const ponteiro = { x: 0, y: 0 };
  let rodando = false;
  let ultimo = 0;

  const medidor = new ResizeObserver((entradas) => {
    for (const { target, contentRect } of entradas) {
      const aparelho = aparelhos.find(({ el }) => el === target);
      const escala =
        escalaQueCabe(contentRect.width, contentRect.height, BASE) * FOLGA[aparelho.nome];
      target.style.setProperty('--escala', escala.toFixed(4));
    }
  });

  const vigia = new IntersectionObserver(
    (entradas) => {
      for (const { target, isIntersecting } of entradas) {
        porNome.get(target.dataset.aparelho).visivel = isIntersecting;
      }
      iniciar();
    },
    { rootMargin: '120px 0px' }
  );

  for (const aparelho of aparelhos) {
    medidor.observe(aparelho.el);
    vigia.observe(aparelho.el);
  }

  function quadro(agora) {
    const segundos = ultimo ? Math.min(0.1, (agora - ultimo) / 1000) : 0;
    ultimo = agora;
    const t = agora / 1000;
    let algumVisivel = false;
    for (const aparelho of aparelhos) {
      if (!aparelho.visivel) continue;
      algumVisivel = true;
      const segue = aparelho.segueOPonteiro ? 1 : 0;
      const alvo = {
        rx: aparelho.pose.rx - ponteiro.y * 8 * segue + Math.sin(t / 1.7) * 1.4,
        ry: aparelho.pose.ry + ponteiro.x * 14 * segue + Math.sin(t / 2.4) * 2.6,
        rz: aparelho.pose.rz + Math.sin(t / 3.1) * 0.5,
      };
      for (const eixo of ['rx', 'ry', 'rz']) {
        aparelho.atual[eixo] = amortecer(aparelho.atual[eixo], alvo[eixo], segundos, RIGIDEZ);
      }
      aplicar(aparelho);
    }
    if (algumVisivel) {
      requestAnimationFrame(quadro);
    } else {
      rodando = false;
      ultimo = 0;
    }
  }

  function iniciar() {
    if (reduzido || rodando) return;
    rodando = true;
    requestAnimationFrame(quadro);
  }

  if (!reduzido) {
    addEventListener(
      'pointermove',
      (evento) => {
        if (evento.pointerType !== 'mouse') return;
        ponteiro.x = (evento.clientX / innerWidth) * 2 - 1;
        ponteiro.y = (evento.clientY / innerHeight) * 2 - 1;
      },
      { passive: true }
    );
  }

  return {
    pose(nome, pose, { imediato = false } = {}) {
      const aparelho = porNome.get(nome);
      if (!aparelho) return;
      Object.assign(aparelho.pose, pose);
      if (reduzido || imediato) {
        Object.assign(aparelho.atual, aparelho.pose);
        aplicar(aparelho);
      }
    },
  };
}
