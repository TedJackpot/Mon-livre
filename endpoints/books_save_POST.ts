import superjson from "superjson";
import type { Json } from "../helpers/schema";
import { db } from "../helpers/db";
import { getServerUserSession } from "../helpers/getServerUserSession";
import { NotAuthenticatedError } from "../helpers/getSetServerSession";
import { schema } from "./books_save_POST.schema";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    const raw = await request.text();
    if (raw.length > 2500000) return new Response(superjson.stringify({ error: "Ce projet est trop volumineux. Réduisez la taille ou le nombre d’images." }), { status: 413 });
    const input = schema.parse(superjson.parse(raw));
    const now = new Date();
    const result = await db.insertInto("bookProjects")
      .values({ id: input.id, userId: user.id, title: input.title, document: input as unknown as Json, updatedAt: now })
      .onConflict((conflict) => conflict.column("id").doUpdateSet({
        title: input.title, document: input as unknown as Json, updatedAt: now,
      }).where("bookProjects.userId", "=", user.id))
      .returning(["id", "updatedAt"])
      .executeTakeFirst();
    if (!result) return new Response(superjson.stringify({ error: "Ce projet n’est pas accessible depuis ce compte." }), { status: 403 });
    return new Response(superjson.stringify(result));
  } catch (error) {
    if (error instanceof NotAuthenticatedError) return new Response(superjson.stringify({ error: "Connectez-vous pour sauvegarder ce projet." }), { status: 401 });
    const message = error instanceof Error && error.name === "ZodError" ? "Le contenu du projet ne respecte pas le format attendu." : "La sauvegarde a échoué.";
    return new Response(superjson.stringify({ error: message }), { status: error instanceof Error && error.name === "ZodError" ? 400 : 500 });
  }
}