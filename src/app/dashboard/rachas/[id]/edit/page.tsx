import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { EnrollmentManagement } from "@/components/enrollment-management";
import { FlashMessage } from "@/components/flash-message";
import { RachaForm } from "@/components/racha-form";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ status?: string; message?: string }>;

export default async function EditRachaPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/auth/signin?callbackUrl=/dashboard");
  }

  const { id } = await params;
  const query = await searchParams;

  const racha = await prisma.racha.findUnique({
    where: { id },
    include: {
      enrollments: {
        orderBy: [{ createdAt: "asc" }],
      },
    },
  });

  if (!racha || racha.organizerId !== session.user.id) {
    notFound();
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-teal-700">
            Gestão do racha
          </p>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-950">
            {racha.title}
          </h1>
        </div>
        <div className="flex gap-3">
          <Button asChild href={`/rachas/${racha.slug}`} variant="outline">
            Ver página pública
          </Button>
          <Button asChild href="/dashboard" variant="ghost">
            Voltar ao painel
          </Button>
        </div>
      </div>

      <FlashMessage status={query.status} message={query.message} />

      <RachaForm defaultValues={racha} />

      <section className="space-y-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-950">
            Participantes e pagamentos
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Confirme PIX, acompanhe lista de espera e finalize reembolsos.
          </p>
        </div>

        <EnrollmentManagement enrollments={racha.enrollments} />
      </section>
    </div>
  );
}
