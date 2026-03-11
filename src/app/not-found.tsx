import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-3xl flex-col items-center justify-center gap-6 px-4 text-center">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-teal-700">
        404
      </p>
      <h1 className="text-4xl font-black tracking-tight text-slate-950">
        Conteúdo não encontrado.
      </h1>
      <p className="max-w-xl text-sm leading-7 text-slate-600">
        O racha ou a página que você tentou acessar não existe mais ou foi
        movido.
      </p>
      <Button asChild href="/">
        Voltar para a home
      </Button>
    </div>
  );
}
