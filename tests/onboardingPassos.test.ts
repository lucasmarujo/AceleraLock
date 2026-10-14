import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  HORAS_ATALHOS,
  HORAS_MAX,
  HORAS_MIN,
  filtrarApps,
  horasDaProporcao,
  horasDoToque,
  legendaDaConclusao,
  normalizarNome,
  passoInicial,
  permissoesFaltando,
  progressoDoPasso,
  proporcaoDasHoras,
  proporcaoDoToque,
  rotuloDoBloqueio,
  textoOfertaRestrito,
  tituloDaConclusao,
  tituloPermissoesFaltando,
} from '../src/components/Onboarding/passos';

test('progressoDoPasso: primeira execucao conta de 1 a 5', () => {
  assert.deepEqual(progressoDoPasso(1, 1), { atual: 1, total: 5 });
  assert.deepEqual(progressoDoPasso(5, 1), { atual: 5, total: 5 });
});

test('regressao: reentrada pela secao 3 conta o proprio caminho, nao comeca em 3 de 5', () => {
  assert.deepEqual(progressoDoPasso(3, 3), { atual: 1, total: 3 });
  assert.deepEqual(progressoDoPasso(5, 3), { atual: 3, total: 3 });
});

test('HORAS_ATALHOS ficam dentro da faixa do slider', () => {
  for (const horas of HORAS_ATALHOS) {
    assert.ok(horas >= HORAS_MIN && horas <= HORAS_MAX);
  }
});

test('tituloDaConclusao diz o que foi bloqueado', () => {
  assert.equal(tituloDaConclusao(['Instagram']), 'Instagram bloqueado.');
  assert.equal(tituloDaConclusao(['Instagram', 'TikTok']), '2 apps bloqueados.');
  assert.equal(tituloDaConclusao([]), 'Bloqueio criado.');
});

test('primeira execucao comeca na secao 1 (nome)', () => {
  assert.equal(passoInicial(false), 1);
});

test('reentrada por permissao revogada comeca na secao 3, sem repetir o pedido de nome', () => {
  assert.equal(passoInicial(true), 3);
});

test('horasDoToque: as duas pontas da trilha dao os extremos do intervalo', () => {
  assert.equal(horasDoToque(0, 300), HORAS_MIN);
  assert.equal(horasDoToque(300, 300), HORAS_MAX);
});

test('horasDoToque: arrastar pra fora da trilha satura, nao extrapola', () => {
  assert.equal(horasDoToque(-120, 300), HORAS_MIN);
  assert.equal(horasDoToque(9999, 300), HORAS_MAX);
});

test('horasDoToque: o meio da trilha cai no meio do intervalo', () => {
  // 1..12 tem 11 passos; metade da trilha e 1 + 5.5 = 6.5, que arredonda pra 7.
  assert.equal(horasDoToque(150, 300), 7);
});

test('horasDoToque: largura zero (medida antes do layout) nao vira NaN', () => {
  assert.equal(horasDoToque(50, 0), HORAS_MIN);
});

test('proporcaoDasHoras e o inverso de horasDoToque nas pontas', () => {
  assert.equal(proporcaoDasHoras(HORAS_MIN), 0);
  assert.equal(proporcaoDasHoras(HORAS_MAX), 1);
});

test('normalizarNome: so espaco em branco nao e nome', () => {
  assert.equal(normalizarNome(''), null);
  assert.equal(normalizarNome('   '), null);
  assert.equal(normalizarNome('  Lucas  '), 'Lucas');
});

test('filtrarApps ignora acento e caixa — "video" acha "Vídeo"', () => {
  const apps = [{ label: 'Vídeo Player' }, { label: 'Instagram' }];
  assert.deepEqual(filtrarApps(apps, 'video'), [{ label: 'Vídeo Player' }]);
  assert.deepEqual(filtrarApps(apps, 'INSTA'), [{ label: 'Instagram' }]);
});

