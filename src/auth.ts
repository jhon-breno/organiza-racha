import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { demoAccessSchema } from "@/lib/validations";

const googleClientId = (
  process.env.AUTH_GOOGLE_ID ?? process.env.GOOGLE_CLIENT_ID
)?.trim();
const googleClientSecret = (
  process.env.AUTH_GOOGLE_SECRET ?? process.env.GOOGLE_CLIENT_SECRET
)?.trim();

export const isGoogleConfigured = Boolean(googleClientId && googleClientSecret);

const providers = [
  ...(isGoogleConfigured
    ? [
        Google({
          clientId: googleClientId!,
          clientSecret: googleClientSecret!,
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

      const existingUser = await prisma.user.findUnique({
        where: { email: parsed.data.email },
      });

      const user = existingUser
        ? await prisma.user.update({
            where: { id: existingUser.id },
            data: {
              emailVerified: new Date(),
              ...(existingUser.name
                ? {}
                : {
                    name: parsed.data.name,
                  }),
            },
          })
        : await prisma.user.create({
            data: {
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

const authResult = NextAuth({
  adapter: PrismaAdapter(prisma),
  pages: {
    signIn: "/auth/signin",
  },
  session: {
    strategy: "jwt",
  },
  providers,
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "google") {
        // Usa o `profile` do OAuth (dados reais do Google),
        // não o `user` que pode conter dados desatualizados do banco.
        const googleName =
          (profile?.name as string | undefined) ?? user.name ?? undefined;
        const googleEmail =
          (profile?.email as string | undefined) ?? user.email ?? undefined;
        const googleImage =
          (profile?.picture as string | undefined) ??
          (profile?.image as string | undefined) ??
          user.image ??
          undefined;

        const targetUserWhere =
          typeof user.id === "string" && user.id
            ? { id: user.id }
            : googleEmail
              ? { email: googleEmail }
              : null;

        if (targetUserWhere) {
          await prisma.user.updateMany({
            where: targetUserWhere,
            data: {
              ...(googleName ? { name: googleName } : {}),
              ...(googleImage ? { image: googleImage } : {}),
              emailVerified: new Date(),
            },
          });
        }
      }

      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }

      if (typeof token.id === "string") {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id },
          select: {
            name: true,
            email: true,
            image: true,
          },
        });

        if (dbUser) {
          token.name = dbUser.name ?? undefined;
          token.email = dbUser.email ?? undefined;
          token.picture = dbUser.image ?? undefined;
        }
      }

      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;

        if (typeof token.name === "string") {
          session.user.name = token.name;
        }

        if (typeof token.email === "string") {
          session.user.email = token.email;
        }

        if (typeof token.picture === "string") {
          session.user.image = token.picture;
        }
      }

      return session;
    },
  },
});

const { handlers, auth: rawAuth, signIn, signOut } = authResult;

export const auth: typeof rawAuth = (async (...args: unknown[]) => {
  try {
    return await (rawAuth as (...innerArgs: unknown[]) => Promise<unknown>)(
      ...args,
    );
  } catch (error) {
    const isJwtSessionError =
      error instanceof Error &&
      (error.name === "JWTSessionError" ||
        error.message.includes("JWTSessionError"));

    if (isJwtSessionError) {
      return null;
    }

    throw error;
  }
}) as typeof rawAuth;

export { handlers, signIn, signOut };
