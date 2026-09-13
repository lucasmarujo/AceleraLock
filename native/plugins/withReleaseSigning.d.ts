// Tipos da funcao pura do plugin, so pra o `tsc --noEmit` enxergar o import de
// tests/releaseSigning.test.ts. O plugin em si e CommonJS porque o prebuild o
// carrega com require.

export declare function aplicarAssinaturaRelease(conteudo: string): string;
