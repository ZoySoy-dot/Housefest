export const HOUSES = ["Mutien", "Benilde", "Jaime", "Miguel"] as const;
export type House = (typeof HOUSES)[number];

export function isHouse(v: unknown): v is House {
  return typeof v === "string" && (HOUSES as readonly string[]).includes(v);
}
