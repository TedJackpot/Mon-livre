import { z } from "zod";
import superjson from "superjson";
export const schema = z.object({
  id: z.string().min(8).max(80),
  dataUrl: z.string().min(30).max(2100000).regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/),
});
export type InputType = z.infer<typeof schema>;
export type OutputType = { id: string; path: string };
export const postBookImage = async (body: InputType, init?: RequestInit): Promise<OutputType> => {
  const parsed=schema.parse(body);
  const response=await fetch("/_api/book-image",{method:"POST",body:superjson.stringify(parsed),...init,headers:{"Content-Type":"application/json",...(init?.headers??{})}});
  if(!response.ok){const error=superjson.parse<{error:string}>(await response.text());throw new Error(error.error);}
  return superjson.parse<OutputType>(await response.text());
};