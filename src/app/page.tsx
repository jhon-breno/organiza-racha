import { auth } from "@/auth";
import { EmptyState } from "@/components/empty-state";
import { FiltersBar } from "@/components/filters-bar";
import { FlashMessage } from "@/components/flash-message";
import { RachaCard } from "@/components/racha-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { modalities } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { normalizeSearchText } from "@/lib/utils";

type SearchParams = Promise<{
  q?: string;
  modality?: string;
  visibility?: string;
  status?: string;
  message?: string;
}>;

export default async function Home({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const session = await auth();
  const q = params.q?.trim() ?? "";
  const normalizedQuery = normalizeSearchText(q);
  const modality = params.modality?.trim() ?? "";
  const visibility = params.visibility?.trim() ?? "";

  const allMatchingRachas = await prisma.racha.findMany({
    where: {
      status: "PUBLISHED",
      eventDate: { gte: new Date() },
      ...(modality ? { modality: modality as never } : {}),
      ...(visibility ? { visibility: visibility as never } : {}),
    },
    include: {
      organizer: true,
      enrollments: {
        where: { status: { in: ["ACTIVE", "WAITLIST"] } },
        select: { id: true, status: true },
      },
    },
    orderBy: [{ eventDate: "asc" }, { createdAt: "desc" }],
  });

  const rachas = normalizedQuery
    ? allMatchingRachas.filter((racha) => {
        const searchTargets = [
          racha.title,
          racha.city,
          racha.address,
          racha.locationName,
          racha.organizerDisplayName,
          racha.phoneWhatsapp,
        ];

        return searchTargets.some((target) =>
          normalizeSearchText(target).includes(normalizedQuery),
        );
      })
    : allMatchingRachas;

  const [totalRachas, totalOrganizadores, totalInscricoes] = await Promise.all([
    prisma.racha.count({ where: { status: "PUBLISHED" } }),
    prisma.user.count({ where: { rachas: { some: {} } } }),
    prisma.enrollment.count({
      where: { status: { in: ["ACTIVE", "WAITLIST"] } },
    }),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-4 py-8 sm:px-6 lg:px-8">
      <section className="grid gap-6 rounded-4xl bg-linear-to-br from-emerald-600 via-teal-600 to-cyan-700 px-6 py-10 text-white shadow-2xl shadow-teal-950/15 lg:grid-cols-[1.4fr_0.8fr] lg:px-10">
        <div className="space-y-6">
          <Badge className="bg-white/15 text-white ring-1 ring-white/20">
            Gestão completa para rachas esportivos
          </Badge>
          <div className="space-y-4">
            <h1 className="max-w-3xl text-4xl font-black tracking-tight sm:text-5xl">
              Organiza Racha: publique, organize e lote seu racha sem planilha
              nem confusão.
            </h1>
            <p className="max-w-2xl text-base text-white/85 sm:text-lg">
              Cadastre rachas com regras, limite de atletas, PIX, WhatsApp,
              local com Google Maps, vagas públicas ou privadas e pedido de
              reembolso com prazo configurável.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              asChild
              href={session?.user ? "/dashboard/rachas/new" : "/auth/signin"}
              size="lg"
              variant="secondary"
            >
              Criar meu racha
            </Button>
            <Button
              asChild
              className="border border-white/20 bg-white/10 text-white hover:bg-white/20"
              href="#lista-rachas"
              size="lg"
            >
              Explorar rachas
            </Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
          <div className="rounded-3xl bg-white/12 p-5 backdrop-blur-sm">
            <p className="text-sm text-white/70">Rachas publicados</p>
            <p className="mt-2 text-3xl font-black">{totalRachas}</p>
          </div>
          <div className="rounded-3xl bg-white/12 p-5 backdrop-blur-sm">
            <p className="text-sm text-white/70">Organizadores ativos</p>
            <p className="mt-2 text-3xl font-black">{totalOrganizadores}</p>
          </div>
          <div className="rounded-3xl bg-white/12 p-5 backdrop-blur-sm">
            <p className="text-sm text-white/70">Inscrições registradas</p>
            <p className="mt-2 text-3xl font-black">{totalInscricoes}</p>
          </div>
        </div>
      </section>

      <FlashMessage message={params.message} status={params.status} />

      <section className="grid gap-4 rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-teal-700">
            Como funciona
          </p>
          <h2 className="text-2xl font-bold text-slate-950">
            Portal pensado para quem organiza e para quem participa.
          </h2>
          <p className="text-sm leading-7 text-slate-600">
            O organizador publica o evento com regras, valor, capacidade, mapa,
            grupo do WhatsApp e chave PIX. O atleta acessa, aceita as regras,
            informa posição e nível, confirma o pagamento e acompanha sua vaga.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-950">
              Gestão centralizada
            </p>
            <p className="mt-2 text-sm text-slate-600">
              Controle participantes confirmados, pendentes e lista de espera em
              um único painel com ações rápidas.
            </p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-950">
              Compartilhamento e comunicação
            </p>
            <p className="mt-2 text-sm text-slate-600">
              Exporte listas em PDF/Excel, gere mensagem para WhatsApp e
              mantenha o grupo do racha sempre atualizado.
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-6" id="lista-rachas">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-teal-700">
            Buscar rachas
          </p>
          <h2 className="text-3xl font-bold text-slate-950">
            Encontre seu próximo jogo por nome, local, modalidade ou
            organizador.
          </h2>
        </div>

        <FiltersBar
          defaultModality={modality}
          defaultQuery={q}
          defaultVisibility={visibility}
          modalities={modalities}
        />

        {rachas.length === 0 ? (
          <EmptyState
            actionHref={
              session?.user ? "/dashboard/rachas/new" : "/auth/signin"
            }
            actionLabel="Publicar um racha"
            description="Tente ajustar os filtros ou publique o primeiro racha da plataforma."
            title="Nenhum racha encontrado"
          />
        ) : (
          <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
            {rachas.map((racha) => (
              <RachaCard key={racha.id} racha={racha} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
