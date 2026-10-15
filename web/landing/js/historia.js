import {
  descreverEntradas,
  duracao,
  faltam,
  fracaoDecorrida,
  hora,
  legendaComHorarios,
  relogio,
  tituloDaBarra,
} from './formatos.js';
import { FRASES, sortearFrase } from './frases.js';
import { expoOut, faixa, progressoNoPasso, suave } from './movimento.js';

/** Pose do celular em cada passo: alterna o lado, como os cortes do video. */
const POSES = {
  bloqueios: { rx: 4, ry: -16, rz: 0 },
  caminho: { rx: 3, ry: 14, rz: 0 },
  espera: { rx: 5, ry: -12, rz: 0 },
  horarios: { rx: 3, ry: 14, rz: 0 },
  tempo: { rx: 6, ry: -14, rz: 0 },
};

/** Ms entre o dedo aparecer e o "aperto" — o pico do `toque-dedo` no CSS. */
const APERTO = 380;

const ESPERA_TOTAL = 30 * 60;
const ESPERA_RESTANTE = 18 * 60 + 24;
const ANEL = 2 * Math.PI * 88;
const MINUTOS_HOJE = 3 * 60 + 53;

/** Sequencia com hora marcada que da pra parar no meio — o "video" de cada cena. */
function roteiro(passos, ciclo) {
  let relogios = [];
  const parar = () => {
    relogios.forEach(clearTimeout);
    relogios = [];
  };
  const iniciar = () => {
    parar();
    for (const [ms, acao] of passos) relogios.push(setTimeout(acao, ms));
    if (ciclo) relogios.push(setTimeout(iniciar, ciclo));
  };
  return { iniciar, parar };
}

/** Centro de `alvo` em pixels da tela do celular (390 x 844), sem as transformacoes 3D. */
function centroNaCena(alvo, cena) {
  let x = alvo.offsetWidth / 2;
  let y = alvo.offsetHeight / 2;
  for (let el = alvo; el && el !== cena; el = el.offsetParent) {
    x += el.offsetLeft;
    y += el.offsetTop;
  }
  return { x, y };
}

function tocar(toque, alvo, cena) {
  const { x, y } = centroNaCena(alvo, cena);
  toque.style.transform = `translate(${x}px, ${y}px)`;
  toque.classList.remove('tocando');
  void toque.offsetWidth;
  toque.classList.add('tocando');
}

function legendar(linha, texto, salvo) {
  const legenda = linha.querySelector('[data-legenda]');
  legenda.textContent = texto;
  legenda.classList.toggle('salvo', salvo);
}

function deixarBloqueado(app) {
  for (const linha of app.querySelectorAll('[data-app]')) {
    linha.classList.add('ligado');
    legendar(linha, 'Bloqueado', true);
  }
  app.querySelector('[data-lista]').classList.add('separada');
  app.querySelector('[data-contagem]').textContent = String(
    app.querySelectorAll('[data-app]').length
  );
}

function cenaBloqueios(cena, { reduzido }) {
  const app = cena.querySelector('[data-tela-bloqueios]');
  const lista = app.querySelector('[data-lista]');
  const contagem = app.querySelector('[data-contagem]');
  const barra = app.querySelector('[data-barra-salvar]');
  const titulo = barra.querySelector('[data-barra-titulo]');
  const sub = barra.querySelector('[data-barra-sub]');
  const salvar = barra.querySelector('[data-salvar]');
  const toque = cena.querySelector('[data-toque]');
  const linhas = [...app.querySelectorAll('[data-app]')];
  const marcados = [];

  function reiniciar() {
    marcados.length = 0;
    for (const linha of linhas) {
      linha.classList.remove('ligado');
      legendar(linha, '', false);
    }
    lista.classList.remove('separada');
    barra.classList.remove('visivel', 'sucesso');
    contagem.textContent = '0';
  }

  function marcar(linha) {
    linha.classList.add('ligado');
    marcados.push(linha.dataset.app);
    legendar(linha, 'Bloqueia ao salvar', false);
    titulo.textContent = tituloDaBarra(marcados.length);
    sub.textContent = descreverEntradas(marcados);
    barra.classList.add('visivel');
  }

  function gravar() {
    barra.classList.add('sucesso');
    deixarBloqueado(app);
  }

  const passos = [[0, reiniciar]];
  linhas.forEach((linha, i) => {
    const t = 900 + i * 760;
    passos.push([t, () => tocar(toque, linha.querySelector('[data-interruptor]'), cena)]);
    passos.push([t + APERTO, () => marcar(linha)]);
  });
  passos.push(
    [3500, () => tocar(toque, salvar, cena)],
    [3500 + APERTO, gravar],
    [5600, () => barra.classList.remove('visivel')]
  );
  const filme = roteiro(passos, 9200);

  return {
    entrar() {
      if (reduzido) {
        reiniciar();
        deixarBloqueado(app);
      } else {
        filme.iniciar();
      }
    },
    sair: filme.parar,
  };
}

