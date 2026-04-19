/**
 * Utilitários de CPF — máscara, normalização e validação de dígito verificador.
 *
 * Algoritmo oficial da Receita Federal:
 *   - 11 dígitos (os 2 últimos são dígitos verificadores mod 11).
 *   - Todos os dígitos iguais (000.000.000-00, 111.111.111-11, …) são inválidos
 *     apesar de passarem no checksum — rejeitados explicitamente.
 *
 * Arquivo duplicado (propositalmente) em `supabase/functions/_shared/cpf.ts`
 * porque o edge function roda Deno e não pode importar de `src/`.
 */

/** Remove tudo que não é dígito. */
export function cleanCpf(v: string): string {
  return (v ?? '').replace(/\D/g, '');
}

/** Aplica máscara "000.000.000-00" progressivamente enquanto o usuário digita. */
export function maskCpf(v: string): string {
  const d = cleanCpf(v).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

/**
 * Valida CPF por checksum. Recebe com ou sem máscara.
 * Retorna false para strings vazias, com tamanho diferente de 11, dígitos
 * repetidos ou checksum inválido.
 */
export function validateCpf(v: string): boolean {
  const d = cleanCpf(v);
  if (d.length !== 11) return false;
  // Rejeita sequências iguais (caso clássico que passa no checksum).
  if (/^(\d)\1{10}$/.test(d)) return false;

  const digits = d.split('').map((c) => Number.parseInt(c, 10));
  const calc = (sliceLen: number): number => {
    let sum = 0;
    for (let i = 0; i < sliceLen; i++) {
      sum += digits[i] * (sliceLen + 1 - i);
    }
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return calc(9) === digits[9] && calc(10) === digits[10];
}
