import superjson from "superjson";
import { db } from "../helpers/db";
import { getServerUserSession, } from "../helpers/getServerUserSession";
import { NotAuthenticatedError } from "../helpers/getSetServerSession";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    const projects = await db.selectFrom("bookProjects")
      .select(["id", "title", "updatedAt"])
      .where("userId", "=", user.id)
      .orderBy("updatedAt", "desc")
      .limit(30)
      .execute();
    return new Response(superjson.stringify({ projects }));
  } catch (error) {
    const status = error instanceof NotAuthenticatedError ? 401 : 500;
    return new Response(superjson.stringify({ error: status === 401 ? "Connectez-vous pour accéder à vos projets." : "Impossible de charger les projets." }), { status });
  }
}