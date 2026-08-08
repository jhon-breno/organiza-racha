import Link from "next/link";
import { PlusCircle, Trophy, ShieldAlert } from "lucide-react";
import { auth } from "@/auth";
import { signOutAction } from "@/actions";
import { MobileHeaderMenu } from "@/components/mobile-header-menu";
import { NewRachaTypeDialog } from "@/components/new-racha-type-dialog";
import { Button } from "@/components/ui/button";
import { getInitials } from "@/lib/utils";

export async function AppHeader() {
  const session = await auth();

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/85 backdrop-blur">
      {session?.user?.mustChangePassword && (
        <div className="bg-amber-500 px-4 py-2 text-center text-xs sm:text-sm font-semibold text-slate-950 shadow-inner flex items-center justify-center gap-2">
          <ShieldAlert className="h-4 w-4 shrink-0 text-slate-950" />
          <span>
            Sua conta foi criada por um organizador. Por favor, altere sua senha.
          </span>
          <Link
            className="rounded bg-amber-950 px-2.5 py-0.5 text-xs font-bold text-amber-200 hover:bg-slate-900 transition-colors"
            href="/auth/change-password?required=true"
          >
            Alterar Senha
          </Link>
        </div>
      )}
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
              <Button asChild href="/perfil" variant="ghost">
                Meu perfil
              </Button>
              <NewRachaTypeDialog variant="outline">
                <PlusCircle className="h-4 w-4" />
                Novo racha
              </NewRachaTypeDialog>
              <Link
                className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-teal-600 text-sm font-bold text-white transition-opacity hover:opacity-80"
                href="/perfil"
                title="Meu perfil"
              >
                {session.user.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    alt={session.user.name ?? "Avatar"}
                    className="h-full w-full object-cover"
                    referrerPolicy="no-referrer"
                    src={session.user.image}
                  />
                ) : (
                  getInitials(session.user.name)
                )}
              </Link>
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
