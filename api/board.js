export const config = { maxDuration: 45 };
// Test write access
export default async function handler(req, res) { res.status(200).json({ test: true }); }
