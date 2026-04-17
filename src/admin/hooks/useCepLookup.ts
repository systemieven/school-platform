/**
 * useCepLookup — hook para busca de endereço via ViaCEP
 *
 * Chama a API pública viacep.com.br sem necessidade de chave de API.
 * Reutilizável em qualquer formulário de endereço (fornecedores,
 * company_fiscal_config, company_nfse_config, guardian_profiles, etc.).
 *
 * Usage:
 *   const { loading, lookup } = useCepLookup();
 *   const addr = await lookup('01001000');
 *   if (addr) { setForm(f => ({ ...f, ...addr })); }
 */

import { useState } from 'react';

export interface CepAddress {
  logradouro: string;
  bairro: string;
  municipio: string;
  uf: string;
  codigo_municipio_ibge: string;
  cep: string;
}

interface ViaCepResponse {
  erro?: boolean;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  ibge?: string;
  cep?: string;
}

export function useCepLookup() {
  const [loading, setLoading] = useState(false);

  async function lookup(rawCep: string): Promise<CepAddress | null> {
    const digits = rawCep.replace(/\D/g, '');
    if (digits.length !== 8) return null;

    setLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      if (!res.ok) return null;
      const data: ViaCepResponse = await res.json();
      if (data.erro) return null;

      return {
        cep: digits,
        logradouro: data.logradouro ?? '',
        bairro: data.bairro ?? '',
        municipio: data.localidade ?? '',
        uf: data.uf ?? '',
        codigo_municipio_ibge: data.ibge ?? '',
      };
    } catch {
      return null;
    } finally {
      setLoading(false);
    }
  }

  return { loading, lookup };
}
