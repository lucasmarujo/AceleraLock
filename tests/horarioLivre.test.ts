import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  MAX_FAIXAS,
  agruparPorApp,
  ajustarMinuto,
  atravessaMeiaNoite,
  avisoDoHorario,
  descreverDias,
  descreverFaixa,
  faixaInicial,
  formatarHora,
  legendaComHorarios,
  mesmasFaixas,
  validarFaixa,
  validarFaixas,
} from '../src/components/Bloqueios/horarioLivre';

const almoco = { days: [1, 2, 3, 4, 5], start: 720, end: 780 };

test('formatarHora: HH:MM com zero a esquerda', () => {
  assert.equal(formatarHora(0), '00:00');
  assert.equal(formatarHora(495), '08:15');
  assert.equal(formatarHora(1439), '23:59');
});

test('ajustarMinuto: anda de 15 em 15 e da a volta na meia-noite', () => {
  assert.equal(ajustarMinuto(720, 1), 735);
  assert.equal(ajustarMinuto(720, -2), 690);
  assert.equal(ajustarMinuto(1425, 1), 0);
  assert.equal(ajustarMinuto(0, -1), 1425);
});

test('descreverDias: semana inteira, dias uteis, fim de semana e intervalos', () => {
  assert.equal(descreverDias([1, 2, 3, 4, 5, 6, 7]), 'Todos os dias');
  assert.equal(descreverDias([5, 1, 2, 3, 4]), 'Seg a sex');
  assert.equal(descreverDias([6, 7]), 'Sáb e dom');
  assert.equal(descreverDias([2, 3, 4]), 'Ter a qui');
  assert.equal(descreverDias([1, 3, 5]), 'Seg, qua e sex');
  assert.equal(descreverDias([5]), 'Sex');
});

test('regressao: dia repetido ou fora de 1..7 nao entra na descricao', () => {
  assert.equal(descreverDias([1, 1, 2, 3, 9]), 'Seg a qua');
  assert.equal(descreverDias([]), 'Nenhum dia');
});

test('descreverFaixa: diz quando a faixa termina no dia seguinte', () => {
  assert.equal(descreverFaixa(almoco), 'Seg a sex · 12:00–13:00');
  assert.equal(
    descreverFaixa({ days: [5], start: 22 * 60, end: 2 * 60 }),
    'Sex · 22:00–02:00 do dia seguinte'
  );
  assert.equal(atravessaMeiaNoite({ days: [5], start: 1320, end: 120 }), true);
  assert.equal(atravessaMeiaNoite(almoco), false);
});

test('legendaComHorarios: singular, plural e nada sem horario', () => {
  assert.equal(legendaComHorarios(0), null);
  assert.equal(legendaComHorarios(1), '1 horário livre');
  assert.equal(legendaComHorarios(3), '3 horários livres');
});

test('validarFaixa: sem dia, inicio igual ao fim e horario fora do dia sao recusados', () => {
  assert.equal(validarFaixa(almoco), null);
  assert.equal(validarFaixa({ ...almoco, days: [] }), 'Escolha pelo menos um dia.');
  assert.equal(validarFaixa({ ...almoco, end: 720 }), 'O início e o fim não podem ser iguais.');
  assert.equal(validarFaixa({ ...almoco, end: 1440 }), 'Horário inválido.');
  assert.equal(validarFaixa({ ...almoco, days: [8] }), 'Dia da semana inválido.');
});

test('validarFaixas: teto por app igual ao do core', () => {
  const muitas = Array.from({ length: MAX_FAIXAS + 1 }, (_, i) => ({
    days: [1],
    start: i * 60,
    end: i * 60 + 30,
  }));
  assert.equal(validarFaixas(muitas), `No máximo ${MAX_FAIXAS} horários livres por app.`);
  assert.equal(validarFaixas(muitas.slice(0, MAX_FAIXAS)), null);
});

test('faixaInicial: o formulario ja abre com uma faixa valida', () => {
  assert.equal(validarFaixa(faixaInicial()), null);
});

test('mesmasFaixas: ordem dos dias nao conta, horario conta', () => {
  assert.equal(mesmasFaixas([almoco], [{ ...almoco, days: [5, 4, 3, 2, 1] }]), true);
  assert.equal(mesmasFaixas([almoco], [{ ...almoco, end: 795 }]), false);
  assert.equal(mesmasFaixas([almoco], []), false);
});

test('agruparPorApp: lista achatada do nativo vira mapa por app', () => {
  const porApp = agruparPorApp([
    { packageName: 'a', ...almoco },
    { packageName: 'b', days: [6], start: 600, end: 660 },
    { packageName: 'a', days: [7], start: 60, end: 120 },
  ]);
  assert.equal(porApp.get('a')?.length, 2);
  assert.deepEqual(porApp.get('b'), [{ days: [6], start: 600, end: 660 }]);
});

test('barreira: modo restrito pausa os horarios livres, e nao ha o que abrir nas configuracoes', () => {
  const aviso = avisoDoHorario({ restricted: true, automaticTime: true, automaticZone: true });
  assert.equal(aviso?.titulo, 'Horários livres pausados');
  assert.equal(aviso?.podeAbrirConfiguracoes, false);
});

test('barreira: hora ou fuso manual pede para ligar o automatico', () => {
  for (const estado of [
    { restricted: false, automaticTime: false, automaticZone: true },
    { restricted: false, automaticTime: true, automaticZone: false },
  ]) {
    const aviso = avisoDoHorario(estado);
    assert.equal(aviso?.titulo, 'Ligue data e hora automáticas');
    assert.equal(aviso?.podeAbrirConfiguracoes, true);
  }
});

test('feliz: com tudo automatico e sem modo restrito nao ha aviso', () => {
  assert.equal(
    avisoDoHorario({ restricted: false, automaticTime: true, automaticZone: true }),
    null
  );
});
