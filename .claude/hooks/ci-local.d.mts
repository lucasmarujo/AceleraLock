// Tipos das funcoes puras do hook, so pra o `tsc --noEmit` enxergar o import
// de tests/hookCiLocal.test.ts. O hook em si e .mjs porque roda sem build.

export type EscopoDeSuite = 'js' | 'kotlin' | null;

export declare function classificarCaminho(caminhoRelativo: string): EscopoDeSuite;
export declare function ehComandoDeEntrega(comando: string): boolean;
export declare function ehArtefatoDePrebuild(caminhoRelativo: string): boolean;
