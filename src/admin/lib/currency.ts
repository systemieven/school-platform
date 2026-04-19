/**
 * Utilitários de formatação BRL para inputs mascarados.
 *
 * Regra: o estado guarda `number` em reais (ex.: 1500.5); a UI exibe
 * "R$ 1.500,50". Durante a digitação, cada tecla extrai os dígitos, divide
 * por 100 e reformata — efeito de máscara sem caret jumping.
 */
const brl = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatBRL(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '';
  return brl.format(value);
}

/** Extrai só dígitos da string e converte em reais (divide por 100). */
export function digitsToReais(input: string): number | null {
  const only = input.replace(/\D/g, '');
  if (!only) return null;
  return Number(only) / 100;
}