function cenaCaminho(cena, { reduzido, anunciar }) {
  const app = cena.querySelector('.app-android');
  const icone = cena.querySelector('[data-abrir] .icone-app');
  const abrindo = cena.querySelector('[data-abrindo]');
  const fechar = cena.querySelector('[data-fechar]');
  const frase = cena.querySelector('[data-frase]');
  const toque = cena.querySelector('[data-toque]');
  let atual = frase.textContent;

  const { x, y } = centroNaCena(icone, cena);
  const meio = icone.offsetWidth / 2;
  abrindo.style.setProperty('--icone-topo', `${y - meio}px`);
  abrindo.style.setProperty('--icone-esquerda', `${x - meio}px`);
  abrindo.style.setProperty('--icone-direita', `${cena.offsetWidth - x - meio}px`);
  abrindo.style.setProperty('--icone-base', `${cena.offsetHeight - y - meio}px`);

  function inicio() {
    app.classList.remove('abrindo', 'bloqueado');
  }

  function abrir() {
    atual = sortearFrase(FRASES, atual);
    frase.textContent = atual;
    app.classList.add('abrindo');
  }

  function bloquear() {
    app.classList.add('bloqueado');
    anunciar(`Instagram está bloqueado. ${atual}`);
  }

  const filme = roteiro(
    [
      [0, inicio],
      [900, () => tocar(toque, icone, cena)],
      [900 + APERTO, abrir],
      [900 + APERTO + 460, bloquear],
      [5000, () => tocar(toque, fechar, cena)],
      [5000 + APERTO, inicio],
    ],
    7400
  );

  let retomada = 0;

  function tentar() {
    filme.parar();
    clearTimeout(retomada);
    if (reduzido) {
      abrir();
      bloquear();
      return;
    }
    inicio();
    requestAnimationFrame(() => {
      abrir();
      retomada = setTimeout(() => {
        bloquear();
        retomada = setTimeout(() => {
          inicio();
          retomada = setTimeout(filme.iniciar, 1600);
        }, 4200);
      }, 460);
    });
  }

  icone.closest('[data-abrir]').addEventListener('click', tentar);

  return {
    entrar() {
      if (reduzido) {
        abrir();
        bloquear();
      } else {
        filme.iniciar();
      }
    },
    sair() {
      filme.parar();
      clearTimeout(retomada);
    },
    tentar,
  };
}

function cenaEspera(cena, { reduzido }) {
  const numero = cena.querySelector('[data-relogio]');
  const rotulo = cena.querySelector('[data-faltam]');
  const arco = cena.querySelector('[data-arco]');
  let restantes = ESPERA_RESTANTE;
  let intervalo = 0;
  let quadro = 0;

  function desenhar(segundos) {
    numero.textContent = relogio(segundos);
    rotulo.textContent = `${faltam(segundos)} de 30 min`;
    const fracao = fracaoDecorrida(segundos, ESPERA_TOTAL);
    arco.setAttribute('stroke-dasharray', `${(ANEL * fracao).toFixed(1)} ${ANEL.toFixed(1)}`);
  }

  function correrRelogio() {
    intervalo = setInterval(() => {
      restantes = restantes > 1 ? restantes - 1 : ESPERA_RESTANTE;
      desenhar(restantes);
    }, 1000);
  }

  function parar() {
    clearInterval(intervalo);
    cancelAnimationFrame(quadro);
  }

  return {
    entrar() {
      parar();
      restantes = ESPERA_RESTANTE;
      if (reduzido) {
        desenhar(restantes);
        correrRelogio();
        return;
      }
      const inicio = performance.now();
      const passo = (agora) => {
        const t = Math.min(1, (agora - inicio) / 1700);
        desenhar(ESPERA_TOTAL + (ESPERA_RESTANTE - ESPERA_TOTAL) * suave(t));
        if (t < 1) {
          quadro = requestAnimationFrame(passo);
        } else {
          correrRelogio();
        }
      };
      quadro = requestAnimationFrame(passo);
    },
    sair: parar,
  };
}

