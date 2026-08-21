import Link from "next/link";
import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { FlashMessage } from "@/components/flash-message";
import { GlobalUserManagementActions } from "@/components/global-user-management-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SUPER_ADMIN_EMAIL } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { buildMessageUrl } from "@/lib/utils";

type SearchParams = Promise<{
  status?: string;
  message?: string;
  q?: string;
  gender?: string;
  passwordState?: string;
  phoneState?: string;
  emailState?: string;
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
  const genderFilter = params.gender ?? "all";
  const passwordStateFilter = params.passwordState ?? "all";
  const phoneStateFilter = params.phoneState ?? "all";
  const emailStateFilter = params.emailState ?? "all";

  const where: Prisma.UserWhereInput = {};

  if (query) {
    where.OR = [
      {
        name: {
          contains: query,
          mode: "insensitive",
        },
      },
      {
        nickname: {
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
    ];
  }

  if (genderFilter === "female") {
    where.isFemale = true;
  } else if (genderFilter === "male") {
    where.isFemale = false;
  }

  if (passwordStateFilter === "pending") {
    where.mustChangePassword = true;
  } else if (passwordStateFilter === "regular") {
    where.mustChangePassword = false;
  }

  if (phoneStateFilter === "with-phone") {
    where.phone = { not: null };
  } else if (phoneStateFilter === "without-phone") {
    where.phone = null;
  }

  if (emailStateFilter === "with-email") {
    where.email = { not: null };
  } else if (emailStateFilter === "without-email") {
    where.email = null;
  }

  const users = await prisma.user.findMany({
    where,
    select: {
      id: true,
      name: true,
      nickname: true,
      email: true,
      emailVerified: true,
      phone: true,
      image: true,
      isFemale: true,
      mustChangePassword: true,
      pixKey: true,
      pixBankName: true,
      pixHolderName: true,
      passwordHash: true,
      passwordResetToken: true,
      passwordResetExpires: true,
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
        <form
          className="grid gap-3 lg:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto]"
          method="get"
        >
          <Input
            defaultValue={query}
            name="q"
            placeholder="Buscar por nome, apelido, e-mail ou telefone"
          />
          <select
            className="h-12 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
            defaultValue={genderFilter}
            name="gender"
          >
            <option value="all">Gênero: todos</option>
            <option value="female">Gênero: mulher</option>
            <option value="male">Gênero: não mulher</option>
          </select>
          <select
            className="h-12 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
            defaultValue={passwordStateFilter}
            name="passwordState"
          >
            <option value="all">Senha: todos</option>
            <option value="pending">Senha: troca pendente</option>
            <option value="regular">Senha: regular</option>
          </select>
          <select
            className="h-12 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
            defaultValue={phoneStateFilter}
            name="phoneState"
          >
            <option value="all">Telefone: todos</option>
            <option value="with-phone">Com telefone</option>
            <option value="without-phone">Sem telefone</option>
          </select>
          <select
            className="h-12 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
            defaultValue={emailStateFilter}
            name="emailState"
          >
            <option value="all">E-mail: todos</option>
            <option value="with-email">Com e-mail</option>
            <option value="without-email">Sem e-mail</option>
          </select>
          <Button type="submit">Buscar</Button>
          {query ||
          genderFilter !== "all" ||
          passwordStateFilter !== "all" ||
          phoneStateFilter !== "all" ||
          emailStateFilter !== "all" ? (
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
              <GlobalUserManagementActions
                key={user.id}
                user={{
                  ...user,
                  emailVerified: user.emailVerified?.toISOString() ?? null,
                  passwordResetExpires:
                    user.passwordResetExpires?.toISOString() ?? null,
                  createdAt: user.createdAt.toISOString(),
                  updatedAt: user.updatedAt.toISOString(),
                }}
              />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
