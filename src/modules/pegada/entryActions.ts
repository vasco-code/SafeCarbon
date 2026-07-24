import { supabase } from "@/lib/supabase";
import type { ActivityData, Computed, Scope, SourceCategory } from "./engine/types";
import { SCOPE_OF_SOURCE } from "./engine/types";

// Insert sem .select() + recarrega (evita o bug de RETURNING pós-insert quando
// a visibilidade depende da linha recém-criada; padrão do InventarioPage).
export async function addEntry(
  inventoryId: string,
  data: ActivityData,
  computed: Computed,
  opts: { sourceRef?: string; description?: string },
): Promise<{ error: string | null }> {
  const scope: Scope = SCOPE_OF_SOURCE[data.source_category];
  const { source_category, ...activity } = data;
  const { error } = await supabase.from("ghg_activity_entries").insert({
    inventory_id: inventoryId,
    scope,
    source_category,
    source_ref: opts.sourceRef ?? null,
    description: opts.description ?? null,
    activity_data: activity as Record<string, unknown>,
    computed: computed as unknown as Record<string, unknown>,
  });
  return { error: error?.message ?? null };
}

export async function deleteEntry(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("ghg_activity_entries").delete().eq("id", id);
  return { error: error?.message ?? null };
}

export interface Entry {
  id: string;
  source_category: SourceCategory;
  source_ref: string | null;
  description: string | null;
  activity_data: Record<string, unknown>;
  computed: Computed;
}
