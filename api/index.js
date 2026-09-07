export const config = { maxDuration: 30 };
import { buildUniverse } from "../lib/indexer.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=120");
  try {
    const uni = await buildUniverse();
    res.status(200).json(uni);
  } catch (e) {
    res.status(502).json({ error: String(e.message || e) });
  }
}
