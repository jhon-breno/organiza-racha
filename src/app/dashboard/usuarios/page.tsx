import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { adminSetUserPasswordAction } from "@/actions";
import { FlashMessage } from "@/components/flash-message";
import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SUPER_ADMIN_EMAIL } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { buildMessageUrl, formatPhone } from "@/lib/utils";

type SearchParams = Promise<{
  status?: string;
  message?: string;
  q?: string;
}>;

export default async function DashboardUsersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/auth/signin?callbackUrl=/dashboard/usuarios");
  }

  const signedUserEmail = session.user.email?.trim().toLowerCase() ?? "";

  if (signedUserEmail !== SUPER_ADMIN_EMAIL) {
    redirect(
      buildMessageUrl(
        "/dashboard",
        "error",
        "Acesso restrito ao administrador principal.",
      ),
    );
  }

  const params = await searchParams;
  const query = params.q?.trim() ?? "";

  const users = await prisma.user.findMany({
    where: query
      ? {
          OR: [
            {
              name: {
                contains: query,
                mode: "insensitive",
              },
            },
            {
              email: {
                contains: query,
                mode: "insensitive",
              },
            },
            {
              phone: {
                contains: query.replace(/\D/g, ""),
              },
            },
          ],
        }
      : undefined,
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      mustChangePassword: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: [{ updatedAt: "desc" }],
    take: 300,
  });

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-teal-700">
            Administração principal
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
            Gestão global de usuários
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Área exclusiva para {SUPER_ADMIN_EMAIL}. Defina senhas temporárias e
            force a troca no próximo login.
          </p>
        </div>

        <Button asChild variant="outline">
          <Link href="/dashboard">Voltar ao painel</Link>
        </Button>
      </div>

      <FlashMessage status={params.status} message={params.message} />

      <Card className="space-y-4">
        <form className="flex flex-col gap-3 sm:flex-row" method="get">
          <Input
            defaultValue={query}
            name="q"
            placeholder="Buscar por nome, e-mail ou telefone"
          />
          <Button type="submit">Buscar</Button>
          {query ? (
            <Button asChild type="button" variant="ghost">
              <Link href="/dashboard/usuarios">Limpar</Link>
            </Button>
          ) : null}
        </form>
      </Card>

      <Card className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-slate-950">Usuários</h2>
          <Badge>{users.length} encontrados</Badge>
        </div>

        {users.length === 0 ? (
          <p className="text-sm text-slate-600">Nenhum usuário encontrado.</p>
        ) : (
          <div className="grid gap-4">
            {users.map((user) => (
              <div
                key={user.id}
                className="rounded-2xl border border-slate-200 bg-white p-4"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-lg font-bold text-slate-950">
                      {user.name || "Sem nome"}
                    </p>
                    <p className="text-sm text-slate-600">
                      {user.email || "Sem e-mail"}
                    </p>
                    <p className="text-sm text-slate-600">
                      {user.phone ? formatPhone(user.phone) : "Sem telefone"}
                    </p>
                  </div>

                  <Badge
                    className={
                      user.mustChangePassword
                        ? "bg-amber-100 text-amber-900"
                        : "bg-emerald-100 text-emerald-800"
                    }
                  >
                    {user.mustChangePassword
                      ? "Troca de senha pendente"
                      : "Senha regular"}
                  </Badge>
                </div>

                <form
                  action={adminSetUserPasswordAction}
                  className="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr_auto]"
                >
                  <input name="userId" type="hidden" value={user.id} />
                  <Input
                    autoComplete="new-password"
                    name="password"
                    placeholder="Nova senha temporária"
                    required
                    type="password"
                  />
                  <Input
                    autoComplete="new-password"
                    name="confirmPassword"
                    placeholder="Confirmar nova senha"
                    required
                    type="password"
                  />
                  <SubmitButton pendingLabel="Redefinindo...">
                    Resetar senha
                  </SubmitButton>
                </form>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
