import superjson from "superjson";
export type OutputType = { projects: Array<{ id: string; title: string; updatedAt: Date }> };
export const getBooks = async (init?: RequestInit): Promise<OutputType> => {
  const response = await fetch("/_api/books", { ...init, method: "GET" });
  if (!response.ok) {
    const parsed = superjson.parse<{ error: string }>(await response.text());
    throw new Error(parsed.error);
  }
  return superjson.parse<OutputType>(await response.text());
};