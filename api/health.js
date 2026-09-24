/**
 * Vercel Serverless Function: /api/health
 * Verificação de saúde e conectividade da API.
 */
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json({
    status: "healthy",
    service: "idomed-quiz-api",
    timestamp: new Date().toISOString()
  });
}
