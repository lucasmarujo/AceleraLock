#!/usr/bin/env node
// CI local do AceleraLock — o mesmo conjunto que .github/workflows/ci.yml roda,
// so que antes do push em vez de depois.
//
// Tres momentos num arquivo so porque os tres compartilham o mesmo estado e o
// mesmo resolvedor de toolchain; separa-los duplicaria isso:
//   --pos-edicao   PostToolUse  · formata o arquivo tocado e marca o escopo
//   --stop         Stop         · roda o que ficou pendente, exit 2 se vermelho
//   --guarda-git   PreToolUse   · nega commit/push enquanto nao estiver verde
//   --verificar    manual       · forca o ciclo inteiro (ver /verificar)

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const ARQUIVO_ESTADO = path.join(RAIZ, '.claude', '.estado-ci.json');
const MODULO = 'native/modules/aceleralock-blocker';
const EH_WINDOWS = process.platform === 'win32';

// Tres rodadas vermelhas e o hook desiste em vez de girar. Se a correcao nao
// veio em tres, ela nao vem na quarta — vem de quem esta lendo.
const MAX_TENTATIVAS = 3;

const ESTADO_LIMPO = {
  pendente: { js: false, kotlin: false },
  ultimoResultado: null,
  falha: null,
  detalhe: null,
  tentativas: 0,
};

// ---------------------------------------------------------------- classificacao

const EXTENSOES_JS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json']);

// Pastas que nao entram em suite nenhuma: geradas por prebuild, arquivadas, ou
// prosa. Tocar nelas nao justifica pagar o ciclo de verificacao.
const FORA_DE_SUITE = [
  'android/',
  'ios/',
  '.claude/',
  '.expo/',
  '.github/',
  'docs/',
  'assets/',
  'assets.old/',
  'backend.bkp/',
  'web/',
];

function normalizar(caminho) {
  return String(caminho ?? '')
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/^\/+/, '');
}

/**
 * Decide qual suite um arquivo tocado obriga a rodar.
 * A distincao que mais importa: `native/.../android/` e fonte legitima sem
 * teste automatizado (decisao do projeto, AGENTS.md §2), enquanto `/android/`
 * da raiz e gerado por `expo prebuild` e some no proximo.
 */
export function classificarCaminho(caminhoRelativo) {
  const p = normalizar(caminhoRelativo);
  if (!p) return null;

  // Caminho que sobe do repositorio nao pertence a suite nenhuma. Sem isto, um
  // arquivo editado fora do projeto cai no ramo generico e marca escopo
  // pendente, cobrando um ciclo que nao verifica nada dele.
  if (p === '..' || p.startsWith('../')) return null;

  if (p.startsWith(MODULO + '/')) {
    const dentro = p.slice(MODULO.length + 1);
    // So o core/ tem suite (JUnit 5 em JVM pura). Os adaptadores android/ e a
    // reimplementacao Swift em ios/ nao tem teste — rodar gradle por causa
    // deles seria ciclo pago sem nada verificado.
    if (dentro.startsWith('core/')) {
      return /\.kts?$/.test(dentro) ? 'kotlin' : null;
    }
    if (dentro.startsWith('android/') || dentro.startsWith('ios/')) return null;
    return EXTENSOES_JS.has(path.posix.extname(dentro)) ? 'js' : null;
  }

  if (FORA_DE_SUITE.some((pasta) => p.startsWith(pasta))) return null;

  return EXTENSOES_JS.has(path.posix.extname(p)) ? 'js' : null;
}

// Pastas geradas por `expo prebuild` na RAIZ. Editar ali some no proximo
// prebuild (AGENTS.md §8.3). Note que `native/.../android/` NAO entra: aquilo e
// fonte do modulo, nao artefato — e a regra de permissao do harness nao
// consegue exprimir essa diferenca, porque `android/**` casa os dois.
const GERADAS_NA_RAIZ = ['android/', 'ios/', '.expo/'];

/** Decide se um caminho e artefato de prebuild, onde edicao manual se perde. */
export function ehArtefatoDePrebuild(caminhoRelativo) {
  const p = normalizar(caminhoRelativo);
  return GERADAS_NA_RAIZ.some((pasta) => p === pasta.slice(0, -1) || p.startsWith(pasta));
}

