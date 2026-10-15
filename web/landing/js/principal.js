import { criarAparelhos } from './aparelho.js';
import { FRASES, sortearFrase } from './frases.js';
import { iniciarHistoria } from './historia.js';
import { expoOut, faixa, mistura, palavrasAcesas, suave } from './movimento.js';

const reduzido = matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Um `scroll` so para a pagina inteira, resolvido uma vez por quadro. */
function criarRolagem() {
  const tarefas = [];
  let pedido = 0;
  const rodar = () => {
    pedido = 0;
    for (const tarefa of tarefas) tarefa();
  };
  const agendar = () => {
    if (!pedido) pedido = requestAnimationFrame(rodar);
  };
  addEventListener('scroll', agendar, { passive: true });
  addEventListener('resize', agendar, { passive: true });
  return (tarefa) => {
    tarefas.push(tarefa);
    agendar();
  };
}

function quandoPerto(el, aoMudar) {
  new IntersectionObserver(([entrada]) => aoMudar(entrada.isIntersecting), {
    rootMargin: '200px 0px',
  }).observe(el);
}

function iniciarTopo(registrarRolagem) {
  const topo = document.querySelector('[data-topo]');
  registrarRolagem(() => topo.toggleAttribute('data-rolado', scrollY > 16));
}

function iniciarRevelacoes() {
  const vigia = new IntersectionObserver(
    (entradas) => {
      for (const { target, isIntersecting } of entradas) {
        if (!isIntersecting) continue;
        target.classList.add('visivel');
        vigia.unobserve(target);
      }
    },
    { rootMargin: '0px 0px -12% 0px' }
  );
  document.querySelectorAll('[data-revelar]').forEach((el) => vigia.observe(el));
}

function separarPalavras(raiz) {
  const palavras = [];
  const percorrer = (no) => {
    for (const filho of [...no.childNodes]) {
      if (filho.nodeType !== Node.TEXT_NODE) {
        percorrer(filho);
        continue;
      }
      const pedacos = document.createDocumentFragment();
      for (const parte of filho.textContent.split(/(\s+)/)) {
        if (!parte) continue;
        if (/^\s+$/.test(parte)) {
          pedacos.append(' ');
          continue;
        }
        const palavra = document.createElement('span');
        palavra.className = 'p';
        palavra.textContent = parte;
        palavras.push(palavra);
        pedacos.append(palavra);
      }
      filho.replaceWith(pedacos);
    }
  };
  percorrer(raiz);
  return palavras;
}

function iniciarManifesto(registrarRolagem) {
  const texto = document.querySelector('[data-manifesto]');
  const secao = texto.closest('.manifesto');
  const palavras = separarPalavras(texto);
  if (reduzido) {
    palavras.forEach((palavra) => palavra.classList.add('acesa'));
    return;
  }
  let perto = false;
  let acesas = -1;
  quandoPerto(secao, (valor) => {
    perto = valor;
  });
  registrarRolagem(() => {
    if (!perto) return;
    const caixa = secao.getBoundingClientRect();
    const percorrido = faixa(-caixa.top, 0, caixa.height - innerHeight);
    const total = palavrasAcesas(faixa(percorrido, 0.04, 0.72), palavras.length);
    if (total === acesas) return;
    acesas = total;
    palavras.forEach((palavra, i) => palavra.classList.toggle('acesa', i < total));
  });
}

function iniciarVideo(registrarRolagem) {
  const moldura = document.querySelector('[data-video]');
  const video = moldura.querySelector('[data-video-elemento]');
  const play = moldura.querySelector('[data-video-play]');
  const rotulo = moldura.querySelector('[data-video-rotulo]');
  const erro = moldura.querySelector('[data-video-erro]');

  const indisponivel = () => {
    play.hidden = true;
    video.controls = false;
    erro.hidden = false;
  };
  video.querySelector('source').addEventListener('error', indisponivel);
  video.addEventListener('error', indisponivel);

  play.addEventListener('click', () => {
    play.hidden = true;
    video.controls = true;
    video.play().catch(() => {
      if (!erro.hidden) return;
      play.hidden = false;
      video.controls = false;
    });
  });

  video.addEventListener('ended', () => {
    video.controls = false;
    rotulo.textContent = 'Assistir de novo';
    play.hidden = false;
  });

  let perto = false;
  quandoPerto(moldura, (valor) => {
    perto = valor;
    if (!valor && !video.paused) video.pause();
  });

  if (reduzido) return;
  registrarRolagem(() => {
    if (!perto) return;
    const topo = moldura.getBoundingClientRect().top;
    const p = expoOut(faixa(innerHeight - topo, 0, innerHeight * 0.8));
    moldura.style.setProperty('--p', p.toFixed(3));
  });
}

function iniciarFraseDoBento() {
  const frase = document.querySelector('[data-frase-bento]');
  const botao = document.querySelector('[data-sortear]');
  if (!frase || !botao) return;
  let atual = frase.textContent.trim();
  botao.addEventListener('click', () => {
    atual = sortearFrase(FRASES, atual);
    if (reduzido) {
      frase.textContent = atual;
      return;
    }
    frase.classList.add('trocando');
    setTimeout(() => {
      frase.textContent = atual;
      frase.classList.remove('trocando');
    }, 260);
  });
}

/**
 * Heroi: o celular sobe e endireita conforme a pagina desce. Chamada final: ele
 * chega de costas e vira de frente — a logo do AceleraLock e a primeira coisa que
 * aparece, as boas-vindas do app a ultima.
 */
function iniciarPoses(aparelhos, registrarRolagem) {
  const chamada = document.querySelector('.chamada');
  aparelhos.pose('heroi', { rx: 6, ry: -18, rz: 0 }, { imediato: true });
  aparelhos.pose('chamada', { rx: 4, ry: reduzido ? 16 : 164, rz: 0 }, { imediato: true });
  if (reduzido) return;
  registrarRolagem(() => {
    const p = faixa(scrollY, 0, innerHeight);
    aparelhos.pose('heroi', { rx: mistura(6, 20, p), ry: mistura(-18, -6, p) });
    const topo = chamada.getBoundingClientRect().top;
    const virada = suave(faixa(innerHeight - topo, innerHeight * 0.1, innerHeight * 0.95));
    aparelhos.pose('chamada', { ry: mistura(164, 16, virada) });
  });
}

const registrarRolagem = criarRolagem();
const aparelhos = criarAparelhos({ reduzido });

iniciarTopo(registrarRolagem);
iniciarRevelacoes();
iniciarManifesto(registrarRolagem);
iniciarPoses(aparelhos, registrarRolagem);
iniciarHistoria({ reduzido, aparelhos, registrarRolagem });
iniciarVideo(registrarRolagem);
iniciarFraseDoBento();
