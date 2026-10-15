/**
 * Recorte das mil frases que a tela de bloqueio sorteia
 * (`native/.../res/values/arrays.xml`). Copia e nao leitura porque a pagina nao tem
 * build; `tests/landing.test.ts` garante que cada uma existe, letra por letra, no
 * arquivo do app — a landing nunca mostra frase que o app nao mostraria.
 */
export const FRASES = [
  'Cada minuto fora dessa tela é um minuto seu de novo.',
  'Você acabou de devolver a próxima hora pra você.',
  'Um dia comporta muita coisa quando o scroll sai do meio.',
  'O tempo não volta, mas ainda dá pra escolher onde ele vai.',
  'Uma hora concentrada rende mais que quatro horas picadas.',
  'Aquilo que você vem adiando cabe exatamente nesse intervalo.',
  'Você tirou o pé do acelerador. O dia desacelera junto.',
  'Guardar tempo é a única forma de ter tempo.',
  'Você está mais perto do que estava ontem.',
  'O melhor da sua cabeça aparece depois do vigésimo minuto.',
  'Levante e ande até a cozinha. É o bastante.',
  'Você acabou de reforçar o caminho novo.',
];

/**
 * Como o app, uma frase nova a cada tentativa — e nunca a mesma de agora ha pouco,
 * que leria como tela travada.
 */
export function sortearFrase(frases, anterior, aleatorio = Math.random) {
  const candidatas = frases.length > 1 ? frases.filter((frase) => frase !== anterior) : frases;
  const indice = Math.min(candidatas.length - 1, Math.floor(aleatorio() * candidatas.length));
  return candidatas[indice];
}
