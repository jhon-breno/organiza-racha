import { ParticipantStatus, PaymentStatus, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function getArgValue(flag: string) {
  const index = process.argv.findIndex((arg) => arg === flag);

  if (index === -1) {
    return undefined;
  }

  return process.argv[index + 1];
}

async function main() {
  const rachaId = getArgValue("--racha-id");
  const slug = getArgValue("--slug");
  const apply = process.argv.includes("--apply");

  if (!rachaId && !slug) {
    const affectedRachas = await prisma.racha.findMany({
      where: {
        enrollments: {
          some: {
            status: ParticipantStatus.CANCELED,
            paymentStatus: {
              in: [PaymentStatus.PENDING, PaymentStatus.PROOF_SENT],
            },
          },
        },
      },
      select: {
        id: true,
        slug: true,
        title: true,
        paymentDeadline: true,
        _count: {
          select: {
            enrollments: {
              where: {
                status: ParticipantStatus.CANCELED,
                paymentStatus: {
                  in: [PaymentStatus.PENDING, PaymentStatus.PROOF_SENT],
                },
              },
            },
          },
        },
      },
      orderBy: {
        paymentDeadline: "desc",
      },
    });

    if (!affectedRachas.length) {
      console.log("Nenhum racha com inscricoes canceladas por esse criterio foi encontrado.");
      return;
    }

    console.log("Rachas com inscricoes canceladas que podem ser reativadas:");
    for (const racha of affectedRachas) {
      console.log(
        [
          `- id: ${racha.id}`,
          `slug: ${racha.slug}`,
          `titulo: ${racha.title}`,
          `prazo: ${racha.paymentDeadline?.toISOString() ?? "sem prazo"}`,
          `inscricoes: ${racha._count.enrollments}`,
        ].join(" | "),
      );
    }

    console.log("\nUse --racha-id <id> ou --slug <slug> para detalhar ou restaurar um racha especifico.");
    console.log("Adicione --apply para efetivar a restauracao.");
    return;
  }

  const racha = await prisma.racha.findFirst({
    where: {
      ...(rachaId ? { id: rachaId } : {}),
      ...(slug ? { slug } : {}),
    },
    select: {
      id: true,
      slug: true,
      title: true,
      enrollments: {
        where: {
          status: ParticipantStatus.CANCELED,
          paymentStatus: {
            in: [PaymentStatus.PENDING, PaymentStatus.PROOF_SENT],
          },
        },
        select: {
          id: true,
          participantName: true,
          paymentStatus: true,
          canceledAt: true,
        },
        orderBy: {
          canceledAt: "desc",
        },
      },
    },
  });

  if (!racha) {
    throw new Error("Racha nao encontrado para os criterios informados.");
  }

  if (!racha.enrollments.length) {
    console.log("Esse racha nao possui inscricoes canceladas com paymentStatus PENDING ou PROOF_SENT.");
    return;
  }

  console.log(`Racha: ${racha.title} (${racha.slug})`);
  console.log("Inscricoes afetadas:");
  for (const enrollment of racha.enrollments) {
    console.log(
      [
        `- id: ${enrollment.id}`,
        `nome: ${enrollment.participantName}`,
        `paymentStatus: ${enrollment.paymentStatus}`,
        `canceladoEm: ${enrollment.canceledAt?.toISOString() ?? "-"}`,
      ].join(" | "),
    );
  }

  if (!apply) {
    console.log("\nPrevia concluida. Adicione --apply para restaurar essas inscricoes.");
    return;
  }

  const restored = await prisma.enrollment.updateMany({
    where: {
      rachaId: racha.id,
      status: ParticipantStatus.CANCELED,
      paymentStatus: {
        in: [PaymentStatus.PENDING, PaymentStatus.PROOF_SENT],
      },
    },
    data: {
      status: ParticipantStatus.ACTIVE,
      canceledAt: null,
    },
  });

  console.log(`\n${restored.count} inscricao(oes) restaurada(s).`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });