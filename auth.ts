import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [GitHub],
  callbacks: {
    jwt({ token, profile }) {
      if (profile) token.login = (profile as Record<string, unknown>).login;
      return token;
    },
    session({ session, token }) {
      session.user.id = token.sub!;
      (session.user as unknown as Record<string, unknown>).login = token.login;
      return session;
    },
  },
});
