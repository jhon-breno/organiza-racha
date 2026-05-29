/**
 * Script: normalize-phones
 *
 * Normaliza todos os telefones do banco de dados:
 *  - Remove caracteres não numéricos
 *  - Remove DDI 55 quando presente (ex: 559999999999 → 99999999999)
 *  - Mantém no máximo 11 dígitos
 *  - Detecta e resolve duplicatas (limpa o telefone dos usuários secundários)
 *  - Normaliza também os telefones das inscrições (participantPhone)
 *
 * Uso:
 *   npm run db:normalize-phones          → dry-run (apenas mostra o que seria feito)
 *   npm run db:normalize-phones -- --apply  → aplica as alterações no banco
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DRY_RUN = !process.argv.includes("--apply");

// ─── helpers ─────────────────────────────────────────────────────────────────

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length > 11 && digits.startsWith("55")) {
    return digits.slice(2, 13);
  }
  return digits.slice(0, 11);
}

function label(dryRun: boolean) {
  return dryRun ? "[DRY-RUN]" : "[APPLY]";
}

// ─── main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n══════════════════════════════════════════════`);
  console.log(
    ` normalize-phones  ${DRY_RUN ? "DRY-RUN (sem alterações)" : "APLICANDO alterações"}`,
  );
  console.log(`══════════════════════════════════════════════\n`);

  // ── 1. Normalizar User.phone ───────────────────────────────────────────────
  console.log("→ Buscando usuários com telefone...");
  const users = await prisma.user.findMany({
    where: { phone: { not: null } },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      passwordHash: true,
      updatedAt: true,
      _count: { select: { enrollments: true } },
    },
  });

  console.log(`   ${users.length} usuários encontrados com telefone.\n`);

  // Mapeia phone normalizado → lista de usuários
  const phoneMap = new Map<string, typeof users>();

  for (const user of users) {
    const normalized = normalizePhone(user.phone!);
    if (!normalized) continue;
    if (!phoneMap.has(normalized)) phoneMap.set(normalized, []);
    phoneMap.get(normalized)!.push(user);
  }

  // Ordena cada grupo: prioriza email+senha > mais inscrições > updatedAt mais recente
  for (const group of phoneMap.values()) {
    group.sort((a, b) => {
      const aScore =
        (a.email && a.passwordHash ? 1000 : 0) + a._count.enrollments;
      const bScore =
        (b.email && b.passwordHash ? 1000 : 0) + b._count.enrollments;
      if (bScore !== aScore) return bScore - aScore;
      return b.updatedAt.getTime() - a.updatedAt.getTime();
    });
  }

  let usersNormalized = 0;
  let usersDuplicated = 0;
  let usersCleared = 0;

  // ── Passo 1: limpar duplicatas PRIMEIRO (antes de normalizar) ──────────────
  // Assim evitamos conflito de unique constraint ao normalizar
  for (const [normalized, group] of phoneMap.entries()) {
    const [keeper, ...duplicates] = group;

    if (duplicates.length > 0) {
      usersDuplicated++;
      for (const dup of duplicates) {
        const info = `${dup.name ?? dup.email ?? "s/nome"} (${dup._count.enrollments} inscrições)`;
        console.log(
          `  ${label(DRY_RUN)} DUPLICATA phone "${normalized}"` +
            `\n    keeper: ${keeper.name ?? keeper.email ?? "s/nome"} (${keeper._count.enrollments} inscrições)` +
            `\n    limpar: ${info} → phone = null`,
        );
        if (!DRY_RUN) {
          await prisma.user.update({
            where: { id: dup.id },
            data: { phone: null },
          });
        }
        usersCleared++;
      }
    }
  }

  // ── Passo 2: normalizar telefones dos keepers ─────────────────────────────
  for (const [normalized, group] of phoneMap.entries()) {
    const [keeper] = group;

    if (keeper.phone !== normalized) {
      console.log(
        `  ${label(DRY_RUN)} user ${keeper.id} (${keeper.name ?? keeper.email ?? "s/nome"})` +
          `\n    phone: "${keeper.phone}" → "${normalized}"`,
      );
      if (!DRY_RUN) {
        await prisma.user.update({
          where: { id: keeper.id },
          data: { phone: normalized },
        });
      }
      usersNormalized++;
    }
  }

  // ── 2. Normalizar Enrollment.participantPhone ──────────────────────────────
  console.log("\n→ Buscando inscrições com telefone...");
  const enrollments = await prisma.enrollment.findMany({
    select: { id: true, participantPhone: true, participantName: true },
  });

  console.log(`   ${enrollments.length} inscrições encontradas.\n`);

  let enrollmentsNormalized = 0;

  for (const enrollment of enrollments) {
    const normalized = normalizePhone(enrollment.participantPhone);
    if (!normalized || enrollment.participantPhone === normalized) continue;

    console.log(
      `  ${label(DRY_RUN)} enrollment ${enrollment.id} (${enrollment.participantName})` +
        `\n    participantPhone: "${enrollment.participantPhone}" → "${normalized}"`,
    );

    if (!DRY_RUN) {
      await prisma.enrollment.update({
        where: { id: enrollment.id },
        data: { participantPhone: normalized },
      });
    }

    enrollmentsNormalized++;
  }

  // ── Resumo ─────────────────────────────────────────────────────────────────
  console.log(`\n══════════════════════════════════════════════`);
  console.log(
    ` Resumo ${DRY_RUN ? "(dry-run — nada foi alterado)" : "(alterações aplicadas)"}`,
  );
  console.log(`──────────────────────────────────────────────`);
  console.log(`  User.phone normalizados   : ${usersNormalized}`);
  console.log(`  Duplicatas encontradas    : ${usersDuplicated}`);
  console.log(`  Telefones limpos (dupl.)  : ${usersCleared}`);
  console.log(`  participantPhone norm.    : ${enrollmentsNormalized}`);
  console.log(`══════════════════════════════════════════════\n`);

  if (DRY_RUN && usersNormalized + usersCleared + enrollmentsNormalized > 0) {
    console.log(
      "  Para aplicar, execute:\n  npm run db:normalize-phones -- --apply\n",
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
