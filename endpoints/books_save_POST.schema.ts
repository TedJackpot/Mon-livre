import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  id: z.string().min(8).max(80),
  title: z.string().trim().min(1).max(160),
  subtitle: z.string().max(300),
  author: z.string().max(160),
  cover: z.enum(["classic", "atelier", "botanical"]),
  font: z.enum(["newsreader", "classic"]),
  pages: z.array(z.object({
    id: z.string().min(1).max(80),
    heading: z.string().max(300),
    text: z.string().max(30000),
    image: z.string().max(120).regex(/^\/_api\/book-image\?id=[A-Za-z0-9-]{8,80}$/).optional(),
    layout: z.enum(["image-right", "image-top", "text-only", "full-image"]),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    bookmark: z.boolean(),
  })).min(1).max(80),
});
export type InputType = z.infer<typeof schema>;
export type OutputType = { id: string; updatedAt: Date };
export const postSaveBook = async (body: InputType, init?: RequestInit): Promise<OutputType> => {
  const parsed = schema.parse(body);
  const response = await fetch("/_api/books/save", {
    method: "POST", body: superjson.stringify(parsed), ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!response.ok) {
    const error = superjson.parse<{ error: string }>(await response.text());
    throw new Error(error.error);
  }
  return superjson.parse<OutputType>(await response.text());
};