function cenaHorarios(cena, { reduzido, bloqueios }) {
  const base = cena.querySelector('[data-base-horarios]');
  const app = bloqueios.cloneNode(true);
  app.removeAttribute('data-tela-bloqueios');
  app.querySelector('[data-barra-salvar]').remove();
  deixarBloqueado(app);
  base.append(app);

  const instagram = app.querySelector('[data-app="Instagram"]');
  const dias = [...cena.querySelectorAll('[data-dia]')];
  const ate = cena.querySelector('[data-ate]');
  const mais = cena.querySelector('[data-mais]');
  const adicionar = cena.querySelector('[data-adicionar]');
  const toque = cena.querySelector('[data-toque]');
  let minutoAte = 12 * 60 + 30;

  function reiniciar() {
    cena.classList.remove('folha-aberta', 'adicionado');
    dias.forEach((dia) => dia.classList.remove('marcado'));
    minutoAte = 12 * 60 + 30;
    ate.textContent = hora(minutoAte);
    legendar(instagram, 'Bloqueado', true);
  }

  function somarQuinze() {
    minutoAte += 15;
    ate.textContent = hora(minutoAte);
    mais.classList.add('apertado');
    setTimeout(() => mais.classList.remove('apertado'), 160);
  }

  function concluir() {
    cena.classList.add('adicionado');
  }

  function fechar() {
    cena.classList.remove('folha-aberta');
    legendar(instagram, legendaComHorarios(1), true);
  }

  const passos = [
    [0, reiniciar],
    [500, () => cena.classList.add('folha-aberta')],
  ];
  dias.forEach((dia, i) => {
    const t = 1500 + i * 340;
    passos.push(
      [t, () => tocar(toque, dia, cena)],
      [t + APERTO, () => dia.classList.add('marcado')]
    );
  });
  for (const t of [3500, 4150]) {
    passos.push([t, () => tocar(toque, mais, cena)], [t + APERTO, somarQuinze]);
  }
  passos.push(
    [5000, () => tocar(toque, adicionar, cena)],
    [5000 + APERTO, concluir],
    [6900, fechar]
  );
  const filme = roteiro(passos, 10400);

  return {
    entrar() {
      if (reduzido) {
        reiniciar();
        dias.forEach((dia) => dia.classList.add('marcado'));
        minutoAte = 13 * 60;
        ate.textContent = hora(minutoAte);
        cena.classList.add('folha-aberta', 'adicionado');
      } else {
        filme.iniciar();
      }
    },
    sair: filme.parar,
  };
}

function cenaTempo(cena, { reduzido, inicio }) {
  const app = inicio.cloneNode(true);
  app.removeAttribute('data-tela-inicio');
  cena.append(app);

  const rolagem = app.querySelector('[data-rolagem]');
  const hoje = app.querySelector('[data-hoje]');
  const selo = app.querySelector('[data-selo]');
  const estimativa = app.querySelector('[data-estimativa]');
  const barras = [...app.querySelectorAll('[data-barra]')];
  const rotulos = [...app.querySelectorAll('[data-dia-rotulo]')];
  const usos = [...app.querySelectorAll('[data-uso]')];

  function progresso(p) {
    hoje.textContent = duracao(Math.round(MINUTOS_HOJE * expoOut(faixa(p, 0.02, 0.36))) * 60);
    barras.forEach((barra, i) => {
      const valor = expoOut(faixa(p, 0.04 + i * 0.035, 0.26 + i * 0.035));
      barra.style.transform = `scaleY(${valor.toFixed(3)})`;
      rotulos[i].style.opacity = valor.toFixed(3);
    });
    estimativa.style.transform = `scaleX(${suave(faixa(p, 0.18, 0.4)).toFixed(3)})`;
    const s = expoOut(faixa(p, 0.36, 0.46));
    selo.style.opacity = s.toFixed(3);
    selo.style.transform = `translateY(${((1 - s) * 8).toFixed(1)}px) scale(${(0.94 + s * 0.06).toFixed(3)})`;
    const maximo = Math.max(0, rolagem.offsetHeight - app.clientHeight);
    rolagem.style.transform = `translate3d(0, ${(-maximo * suave(faixa(p, 0.5, 0.86))).toFixed(1)}px, 0)`;
    usos.forEach((uso, i) => {
      uso.style.transform = `scaleX(${expoOut(faixa(p, 0.66 + i * 0.05, 0.84 + i * 0.05)).toFixed(3)})`;
    });
  }

  return {
    entrar() {
      if (reduzido) progresso(0.46);
    },
    sair() {},
    progresso: reduzido ? () => {} : progresso,
  };
}

