import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { FlashMessage } from "@/components/flash-message";
import { RachaForm } from "@/components/racha-form";
import { prisma } from "@/lib/prisma";

type SearchParams = Promise<{
  status?: string;
  message?: string;
}>;

export default async function NewRachaPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/auth/signin?callbackUrl=/dashboard/rachas/new");
  }

  const params = await searchParams;
  const userModel = Prisma.dmmf.datamodel.models.find(
    (model) => model.name === "User",
  );
  const supportsNickname = Boolean(
    userModel?.fields.some((field) => field.name === "nickname"),
  );
  const supportsPixKey = Boolean(
    userModel?.fields.some((field) => field.name === "pixKey"),
  );

  const organizerSelect: Record<string, boolean> = {
    name: true,
    phone: true,
  };

  if (supportsNickname) {
    organizerSelect.nickname = true;
  }

  if (supportsPixKey) {
    organizerSelect.pixKey = true;
  }

  const organizerProfile = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: organizerSelect,
  });

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-teal-700">
          Novo racha
        </p>
        <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-950">
          Publique um racha completo e profissional.
        </h1>
      </div>
      <FlashMessage status={params.status} message={params.message} />
      <RachaForm
        defaultValues={{
          organizerDisplayName:
            organizerProfile?.nickname || organizerProfile?.name || "",
          phoneWhatsapp: organizerProfile?.phone ?? "",
          pixKey: organizerProfile?.pixKey ?? "",
        }}
      />
    </div>
  );
}
