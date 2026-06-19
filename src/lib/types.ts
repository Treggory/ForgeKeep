// Loose row shapes — enough for the UI without generated DB types.
export type Row = Record<string, any>;

export type SearchResult = {
  item_type: "paint" | "miniature" | "brush" | "tool" | "terrain";
  id: string;
  title: string;
  subtitle: string | null;
  owned_qty: number;
  already_owned: boolean;
  needs_replacement: boolean;
  rank: number;
};

export type CollectionStats = {
  unit_count: number;
  total_models: number;
  models_painted: number;
  models_unpainted: number;
  models_needing_repair: number;
  models_tabletop_ready: number;
  estimated_value: number;
};