/**
 * A secao "Como funciona": o celular fica parado na tela enquanto os passos rolam
 * ao lado (ou por baixo, no celular). O passo que cruza o meio da janela escolhe a
 * cena; o quanto ele ja cruzou alimenta a cena que anda com a rolagem.
 */
export function iniciarHistoria({ reduzido, aparelhos, registrarRolagem }) {
  const secao = document.querySelector('.historia');
  if (!secao) return;
  const tela = secao.querySelector('.tela');
  const anuncio = secao.querySelector('[data-frase-anunciada]');
  const passos = [...secao.querySelectorAll('[data-passo]')];
  const preenchimentos = [...secao.querySelectorAll('[data-progresso] i')];
  const elementos = new Map(
    [...tela.querySelectorAll('[data-cena]')].map((el) => [el.dataset.cena, el])
  );
  const estreito = matchMedia('(max-width: 979px)');

  const opcoes = {
    reduzido,
    anunciar: (texto) => {
      if (anuncio) anuncio.textContent = texto;
    },
  };
  const cenas = {
    horarios: cenaHorarios(elementos.get('horarios'), {
      ...opcoes,
      bloqueios: tela.querySelector('[data-tela-bloqueios]'),
    }),
    bloqueios: cenaBloqueios(elementos.get('bloqueios'), opcoes),
    caminho: cenaCaminho(elementos.get('caminho'), opcoes),
    espera: cenaEspera(elementos.get('espera'), opcoes),
    tempo: cenaTempo(elementos.get('tempo'), {
      ...opcoes,
      inicio: document.querySelector('[data-tela-inicio]'),
    }),
  };

  let ativo = [...elementos].find(([, el]) => el.classList.contains('ativa'))[0];
  let visivel = false;

  function pose(nome) {
    const { rx, ry, rz } = POSES[nome];
    return { rx, ry: estreito.matches ? ry * 0.45 : ry, rz };
  }

  function marcarPasso(nome) {
    for (const passo of passos) passo.classList.toggle('ativo', passo.dataset.passo === nome);
    secao.dataset.tom = passos.find((passo) => passo.dataset.passo === nome).dataset.tom;
  }

  function ativar(nome) {
    if (nome === ativo) return;
    const anterior = ativo;
    ativo = nome;
    marcarPasso(nome);
    cenas[anterior].sair();
    elementos.get(anterior).classList.remove('ativa');
    const el = elementos.get(nome);
    if (!reduzido) {
      el.classList.add('entrando');
      void el.offsetWidth;
      el.classList.remove('entrando');
    }
    el.classList.add('ativa');
    if (visivel) cenas[nome].entrar();
    aparelhos.pose('historia', pose(nome));
  }

  function atualizar() {
    if (!visivel) return;
    const meio = innerHeight / 2;
    const progressos = passos.map((passo, i) => {
      const caixa = passo.getBoundingClientRect();
      const p = progressoNoPasso(caixa.top, caixa.height, innerHeight);
      preenchimentos[i].style.transform = `scaleY(${p.toFixed(3)})`;
      if (caixa.top <= meio && caixa.bottom > meio) ativar(passo.dataset.passo);
      return p;
    });
    const indice = passos.findIndex((passo) => passo.dataset.passo === ativo);
    cenas[ativo].progresso?.(progressos[indice]);
  }

  marcarPasso(ativo);
  aparelhos.pose('historia', pose(ativo), { imediato: true });
  registrarRolagem(atualizar);

  new IntersectionObserver(([entrada]) => {
    visivel = entrada.isIntersecting;
    if (visivel) {
      cenas[ativo].entrar();
      atualizar();
    } else {
      cenas[ativo].sair();
    }
  }).observe(secao);

  secao.querySelector('[data-tentar]')?.addEventListener('click', () => {
    ativar('caminho');
    cenas.caminho.tentar();
  });
}
