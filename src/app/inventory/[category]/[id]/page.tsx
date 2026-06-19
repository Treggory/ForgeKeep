import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getEntity } from "@/lib/entities";
import EntityForm from "@/components/EntityForm";

export default async function EditPage({
  params,
}: {
  params: { category: string; id: string };
}) {
  const entity = getEntity(params.category);
  if (!entity) notFound();

  const supabase = await createClient();
  const { data: row } = await supabase
    .from(entity.table)
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  if (!row) notFound();

  return (
    <div className="space-y-4">
      <header>
        <Link href={`/inventory/${entity.key}`} className="text-sm text-muted">
          ← {entity.plural}
        </Link>
        <h1 className="font-display text-2xl font-semibold">
          Edit {entity.singular.toLowerCase()}
        </h1>
      </header>
      <EntityForm categoryKey={entity.key} initial={row} />
    </div>
  );
}