/**
 * Detecta `git commit` / `git push` em qualquer posicao da linha — encadeado
 * (`cd x && git commit`), com flag global (`git -C . push`) ou cru.
 * Deliberadamente frouxo: um falso positivo custa um aviso, um falso negativo
 * custa um CI vermelho ja publicado.
 */
export function ehComandoDeEntrega(comando) {
  return /(^|[\s;&|(])git\b[^;&|]*\b(commit|push)\b/.test(String(comando ?? ''));
}

// ---------------------------------------------------------------------- estado

function lerEstado() {
  try {
    const bruto = JSON.parse(readFileSync(ARQUIVO_ESTADO, 'utf8'));
    return { ...ESTADO_LIMPO, ...bruto, pendente: { ...ESTADO_LIMPO.pendente, ...bruto.pendente } };
  } catch {
    return structuredClone(ESTADO_LIMPO);
  }
}

function gravarEstado(estado) {
  mkdirSync(path.dirname(ARQUIVO_ESTADO), { recursive: true });
  writeFileSync(ARQUIVO_ESTADO, JSON.stringify(estado, null, 2) + '\n');
}

function lerEntrada() {
  try {
    return JSON.parse(readFileSync(0, 'utf8') || '{}');
  } catch {
    return {};
  }
}

// ------------------------------------------------------------------- execucao

function rodar(partes, env = {}) {
  const linha = partes.map((p) => (/[\s"]/.test(p) ? '"' + p + '"' : p)).join(' ');
  return spawnSync(linha, {
    cwd: RAIZ,
    encoding: 'utf8',
    shell: true,
    env: { ...process.env, ...env },
    maxBuffer: 32 * 1024 * 1024,
  });
}

function recortar(resultado, linhas = 60) {
  const saida = ((resultado.stdout ?? '') + (resultado.stderr ?? '')).trimEnd().split('\n');
  return saida.length > linhas ? saida.slice(-linhas).join('\n') : saida.join('\n');
}

// ------------------------------------------------------------------ toolchain

// Nao ha `gradlew` no modulo e o `gradle` costuma faltar no PATH: a
// distribuicao que o wrapper ja baixou e a unica garantida. Maior versao vence.
function acharGradle() {
  const dists = path.join(homedir(), '.gradle', 'wrapper', 'dists');
  const candidatos = [];
  const listar = (dir) => {
    try {
      return readdirSync(dir);
    } catch {
      return [];
    }
  };
  for (const dist of listar(dists)) {
    for (const hash of listar(path.join(dists, dist))) {
      for (const versao of listar(path.join(dists, dist, hash))) {
        const bin = path.join(
          dists,
          dist,
          hash,
          versao,
          'bin',
          EH_WINDOWS ? 'gradle.bat' : 'gradle'
        );
        if (existsSync(bin)) candidatos.push(bin);
      }
    }
  }
  return candidatos.sort().pop() ?? null;
}

// O core e jvmToolchain(17) e o CI usa Temurin 17. JAVA_HOME nesta maquina
// costuma apontar pro JBR do Android Studio — apontar explicito evita depender
// da auto-deteccao do Gradle.
function acharJdk17() {
  const bases = [
    'C:\\Program Files\\Eclipse Adoptium',
    'C:\\Program Files\\Java',
    '/usr/lib/jvm',
    '/Library/Java/JavaVirtualMachines',
  ];
  for (const base of bases) {
    try {
      const achado = readdirSync(base).find((nome) => /jdk-?17/.test(nome));
      if (achado) return path.join(base, achado);
    } catch {
      /* base inexistente nesta maquina */
    }
  }
  return null;
}

// ---------------------------------------------------------------------- ciclo

// Passos separados e na mesma ordem do CI. O motivo esta comentado no proprio
// ci.yml: encadeados num script so, o primeiro erro esconde os outros tres.
const PASSOS_JS = [
  ['formatacao', ['npm', 'run', 'format:check'], 'npm run format'],
  ['lint', ['npm', 'run', 'lint'], 'npm run lint'],
  ['typecheck', ['npm', 'run', 'typecheck'], 'npm run typecheck'],
  ['testes', ['npm', 'test'], 'npm test'],
];

function rodarCiclo(escopos) {
  const avisos = [];

  if (escopos.js) {
    for (const [nome, comando, remedio] of PASSOS_JS) {
      const r = rodar(comando);
      if (r.status !== 0) return { falha: nome, detalhe: recortar(r), remedio, avisos };
    }
  }

  if (escopos.kotlin) {
    const gradle = acharGradle();
    if (!gradle) {
      avisos.push(
        'core (Kotlin) NAO verificado: nenhum gradle no PATH nem em ~/.gradle/wrapper/dists.'
      );
    } else {
      const jdk = acharJdk17();
      const r = rodar(
        [gradle, '-p', MODULO, ':core:test', '--console=plain', '--no-daemon'],
        jdk ? { JAVA_HOME: jdk } : {}
      );
      if (r.status !== 0) {
        return {
          falha: 'core (Kotlin)',
          detalhe: recortar(r, 80),
          remedio: path.basename(gradle) + ' -p ' + MODULO + ' :core:test',
          avisos,
        };
      }
    }
  }

  return { falha: null, avisos };
}

function rotulo(escopos) {
  return [escopos.js && 'JS', escopos.kotlin && 'core (Kotlin)'].filter(Boolean).join(' + ');
}

// ---------------------------------------------------------------------- modos

function posEdicao(entrada) {
  const arquivo = entrada?.tool_input?.file_path ?? entrada?.tool_input?.notebook_path;
  if (!arquivo) return 0;

  const relativo = normalizar(path.relative(RAIZ, path.resolve(RAIZ, arquivo)));
  const escopo = classificarCaminho(relativo);

  // Formata so o arquivo tocado. O proprio Prettier respeita o
  // .prettierignore, entao *.md e as pastas geradas passam batido sem regra
  // extra aqui — e --ignore-unknown evita erro em extensao que ele nao trata.
  if (escopo === 'js') {
    rodar([
      process.execPath,
      path.join(RAIZ, 'node_modules', 'prettier', 'bin', 'prettier.cjs'),
      '--write',
      '--ignore-unknown',
      relativo,
    ]);
  }

  if (escopo) {
    const estado = lerEstado();
    estado.pendente[escopo] = true;
    gravarEstado(estado);
  }

  return 0;
}

function stop() {
  const estado = lerEstado();

  // Sessao que so leu codigo nao paga ciclo de verificacao.
  if (!estado.pendente.js && !estado.pendente.kotlin) return 0;

  if (estado.tentativas >= MAX_TENTATIVAS) {
    gravarEstado({ ...estado, tentativas: 0 });
    console.log(
      'CI local: ' +
        MAX_TENTATIVAS +
        ' tentativas e ainda vermelho em `' +
        estado.falha +
        '`. Parando pra nao entrar em loop — resolva a mao e rode /verificar.'
    );
    return 0;
  }

  const escopos = { ...estado.pendente };
  const { falha, detalhe, remedio, avisos } = rodarCiclo(escopos);

  if (!falha) {
    gravarEstado({ ...ESTADO_LIMPO, ultimoResultado: 'verde' });
    console.log(
      ['CI local verde (' + rotulo(escopos) + ') — o mesmo conjunto que o CI roda.', ...avisos].join(
        '\n'
      )
    );
    return 0;
  }

  const tentativas = estado.tentativas + 1;
  gravarEstado({ ...estado, ultimoResultado: 'vermelho', falha, detalhe, tentativas });

  process.stderr.write(
    [
      'CI local VERMELHO em `' +
        falha +
        '` (tentativa ' +
        tentativas +
        ' de ' +
        MAX_TENTATIVAS +
        ').',
      'Este e o mesmo conjunto que o CI roda — do jeito que esta, o push quebra.',
      '',
      detalhe,
      '',
      'Corrija a causa (`' + remedio + '` reproduz o passo) e o ciclo roda de novo ao parar.',
      ...avisos,
    ].join('\n')
  );
  return 2;
}

function guardaArquivo(entrada) {
  const arquivo = entrada?.tool_input?.file_path ?? entrada?.tool_input?.notebook_path;
  if (!arquivo) return 0;

  const relativo = normalizar(path.relative(RAIZ, path.resolve(RAIZ, arquivo)));
  if (!ehArtefatoDePrebuild(relativo)) return 0;

  console.log(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason:
          '`' +
          relativo +
          '` e gerado por `expo prebuild` e a edicao some no proximo. Customizacao nativa vive em native/plugins/withAceleralockBlocker.js. (A fonte do modulo, em native/modules/aceleralock-blocker/android/, essa sim pode ser editada.)',
      },
    })
  );
  return 0;
}

function guardaGit(entrada) {
  if (!ehComandoDeEntrega(entrada?.tool_input?.command)) return 0;

  const estado = lerEstado();
  const pendente = estado.pendente.js || estado.pendente.kotlin;
  if (!pendente && estado.ultimoResultado !== 'vermelho') return 0;

  const razao = pendente
    ? 'Ha edicao nao verificada (' +
      rotulo(estado.pendente) +
      ') nesta sessao. Rode /verificar antes de entregar — commitar agora e publicar sem saber se o CI passa.'
    : 'O ultimo ciclo ficou vermelho em `' +
      estado.falha +
      '`. Corrija e rode /verificar; do jeito que esta, o CI quebra depois do push.';

  console.log(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: razao,
      },
    })
  );
  return 0;
}

