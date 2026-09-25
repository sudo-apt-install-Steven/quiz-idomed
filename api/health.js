/**
 * Vercel Serverless Function: /api/health
 * Verificação de saúde e conectividade da API.
 */
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    return res.status(405).json({
      success: false,
      error: "Método não permitido. Utilize GET."
    });
  }

  return res.status(200).json({
    status: "healthy",
    service: "idomed-quiz-api",
    timestamp: new Date().toISOString()
  });
}
