import { Database } from "bun:sqlite";
import { betterAuth } from "better-auth";

const baseURL = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
const secret =
  process.env.BETTER_AUTH_SECRET ??
  process.env.AUTH_SECRET ??
  "replace-me-in-production-with-a-long-secret";

const trustedOrigins = [baseURL];
const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

if (!googleClientId || !googleClientSecret) {
  throw new Error(
    "Missing Google OAuth envs: GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET"
  );
}

export const auth = betterAuth({
  baseURL,
  secret,
  trustedOrigins,
  database: new Database("data/app.sqlite"),
  socialProviders: {
    google: {
      clientId: googleClientId,
      clientSecret: googleClientSecret,
    },
  },
});
