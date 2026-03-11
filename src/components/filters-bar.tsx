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
  return (
    <Card className="p-4">
      <form className="grid gap-3 lg:grid-cols-[1.5fr_0.8fr_0.8fr_auto]">
        <label className="space-y-2 text-sm font-medium text-slate-700">
          Buscar por nome, local, organizador ou WhatsApp
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              defaultValue={defaultQuery}
              name="q"
              placeholder="Ex.: futebol, Santos, Breno, 1199..."
              className="pl-11"
            />
          </div>
        </label>

        <label className="space-y-2 text-sm font-medium text-slate-700">
          Modalidade
          <Select defaultValue={defaultModality} name="modality">
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
          <Select defaultValue={defaultVisibility} name="visibility">
            <option value="">Todos</option>
            <option value="OPEN">Abertos</option>
            <option value="PRIVATE">Privados</option>
          </Select>
        </label>

        <div className="flex items-end gap-2">
          <Button className="w-full lg:w-auto">Filtrar</Button>
          <Button asChild href="/" variant="outline">
            Limpar
          </Button>
        </div>
      </form>
    </Card>
  );
}