function verificar() {
  const escopos = { js: true, kotlin: true };
  const { falha, detalhe, remedio, avisos } = rodarCiclo(escopos);

  if (!falha) {
    gravarEstado({ ...ESTADO_LIMPO, ultimoResultado: 'verde' });
    console.log(['VERDE — ' + rotulo(escopos) + '.', ...avisos].join('\n'));
    return 0;
  }

  gravarEstado({ ...lerEstado(), ultimoResultado: 'vermelho', falha, detalhe });
  console.log(
    [
      'VERMELHO em `' + falha + '`.',
      '',
      detalhe,
      '',
      'Reproduz com: ' + remedio,
      ...avisos,
    ].join('\n')
  );
  return 1;
}

// `testLogging { events("failed") }` e proposital no core: build verde nao
// imprime contagem nenhuma. O numero real so existe no XML do JUnit — por isso
// os docs do projeto vivem com contagens defasadas.
function contar() {
  const totalJs = readdirSync(path.join(RAIZ, 'tests'))
    .filter((nome) => nome.endsWith('.test.ts'))
    .reduce((soma, nome) => {
      const fonte = readFileSync(path.join(RAIZ, 'tests', nome), 'utf8');
      return soma + (fonte.match(/^\s*test\(/gm) ?? []).length;
    }, 0);

  const gradle = acharGradle();
  if (gradle) {
    const jdk = acharJdk17();
    rodar(
      [gradle, '-p', MODULO, ':core:test', '--console=plain', '--no-daemon'],
      jdk ? { JAVA_HOME: jdk } : {}
    );
  }

  const dirXml = path.join(RAIZ, MODULO, 'core', 'build', 'test-results', 'test');
  let totalKotlin = 0;
  let falhasKotlin = 0;
  let lidos = 0;
  try {
    for (const nome of readdirSync(dirXml).filter((n) => n.endsWith('.xml'))) {
      const xml = readFileSync(path.join(dirXml, nome), 'utf8');
      const suite = xml.match(/<testsuite\b[^>]*>/)?.[0] ?? '';
      const attr = (chave) => Number(suite.match(new RegExp(chave + '="(\\d+)"'))?.[1] ?? 0);
      totalKotlin += attr('tests');
      falhasKotlin += attr('failures') + attr('errors');
      lidos += 1;
    }
  } catch {
    /* build/ ausente: o gradle nao rodou */
  }

  console.log(
    [
      'JS    (tests/*.test.ts)  ' + totalJs,
      lidos
        ? 'Kotlin (core, do XML)    ' + totalKotlin + (falhasKotlin ? '  FALHAS: ' + falhasKotlin : '')
        : 'Kotlin (core)            nao contado — ' +
          (gradle ? 'sem XML em ' + path.relative(RAIZ, dirXml) : 'gradle nao encontrado'),
      'TOTAL                    ' + (totalJs + totalKotlin),
    ].join('\n')
  );
  return 0;
}

// ----------------------------------------------------------------------- main

const MODOS = {
  '--pos-edicao': posEdicao,
  '--stop': stop,
  '--guarda-git': guardaGit,
  '--guarda-arquivo': guardaArquivo,
  '--verificar': verificar,
  '--contar': contar,
};

const modo = process.argv[2];
const MODOS_MANUAIS = new Set(['--verificar', '--contar']);

if (modo in MODOS) {
  process.exit(MODOS[modo](MODOS_MANUAIS.has(modo) ? {} : lerEntrada()));
} else if (modo) {
  process.stderr.write('Modo desconhecido: ' + modo + '. Use ' + Object.keys(MODOS).join(' | ') + '\n');
  process.exit(1);
}
