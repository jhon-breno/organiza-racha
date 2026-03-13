import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const email = "jhonbreno@gmail.com";
const newName = "Jhon Breno";

const user = await prisma.user.findUnique({ where: { email } });
if (!user) {
  console.log(`Usuário ${email} não encontrado.`);
} else {
  console.log(`Nome atual: ${user.name}`);
  await prisma.user.update({
    where: { email },
    data: { name: newName },
  });
  console.log(`Nome atualizado para: ${newName}`);
}

await prisma.$disconnect();
