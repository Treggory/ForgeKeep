"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getEntity, type Field } from "@/lib/entities";

type Options = Record<string, { value: string; label: string }[]>;

export default function EntityForm({
  categoryKey,
  initial,
}: {
  categoryKey: string;
  initial?: Record<string, any> | null;
}) {
  const router = useRouter();
  const supabase = createClient();
  const entity = getEntity(categoryKey)!;
  const isEdit = !!initial?.id;

  const [values, setValues] = useState<Record<string, any>>(() => {
    const base: Record<string, any> = {};
    for (const f of entity.fields) base[f.name] = initial?.[f.name] ?? "";
    return base;
  });
  const [options, setOptions] = useState<Options>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load <select> options for lookup + relation fields.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next: Options = {};
      const lookupCats = Array.from(
        new Set(
          entity.fields.filter((f) => f.type === "lookup").map((f) => f.lookup!)
        )
      );
      if (lookupCats.length) {
        const { data } = await supabase
          .from("lookups")
          .select("category,value,sort_order")
          .in("category", lookupCats)
          .eq("active", true)
          .order("sort_order");
        for (const cat of lookupCats) {
          next[cat] = (data ?? [])
            .filter((d: any) => d.category === cat)
            .map((d: any) => ({ value: d.value, label: d.value }));
        }
      }
      for (const f of entity.fields) {
        if (f.type === "relation" && f.relation) {
          const { data } = await supabase
            .from(f.relation.table)
            .select(`id, ${f.relation.labelColumn}`)
            .order(f.relation.labelColumn);
          next[f.name] = (data ?? []).map((d: any) => ({
            value: d.id,
            label: d[f.relation!.labelColumn],
          }));
        }
      }
      if (!cancelled) setOptions(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [entity, supabase]);

  function setField(name: string, v: any) {
    setValues((prev) => ({ ...prev, [name]: v }));
  }

  function coerce(f: Field, raw: any) {
    if (raw === "" || raw === undefined || raw === null) {
      return f.type === "number" && f.required ? 0 : null;
    }
    if (f.type === "number") {
      const n = Number(raw);
      return Number.isNaN(n) ? null : n;
    }
    return raw;
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in.");

      const payload: Record<string, any> = {};
      for (const f of entity.fields) payload[f.name] = coerce(f, values[f.name]);

      let res;
      if (isEdit) {
        res = await supabase
          .from(entity.table)
          .update(payload)
          .eq("id", initial!.id);
      } else {
        payload.owner_id = user.id;
        res = await supabase.from(entity.table).insert(payload);
      }
      if (res.error) throw res.error;
      router.push(`/inventory/${entity.key}`);
      router.refresh();
    } catch (e: any) {
      setError(e.message ?? "Something went wrong.");
      setBusy(false);
    }
  }

  async function remove() {
    if (!isEdit) return;
    if (!confirm(`Delete this ${entity.singular.toLowerCase()}? This cannot be undone.`))
      return;
    setBusy(true);
    setError(null);
    const { error } = await supabase
      .from(entity.table)
      .delete()
      .eq("id", initial!.id);
    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }
    router.push(`/inventory/${entity.key}`);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {error ? (
        <div className="card border-rust/50 bg-rust/10 p-3 text-sm text-rust">
          {error}
        </div>
      ) : null}

      <div className="space-y-3">
        {entity.fields.map((f) => (
          <FieldInput
            key={f.name}
            field={f}
            value={values[f.name]}
            options={
              f.type === "lookup"
                ? options[f.lookup!]
                : f.type === "relation"
                ? options[f.name]
                : undefined
            }
            onChange={(v) => setField(f.name, v)}
          />
        ))}
      </div>

      <div className="sticky bottom-20 flex gap-3">
        <button
          onClick={save}
          disabled={busy}
          className="flex-1 rounded-lg bg-jade px-4 py-3 font-semibold text-gun disabled:opacity-50"
        >
          {busy ? "Saving…" : isEdit ? "Save changes" : `Add ${entity.singular.toLowerCase()}`}
        </button>
        {isEdit ? (
          <button
            onClick={remove}
            disabled={busy}
            className="rounded-lg border border-rust/60 px-4 py-3 text-rust disabled:opacity-50"
          >
            Delete
          </button>
        ) : null}
      </div>
    </div>
  );
}

function FieldInput({
  field,
  value,
  options,
  onChange,
}: {
  field: Field;
  value: any;
  options?: { value: string; label: string }[];
  onChange: (v: any) => void;
}) {
  const label = (
    <span className="mb-1 block text-xs uppercase tracking-wide text-muted">
      {field.label}
      {field.required ? <span className="text-rust"> *</span> : null}
    </span>
  );
  const cls =
    "w-full rounded-lg border border-line bg-gun px-3 py-2.5 text-ink outline-none focus:border-jade";

  if (field.type === "textarea") {
    return (
      <label className="block">
        {label}
        <textarea
          className={cls}
          rows={3}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      </label>
    );
  }

  if (field.type === "lookup" || field.type === "relation" || field.type === "static") {
    const opts =
      field.type === "static"
        ? (field.options ?? []).map((o) => ({ value: o, label: o }))
        : options ?? [];
    return (
      <label className="block">
        {label}
        <select
          className={cls}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">—</option>
          {opts.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
    );
  }

  return (
    <label className="block">
      {label}
      <input
        type={field.type === "number" ? "number" : "text"}
        step={field.step}
        className={cls}
        placeholder={field.placeholder}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
