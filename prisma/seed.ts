import {
  Modality,
  ParticipantLevel,
  ParticipantStatus,
  PaymentStatus,
  Visibility,
} from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { slugify } from "../src/lib/utils";

async function main() {
  await prisma.enrollment.deleteMany();
  await prisma.racha.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();

  const organizer = await prisma.user.create({
    data: {
      name: "Breno Organizador",
      email: "organizador@organizaracha.app",
      phone: "11999999999",
    },
  });

  const player = await prisma.user.create({
    data: {
      name: "Carlos Participante",
      email: "carlos@organizaracha.app",
      phone: "11988887777",
    },
  });

  const futebol = await prisma.racha.create({
    data: {
      slug: `${slugify("Racha das Quartas")}-demo`,
      title: "Racha das Quartas",
      modality: Modality.FUTEBOL,
      description: "Partida amistosa com foco em resenha e bom nível técnico.",
      rules:
        "Chegar com 20 minutos de antecedência, colete obrigatório e respeito total entre todos.",
      athleteLimit: 20,
      eventDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3),
      locationName: "Escola JF",
      address: "Rua Joaquim Marques, 13",
      city: "Fortaleza",
      state: "CE",
      mapsQuery: "Escola Joaquim Francisco de Sousa Filho",
      priceInCents: 0,
      organizerDisplayName: "Klefer Marinho",
      phoneWhatsapp: "11999999999",
      whatsappGroupUrl: "https://chat.whatsapp.com/exemplo-futebol",
      pixKey: "organizador@organizaracha.app",
      coverImageUrl:
        "https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=1200&q=80",
      profileImageUrl:
        "https://images.unsplash.com/photo-1517466787929-bc90951d0974?auto=format&fit=crop&w=400&q=80",
      visibility: Visibility.OPEN,
      cancellationWindowHours: 2,
      organizerId: organizer.id,
    },
  });

  const volei = await prisma.racha.create({
    data: {
      slug: `${slugify("Vôlei de Sábado")}-demo`,
      title: "Vôlei de Sábado",
      modality: Modality.VOLEI,
      description:
        "Turma mista com vagas limitadas e prioridade para quem confirma cedo.",
      rules:
        "Aceitar rodízio, pontualidade e confirmação do PIX no ato da inscrição.",
      athleteLimit: 12,
      eventDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 5),
      locationName: "Quadra Praia Norte",
      address: "Avenida Mar, 500",
      city: "Santos",
      state: "SP",
      mapsQuery: "Quadra Praia Norte Santos",
      priceInCents: 2800,
      organizerDisplayName: "Breno Organizador",
      phoneWhatsapp: "11999999999",
      whatsappGroupUrl: "https://chat.whatsapp.com/exemplo-volei",
      pixKey: "11999999999",
      coverImageUrl:
        "https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=1200&q=80",
      profileImageUrl:
        "https://images.unsplash.com/photo-1547347298-4074fc3086f0?auto=format&fit=crop&w=400&q=80",
      visibility: Visibility.PRIVATE,
      accessKey: "VOLEI2026",
      cancellationWindowHours: 4,
      organizerId: organizer.id,
    },
  });

  await prisma.enrollment.create({
    data: {
      participantName: player.name ?? "Carlos Participante",
      participantPhone: player.phone ?? "11988887777",
      participantPosition: "Meio-campo",
      participantLevel: ParticipantLevel.INTERMEDIARIO,
      acceptedRules: true,
      pixPaid: true,
      notes: "Posso chegar 15 minutos antes.",
      status: ParticipantStatus.ACTIVE,
      paymentStatus: PaymentStatus.PAID,
      rachaId: futebol.id,
      userId: player.id,
    },
  });

  console.log("Seed executado com sucesso.");
  console.log("Usuário demo organizador: organizador@organizaracha.app");
  console.log("Usuário demo participante: carlos@organizaracha.app");
  console.log(`Racha privado: ${volei.title} | chave: ${volei.accessKey}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
