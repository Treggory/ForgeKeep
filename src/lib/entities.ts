// Config-driven CRUD. One definition per inventory category powers the list
// pages, the add/edit forms, and the export. Keeping it here means the five
// categories can never drift out of sync with each other.

export type FieldType =
  | "text"
  | "number"
  | "textarea"
  | "lookup"      // <select> populated from the `lookups` table
  | "relation"    // <select> populated from another table (id + label column)
  | "static";     // <select> with a fixed option list

export type Field = {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  lookup?: string;                                   // lookups.category
  relation?: { table: string; labelColumn: string }; // relation source
  options?: string[];                                // static options
  placeholder?: string;
  step?: string;                                     // number step
};

export type Entity = {
  key: string;        // URL slug
  table: string;      // db table
  singular: string;
  plural: string;
  icon: string;       // emoji glyph for nav/cards (kept text-only, no image deps)
  selectQuery: string;
  title: (row: any) => string;
  subtitle: (row: any) => string;
  badge?: (row: any) => { text: string; tone: "jade" | "amber" | "muted" } | null;
  fields: Field[];
};

const yesno = "yes_no_unknown";

export const ENTITIES: Record<string, Entity> = {
  miniatures: {
    key: "miniatures",
    table: "miniature_units",
    singular: "Miniature unit",
    plural: "Miniatures",
    icon: "🪖",
    selectQuery: "*, faction:factions(name), project:projects(name)",
    title: (r) => r.unit_name,
    subtitle: (r) =>
      [r.faction?.name, `${r.quantity} model${r.quantity === 1 ? "" : "s"}`]
        .filter(Boolean)
        .join(" · "),
    badge: (r) =>
      r.paint_status ? { text: r.paint_status, tone: "muted" } : null,
    fields: [
      { name: "unit_name", label: "Unit name", type: "text", required: true },
      { name: "faction_id", label: "Faction", type: "relation", relation: { table: "factions", labelColumn: "name" } },
      { name: "quantity", label: "Quantity", type: "number", required: true, step: "1" },
      { name: "material", label: "Material", type: "text" },
      { name: "paint_status", label: "Paint status", type: "lookup", lookup: "paint_status" },
      { name: "assembly_status", label: "Assembly status", type: "lookup", lookup: "assembly_status" },
      { name: "basing_status", label: "Basing status", type: "text" },
      { name: "repairs_needed", label: "Repairs needed", type: "text" },
      { name: "tabletop_ready", label: "Tabletop ready", type: "lookup", lookup: yesno },
      { name: "priority", label: "Priority", type: "lookup", lookup: "priority" },
      { name: "project_id", label: "Project", type: "relation", relation: { table: "projects", labelColumn: "name" } },
      { name: "storage_location_id", label: "Storage location", type: "relation", relation: { table: "storage_locations", labelColumn: "name" } },
      { name: "qty_assembled", label: "# assembled", type: "number", step: "1" },
      { name: "qty_painted", label: "# painted", type: "number", step: "1" },
      { name: "qty_based", label: "# based", type: "number", step: "1" },
      { name: "qty_completed", label: "# completed", type: "number", step: "1" },
      { name: "estimated_value", label: "Estimated value", type: "number", step: "0.01" },
      { name: "barcode", label: "Barcode / UPC", type: "text" },
      { name: "notes", label: "Notes / loadout", type: "textarea" },
    ],
  },

  paints: {
    key: "paints",
    table: "paints",
    singular: "Paint",
    plural: "Paints",
    icon: "🎨",
    selectQuery: "*",
    title: (r) => `${r.brand} — ${r.color_name}`,
    subtitle: (r) =>
      [r.line, r.paint_type, `x${r.quantity}`].filter(Boolean).join(" · "),
    badge: (r) =>
      r.needs_replacement === "Yes" || r.needs_replacement === "Partial"
        ? { text: "Replace", tone: "amber" }
        : null,
    fields: [
      { name: "category", label: "Category", type: "static", options: ["Paint", "Medium"] },
      { name: "brand", label: "Brand", type: "text", required: true },
      { name: "line", label: "Line", type: "text" },
      { name: "color_name", label: "Color / product", type: "text", required: true },
      { name: "quantity", label: "Quantity", type: "number", required: true, step: "1" },
      { name: "paint_type", label: "Paint type", type: "lookup", lookup: "paint_type" },
      { name: "condition", label: "Condition", type: "lookup", lookup: "condition" },
      { name: "opened", label: "Opened?", type: "lookup", lookup: yesno },
      { name: "needs_replacement", label: "Needs replacement?", type: "lookup", lookup: yesno },
      { name: "barcode", label: "Barcode / UPC", type: "text" },
      { name: "storage_location_id", label: "Storage location", type: "relation", relation: { table: "storage_locations", labelColumn: "name" } },
      { name: "notes", label: "Notes", type: "textarea" },
    ],
  },

  brushes: {
    key: "brushes",
    table: "brushes",
    singular: "Brush",
    plural: "Brushes",
    icon: "🖌️",
    selectQuery: "*",
    title: (r) => [r.manufacturer, r.series].filter(Boolean).join(" "),
    subtitle: (r) => [r.size, `x${r.quantity}`].filter(Boolean).join(" · "),
    badge: (r) => (r.condition ? { text: r.condition, tone: "muted" } : null),
    fields: [
      { name: "manufacturer", label: "Manufacturer", type: "text", required: true },
      { name: "series", label: "Series / type", type: "text" },
      { name: "size", label: "Size", type: "text" },
      { name: "brush_type", label: "Brush type", type: "text" },
      { name: "material", label: "Hair / material", type: "text" },
      { name: "quantity", label: "Quantity", type: "number", required: true, step: "1" },
      { name: "condition", label: "Condition", type: "lookup", lookup: "condition" },
      { name: "purpose", label: "Primary use", type: "text" },
      { name: "notes", label: "Notes", type: "textarea" },
    ],
  },

  tools: {
    key: "tools",
    table: "tools",
    singular: "Tool",
    plural: "Tools",
    icon: "🛠️",
    selectQuery: "*",
    title: (r) => r.item,
    subtitle: (r) => [r.category, `x${r.quantity}`].filter(Boolean).join(" · "),
    badge: (r) => (r.condition ? { text: r.condition, tone: "muted" } : null),
    fields: [
      { name: "category", label: "Category", type: "text" },
      { name: "item", label: "Item", type: "text", required: true },
      { name: "barcode", label: "Barcode / UPC", type: "text" },
      { name: "quantity", label: "Quantity", type: "number", required: true, step: "1" },
      { name: "condition", label: "Condition", type: "lookup", lookup: "condition" },
      { name: "storage_location_id", label: "Storage location", type: "relation", relation: { table: "storage_locations", labelColumn: "name" } },
      { name: "notes", label: "Notes", type: "textarea" },
    ],
  },

  terrain: {
    key: "terrain",
    table: "terrain",
    singular: "Terrain set",
    plural: "Terrain",
    icon: "🏚️",
    selectQuery: "*",
    title: (r) => r.terrain_set,
    subtitle: (r) =>
      [r.components, r.quantity_label || (r.quantity ? `x${r.quantity}` : null)]
        .filter(Boolean)
        .join(" · "),
    badge: (r) => (r.paint_status ? { text: r.paint_status, tone: "muted" } : null),
    fields: [
      { name: "terrain_set", label: "Terrain set", type: "text", required: true },
      { name: "barcode", label: "Barcode / UPC", type: "text" },
      { name: "components", label: "Components", type: "text" },
      { name: "quantity", label: "Quantity (number)", type: "number", step: "1" },
      { name: "quantity_label", label: "Quantity (label, e.g. Multiple)", type: "text" },
      { name: "paint_status", label: "Paint status", type: "lookup", lookup: "paint_status" },
      { name: "repairs_needed", label: "Repairs needed", type: "text" },
      { name: "storage_location_id", label: "Storage location", type: "relation", relation: { table: "storage_locations", labelColumn: "name" } },
      { name: "notes", label: "Notes", type: "textarea" },
    ],
  },
};

export const ENTITY_LIST = Object.values(ENTITIES);
export function getEntity(key: string): Entity | undefined {
  return ENTITIES[key];
}
