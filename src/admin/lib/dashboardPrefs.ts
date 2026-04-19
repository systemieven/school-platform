/**
 * dashboardPrefs — resolução de preferências do dashboard.
 *
 * O dashboard tem três fontes de verdade que determinam visibilidade
 * e ordem dos widgets, com a seguinte prioridade (maior → menor):
 *
 *   1. Pref do USUÁRIO (`dashboard_widget_user_prefs`)
 *      — escrito via aba "Minha visão" do drawer; só o dono lê/escreve.
 *
 *   2. Pref GLOBAL do módulo (`dashboard_widget_prefs`)
 *      — "padrão da escola" definido por admin; vale para quem nunca
 *        personalizou.
 *
 *   3. Default do REGISTRY
 *      — `is_visible = true` + `position = registry.order`.
 *
 * `mergePrefs()` é uma função pura → reaproveitável nos demais
 * dashboards (Financeiro, Acadêmico) e fácil de testar.
 */

export interface PrefLike {
  registry_widget_id: string;
  is_visible: boolean;
  position: number;
}

export interface EffectivePref {
  is_visible: boolean;
  position: number;
  /** De onde veio o valor efetivo. Útil pra UI/telemetria. */
  source: 'user' | 'global' | 'default';
}

export interface RegistryEntry {
  id: string;
  /** Ordem default no registry (usada como fallback final). */
  order: number;
}

/**
 * Para cada widget do registry, devolve a pref efetiva usando a regra
 * user > global > default.
 */
export function mergePrefs(
  registry: RegistryEntry[],
  globalPrefs: PrefLike[],
  userPrefs: PrefLike[],
): Record<string, EffectivePref> {
  const byUser = new Map(userPrefs.map((p) => [p.registry_widget_id, p]));
  const byGlobal = new Map(globalPrefs.map((p) => [p.registry_widget_id, p]));

  const out: Record<string, EffectivePref> = {};
  for (const w of registry) {
    const u = byUser.get(w.id);
    if (u) {
      out[w.id] = { is_visible: u.is_visible, position: u.position, source: 'user' };
      continue;
    }
    const g = byGlobal.get(w.id);
    if (g) {
      out[w.id] = { is_visible: g.is_visible, position: g.position, source: 'global' };
      continue;
    }
    out[w.id] = { is_visible: true, position: w.order, source: 'default' };
  }
  return out;
}
