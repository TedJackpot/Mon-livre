import { Buffer } from "node:buffer";
import { db } from "../helpers/db";
import { getServerUserSession } from "../helpers/getServerUserSession";
import { NotAuthenticatedError } from "../helpers/getSetServerSession";

export async function handle(request: Request) {
  try {
    const {user}=await getServerUserSession(request);
    const id=new URL(request.url).searchParams.get("id")||"";
    if(!/^[a-zA-Z0-9-]{8,80}$/.test(id))return new Response("Image introuvable.",{status:404});
    const record=await db.selectFrom("bookImages").select("dataUrl").where("id","=",id).where("userId","=",user.id).executeTakeFirst();
    if(!record||!record.dataUrl.startsWith("data:image/jpeg;base64,"))return new Response("Image introuvable.",{status:404});
    const bytes=Buffer.from(record.dataUrl.slice("data:image/jpeg;base64,".length),"base64");
    return new Response(bytes,{headers:{"Content-Type":"image/jpeg","Cache-Control":"private, max-age=3600","X-Content-Type-Options":"nosniff"}});
  }catch(error){
    const status=error instanceof NotAuthenticatedError?401:500;
    return new Response(status===401?"Connexion requise.":"Impossible de charger l’image.",{status});
  }
}