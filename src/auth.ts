import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { demoAccessSchema } from "@/lib/validations";

export const isGoogleConfigured = Boolean(
  process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET,
);

const providers = [
  ...(isGoogleConfigured
    ? [
        Google({
          clientId: process.env.AUTH_GOOGLE_ID!,
          clientSecret: process.env.AUTH_GOOGLE_SECRET!,
        }),
      ]
    : []),
  Credentials({
    name: "Acesso demo",
    credentials: {
      name: { label: "Nome", type: "text" },
      email: { label: "Email", type: "email" },
      callbackUrl: { label: "Callback", type: "text" },
    },
    async authorize(credentials) {
      const parsed = demoAccessSchema.safeParse(credentials);

      if (!parsed.success) {
        return null;
      }

      const user = await prisma.user.upsert({
        where: { email: parsed.data.email },
        update: {
          name: parsed.data.name,
          emailVerified: new Date(),
        },
        create: {
          name: parsed.data.name,
          email: parsed.data.email,
          emailVerified: new Date(),
        },
      });

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
      };
    },
  }),
];

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  pages: {
    signIn: "/auth/signin",
  },
  session: {
    strategy: "jwt",
  },
  providers,
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }

      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
      }

      return session;
    },
  },
});
