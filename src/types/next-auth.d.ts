import { type DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "customer" | "attorney" | "admin";
    } & DefaultSession["user"];
  }

  interface User {
    role?: "customer" | "attorney" | "admin";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: "customer" | "attorney" | "admin";
  }
}
