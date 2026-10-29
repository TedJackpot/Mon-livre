import superjson from "superjson";
import { db } from "../helpers/db";
import { getServerUserSession } from "../helpers/getServerUserSession";
import { NotAuthenticatedError } from "../helpers/getSetServerSession";
import { schema } from "./books_open_POST.schema";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    const input = schema.parse(superjson.parse(await request.text()));
    const project = await db.selectFrom("bookProjects")
      .select(["id", "title", "document"])
      .where("id", "=", input.id)
      .where("userId", "=", user.id)
      .executeTakeFirst();
    if (!project) return new Response(superjson.stringify({ error: "Projet introuvable." }), { status: 404 });
    return new Response(superjson.stringify(project));
  } catch (error) {
    if (error instanceof NotAuthenticatedError) return new Response(superjson.stringify({ error: "Connectez-vous pour ouvrir ce projet." }), { status: 401 });
    const invalid = error instanceof Error && error.name === "ZodError";
    return new Response(superjson.stringify({ error: invalid ? "Identifiant de projet invalide." : "Impossible d’ouvrir ce projet." }), { status: invalid ? 400 : 500 });
  }
}