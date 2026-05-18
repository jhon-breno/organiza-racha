import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { TeamDrawModule } from "@/components/team-draw-module";
import { Button } from "@/components/ui/button";
import { isConfirmedEnrollment } from "@/lib/enrollment";
import { prisma } from "@/lib/prisma";

type Params = Promise<{ id: string }>;

export default async function RachaTeamDrawPage({
  params,
}: {
  params: Params;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/auth/signin?callbackUrl=/dashboard");
  }

  const { id } = await params;

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

  const confirmedEnrollments = racha.enrollments
    .filter(isConfirmedEnrollment)
    .map((item) => ({
      id: item.id,
      participantName: item.participantName,
      participantPhone: item.participantPhone,
      participantPosition: item.participantPosition,
      participantLevel: item.participantLevel,
    }));

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-teal-700">
            Sorteio de times
          </p>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-950">
            {racha.title}
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            Revise os participantes confirmados, os niveis em estrelas e gere
            os times em uma pagina dedicada.
          </p>
        </div>

        <div className="flex gap-3">
          <Button asChild href={`/rachas/${racha.slug}`} variant="outline">
            Ver pagina publica
          </Button>
          <Button asChild href={`/dashboard/rachas/${racha.id}/edit`} variant="ghost">
            Voltar ao racha
          </Button>
        </div>
      </div>

      <TeamDrawModule
        enrollments={confirmedEnrollments}
        futebolType={racha.futebolType}
        modality={racha.modality}
        rachaTitle={racha.title}
        voleiType={racha.voleiType}
      />
    </div>
  );
}