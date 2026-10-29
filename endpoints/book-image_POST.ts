import superjson from "superjson";
import { db } from "../helpers/db";
import { getServerUserSession } from "../helpers/getServerUserSession";
import { NotAuthenticatedError } from "../helpers/getSetServerSession";
import { schema } from "./book-image_POST.schema";

export async function handle(request: Request) {
  try {
    const {user}=await getServerUserSession(request);
    const raw=await request.text();
    if(raw.length>2200000)return new Response(superjson.stringify({error:"Cette image est trop volumineuse après compression."}),{status:413});
    const input=schema.parse(superjson.parse(raw));
    const existing=await db.selectFrom("bookImages").select("id").where("id","=",input.id).where("userId","=",user.id).executeTakeFirst();
    if(existing){
      await db.updateTable("bookImages").set({dataUrl:input.dataUrl}).where("id","=",input.id).where("userId","=",user.id).execute();
    }else{
      await db.insertInto("bookImages").values({id:input.id,userId:user.id,dataUrl:input.dataUrl}).execute();
    }
    return new Response(superjson.stringify({id:input.id,path:"/_api/book-image?id="+encodeURIComponent(input.id)}));
  } catch(error) {
    if(error instanceof NotAuthenticatedError)return new Response(superjson.stringify({error:"Connectez-vous pour ajouter des images à vos projets."}),{status:401});
    const invalid=error instanceof Error&&error.name==="ZodError";
    return new Response(superjson.stringify({error:invalid?"Image invalide ou trop volumineuse.":"Impossible d’enregistrer cette image."}),{status:invalid?400:500});
  }
}