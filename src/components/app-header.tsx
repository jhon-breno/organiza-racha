import Link from "next/link";
import { PlusCircle, Trophy } from "lucide-react";
import { auth } from "@/auth";
import { signOutAction } from "@/actions";
import { MobileHeaderMenu } from "@/components/mobile-header-menu";
import { Button } from "@/components/ui/button";

export async function AppHeader() {
  const session = await auth();

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/85 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <Link className="flex items-center gap-3" href="/">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-400 to-emerald-600 shadow-lg shadow-teal-900/20">
            <Trophy className="h-6 w-6 text-white" />
          </div>
          <div>
            <p className="text-lg font-black leading-none text-slate-950">
              Organiza Racha
            </p>
            <p className="text-xs text-slate-500">
              Seu portal de gestão esportiva
            </p>
          </div>
        </Link>

        <nav className="hidden items-center gap-2 md:flex">
          <Button asChild href="/" variant="ghost">
            Início
          </Button>
          {session?.user ? (
            <>
              <Button asChild href="/minhas-inscricoes" variant="ghost">
                Minhas inscrições
              </Button>
              <Button asChild href="/dashboard" variant="ghost">
                Painel do organizador
              </Button>
              <Button asChild href="/dashboard/rachas/new" variant="outline">
                <PlusCircle className="h-4 w-4" />
                Novo racha
              </Button>
              <form action={signOutAction}>
                <Button variant="secondary">Sair</Button>
              </form>
            </>
          ) : (
            <Button asChild href="/auth/signin">
              Entrar
            </Button>
          )}
        </nav>

        <MobileHeaderMenu user={session?.user ?? null} />
      </div>
    </header>
  );
}
