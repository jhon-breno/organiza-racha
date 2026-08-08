import Link from "next/link";
import { redirect } from "next/navigation";
import { Lock, Mail, Phone, Tag, User } from "lucide-react";
import { updateProfileAction } from "@/actions";
import { auth } from "@/auth";
import { FlashMessage } from "@/components/flash-message";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { prisma } from "@/lib/prisma";

type SearchParams = Promise<{
  message?: string;
  type?: string;
  status?: string;
}>;

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/signin?callbackUrl=/perfil");
  }

  const params = await searchParams;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      nickname: true,
      email: true,
      phone: true,
    },
  });

  if (!user) {
    redirect("/auth/signin");
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-950 sm:text-3xl">
            Meu Perfil
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Atualize suas informações pessoais de cadastro.
          </p>
        </div>

        <Button asChild variant="outline">
          <Link href="/auth/change-password">
            <Lock className="h-4 w-4" />
            Alterar senha
          </Link>
        </Button>
      </div>

      <FlashMessage message={params.message} status={params.status ?? params.type} />

      <Card>
        <form action={updateProfileAction} className="space-y-6">
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-slate-900">
                <User className="h-4 w-4 text-slate-500" />
                Nome completo
              </label>
              <Input
                defaultValue={user.name ?? ""}
                name="name"
                placeholder="Seu nome completo"
                required
              />
            </div>

            <div>
              <label className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Tag className="h-4 w-4 text-slate-500" />
                Apelido / Como quer ser chamado
              </label>
              <Input
                defaultValue={user.nickname ?? ""}
                name="nickname"
                placeholder="Ex.: Pedrinho, Beto"
              />
              <p className="mt-1 text-xs text-slate-500">
                Opcional. Usado para identificação nos rachas.
              </p>
            </div>

            <div>
              <label className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Phone className="h-4 w-4 text-slate-500" />
                Telefone (WhatsApp)
              </label>
              <PhoneInput
                defaultValue={user.phone ?? ""}
                name="phone"
                placeholder="85 9 9999-9999"
              />
            </div>

            <div>
              <label className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Mail className="h-4 w-4 text-slate-500" />
                E-mail
              </label>
              <Input
                defaultValue={user.email ?? ""}
                name="email"
                placeholder="seu.email@exemplo.com"
                required
                type="email"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
            <Button asChild variant="ghost">
              <Link href="/">Cancelar</Link>
            </Button>
            <SubmitButton pendingLabel="Salvando alterações...">
              Salvar alterações
            </SubmitButton>
          </div>
        </form>
      </Card>
    </div>
  );
}
