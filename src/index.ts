import { serve } from "bun";
import index from "./index.html";
import { migrateToLatest } from "./db/db";
import { auth } from "./auth";

await migrateToLatest();

const port = Number(process.env.PORT ?? 3000);

async function getSession(req: Request) {
  return auth.api.getSession({
    headers: req.headers,
  });
}

const server = serve({
  port,
  routes: {
    "/api/auth/*": async (req) => auth.handler(req),
    "/api/me": async (req) => {
      const session = await getSession(req);
      if (!session) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }
      return Response.json(session);
    },
    "/": index,
    "/*": index,
  },
});

console.log(`Server running at http://localhost:${server.port}`);
