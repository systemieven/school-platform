// Cópia Deno de `src/lib/cpf.ts`. Manter sincronizado.
// Edge functions não podem importar de `src/`, então há duplicata intencional.

export function cleanCpf(v: string): string {
  return (v ?? "").replace(/\D/g, "");
}

export function validateCpf(v: string): boolean {
  const d = cleanCpf(v);
  if (d.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(d)) return false;
  const digits = d.split("").map((c) => Number.parseInt(c, 10));
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