test('filtrarApps: termo vazio devolve a lista inteira, sem match devolve vazio', () => {
  const apps = [{ label: 'Instagram' }, { label: 'TikTok' }];
  assert.deepEqual(filtrarApps(apps, '   '), apps);
  assert.deepEqual(filtrarApps(apps, 'zzz'), []);
});

test('proporcaoDoToque e continua — e o que faz o thumb seguir o dedo em vez de pular', () => {
  // Duas posicoes dentro do MESMO degrau de hora tem que dar proporcoes
  // diferentes. Se derivassem da hora arredondada, seriam iguais, e o thumb
  // so teria 12 paradas possiveis.
  const a = proporcaoDoToque(151, 300);
  const b = proporcaoDoToque(158, 300);
  assert.notEqual(a, b);
  assert.equal(horasDaProporcao(a), horasDaProporcao(b));
});

test('proporcaoDoToque clampa e sobrevive a largura zero', () => {
  assert.equal(proporcaoDoToque(-50, 300), 0);
  assert.equal(proporcaoDoToque(9999, 300), 1);
  assert.equal(proporcaoDoToque(50, 0), 0);
});

test('horasDaProporcao cobre o intervalo inteiro nas duas pontas', () => {
  assert.equal(horasDaProporcao(0), HORAS_MIN);
  assert.equal(horasDaProporcao(1), HORAS_MAX);
  assert.equal(horasDaProporcao(-1), HORAS_MIN);
  assert.equal(horasDaProporcao(2), HORAS_MAX);
});

test('proporcaoDasHoras e horasDaProporcao sao inversos em todo degrau', () => {
  // E o que garante que o assentamento ao soltar o dedo para exatamente onde
  // o numero exibido diz que parou.
  for (let hora = HORAS_MIN; hora <= HORAS_MAX; hora++) {
    assert.equal(horasDaProporcao(proporcaoDasHoras(hora)), hora, `hora ${hora}`);
  }
});

test('permissoesFaltando: lista so o que falta, na ordem do checklist', () => {
  assert.deepEqual(permissoesFaltando({ usageAccess: true, overlay: false }), ['overlay']);
  assert.deepEqual(permissoesFaltando({ usageAccess: false, overlay: true }), ['usageAccess']);
  assert.deepEqual(permissoesFaltando({ usageAccess: true, overlay: true }), []);
});

test('barreira: sem sonda nativa as duas permissoes contam como faltando', () => {
  assert.deepEqual(permissoesFaltando(null), ['usageAccess', 'overlay']);
});

test('tituloPermissoesFaltando: singular e plural', () => {
  assert.equal(tituloPermissoesFaltando(1), 'Falta 1 permissão para bloquear');
  assert.equal(tituloPermissoesFaltando(2), 'Faltam 2 permissões para bloquear');
});

test('rotuloDoBloqueio diz quantos apps o toque bloqueia', () => {
  assert.equal(rotuloDoBloqueio(0), 'Bloquear');
  assert.equal(rotuloDoBloqueio(1), 'Bloquear 1 app');
  assert.equal(rotuloDoBloqueio(3), 'Bloquear 3 apps');
});

test('legendaDaConclusao conta os outros apps alem do mostrado', () => {
  assert.equal(legendaDaConclusao(1), 'A partir de agora');
  assert.equal(legendaDaConclusao(2), 'E mais 1 app, a partir de agora');
  assert.equal(legendaDaConclusao(4), 'E mais 3 apps, a partir de agora');
});

test('textoOfertaRestrito nomeia o app escolhido e a espera configurada', () => {
  assert.equal(
    textoOfertaRestrito(['Instagram'], 30),
    'Sem ele, você tira o Instagram da lista na hora. Com ele, mudar a lista pede 30 min de espera — tempo para a vontade passar.'
  );
});

test('textoOfertaRestrito: varios apps viram "um app", e a espera vem da politica', () => {
  assert.match(textoOfertaRestrito(['Instagram', 'TikTok'], 45), /tira um app da lista/);
  assert.match(textoOfertaRestrito([], 45), /pede 45 min de espera/);
});
