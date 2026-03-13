"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

export function FiltersBar({
  modalities,
  defaultQuery,
  defaultModality,
  defaultVisibility,
}: {
  modalities: readonly { value: string; label: string }[];
  defaultQuery?: string;
  defaultModality?: string;
  defaultVisibility?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState(defaultQuery ?? "");
  const [modality, setModality] = useState(defaultModality ?? "");
  const [visibility, setVisibility] = useState(defaultVisibility ?? "");

  useEffect(() => {
    setQuery(defaultQuery ?? "");
  }, [defaultQuery]);

  useEffect(() => {
    setModality(defaultModality ?? "");
  }, [defaultModality]);

  useEffect(() => {
    setVisibility(defaultVisibility ?? "");
  }, [defaultVisibility]);

  const applyFilters = () => {
    const params = new URLSearchParams();

    if (query.trim()) {
      params.set("q", query.trim());
    }

    if (modality.trim()) {
      params.set("modality", modality.trim());
    }

    if (visibility.trim()) {
      params.set("visibility", visibility.trim());
    }

    const queryString = params.toString();
    const url = queryString ? `${pathname}?${queryString}` : pathname;

    startTransition(() => {
      router.replace(url, { scroll: false });
    });
  };

  const clearFilters = () => {
    setQuery("");
    setModality("");
    setVisibility("");

    startTransition(() => {
      router.replace(pathname, { scroll: false });
    });
  };

  return (
    <Card className="p-4">
      <form
        className="grid gap-3 lg:grid-cols-[1.5fr_0.8fr_0.8fr_auto]"
        onSubmit={(event) => {
          event.preventDefault();
          applyFilters();
        }}
      >
        <label className="space-y-2 text-sm font-medium text-slate-700">
          Buscar por nome, local, organizador ou WhatsApp
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              name="q"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Ex.: futebol, Santos, Breno, 1199..."
              className="pl-11"
            />
          </div>
        </label>

        <label className="space-y-2 text-sm font-medium text-slate-700">
          Modalidade
          <Select
            name="modality"
            value={modality}
            onChange={(event) => setModality(event.target.value)}
          >
            <option value="">Todas</option>
            {modalities.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </Select>
        </label>

        <label className="space-y-2 text-sm font-medium text-slate-700">
          Acesso
          <Select
            name="visibility"
            value={visibility}
            onChange={(event) => setVisibility(event.target.value)}
          >
            <option value="">Todos</option>
            <option value="OPEN">Abertos</option>
            <option value="PRIVATE">Privados</option>
          </Select>
        </label>

        <div className="flex items-end gap-2">
          <Button
            className="w-full lg:w-auto"
            disabled={isPending}
            type="submit"
          >
            {isPending ? "Filtrando..." : "Filtrar"}
          </Button>
          <Button onClick={clearFilters} type="button" variant="outline">
            Limpar
          </Button>
        </div>
      </form>
    </Card>
  );
}
