/**
 * Vercel Serverless Function: /api/submit
 * Validação estrita de backend e orquestração de persistência no Supabase.
 */

const ALLOWED_OPTIONS = [
  // Q1
  ["14 a 15 anos", "16 a 17 anos", "18 anos"],
  // Q2
  ["Nunca experimentei", "Já experimentei, mas não uso", "Uso ocasionalmente", "Uso frequentemente"],
  // Q3
  ["Menos de 12 anos", "12 a 13 anos", "14 a 15 anos", "16 a 18 anos", "Nunca usei"],
  // Q4
  ["Pod descartável", "Pod recarregável", "Vape Mod tradicional", "Não sei a diferença", "Não se aplica / Nunca usei"],
  // Q5
  ["Sabores e cheiros doces/frutados", "Curiosidade", "Influência dos amigos", "Redes sociais (TikTok/Instagram)", "Alívio de estresse", "Não se aplica / Nunca usei"],
  // Q6
  ["Nenhum", "Poucos (1 ou 2)", "A maioria", "Todos"],
  // Q7
  ["Lojas físicas / Tabacarias", "Internet / Redes sociais", "Amigos mais velhos", "Escondido da família", "Não se aplica / Nunca usei"],
  // Q8
  ["Nunca", "Raramente", "Às vezes", "Diariamente / É muito comum"],
  // Q9
  ["Muito menos prejudicial", "Um pouco menos prejudicial", "Tão prejudicial quanto", "Mais prejudicial"],
  // Q10
  ["Na escola e em casa", "Apenas na escola", "Apenas em casa", "Nunca conversei sobre isso"]
];

const ALLOWED_SCHOOL_YEARS = [
  "9º ano (Ensino Fundamental)",
  "1º ano (Ensino Médio)",
  "2º ano (Ensino Médio)",
  "3º ano (Ensino Médio)",
  "Cursinho / Já concluí"
];

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SUPABASE_URL = process.env.SUPABASE_URL || "https://awetqrqxvosoejxnwlsx.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3ZXRxcnF4dm9zb2VqeG53bHN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyODEyMzUsImV4cCI6MjEwNTg1NzIzNX0.bMHSB_mN6U5kYf2578n9mZo3IY9g_jfqkdXMN7EqI3o";

// Rate Limiter em Memória para prevenção anti-fraude / anti-DDoS (máx 15 requisições por 5 minutos por IP)
const ipRateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 15;

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = ipRateLimitMap.get(ip);
  if (!entry || (now - entry.startTime) > RATE_LIMIT_WINDOW_MS) {
    ipRateLimitMap.set(ip, { startTime: now, count: 1 });
    if (ipRateLimitMap.size > 1000) {
      for (const [key, value] of ipRateLimitMap.entries()) {
        if (now - value.startTime > RATE_LIMIT_WINDOW_MS) {
          ipRateLimitMap.delete(key);
        }
      }
    }
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }
  entry.count++;
  return true;
}

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Método não permitido. Utilize POST."
    });
  }

  try {
    // 0. Rate Limiting por IP para Prevenção Anti-Fraude
    const clientIp = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.headers["x-real-ip"] || req.socket?.remoteAddress || "anonymous_ip";
    if (!checkRateLimit(clientIp)) {
      return res.status(429).json({
        success: false,
        error: "Limite temporário de submissões por rede atingido para resguardar a integridade bioestatística da amostra. Tente novamente em alguns minutos."
      });
    }

    // 0.1. Guarda de Tamanho Máximo do Payload (Proteção DoS)
    if (req.headers && req.headers["content-length"] && parseInt(req.headers["content-length"], 10) > 8192) {
      return res.status(413).json({
        success: false,
        error: "Corpo da requisição excede o limite máximo permitido (8KB)."
      });
    }

    if (typeof req.body === "string" && req.body.length > 8192) {
      return res.status(413).json({
        success: false,
        error: "Corpo da requisição excede o limite máximo permitido (8KB)."
      });
    }

    let body;
    try {
      body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    } catch (_) {
      return res.status(400).json({
        success: false,
        error: "Formato JSON inválido no corpo da requisição."
      });
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return res.status(400).json({
        success: false,
        error: "Corpo da requisição inválido. Objeto JSON esperado."
      });
    }

    // 0.2. Rejeição de Chaves Não Autorizadas (Prevenção de poluição de parâmetros)
    const ALLOWED_BODY_KEYS = [
      "submission_token", 
      "answers", 
      "q1_ano_escolar", 
      "client_elapsed_ms", 
      "idomed_hp_verification"
    ];
    for (const key of Object.keys(body)) {
      if (!ALLOWED_BODY_KEYS.includes(key)) {
        return res.status(400).json({
          success: false,
          error: `Parâmetro não reconhecido na requisição: ${key}.`
        });
      }
    }

    // 0.3. Verificação de Honeypot Anti-Bot
    if (body.idomed_hp_verification && typeof body.idomed_hp_verification === "string" && body.idomed_hp_verification.trim() !== "") {
      return res.status(400).json({
        success: false,
        error: "Tentativa de submissão automatizada interceptada pelo sistema bioético."
      });
    }

    // 0.4. Verificação de Cadência Humana (Human Speed Guard)
    if (body.client_elapsed_ms !== undefined && body.client_elapsed_ms !== null) {
      if (typeof body.client_elapsed_ms !== "number" || body.client_elapsed_ms < 2000) {
        return res.status(400).json({
          success: false,
          error: "Submissão rejeitada: tempo de preenchimento incompatível com leitura humana de 10 perguntas."
        });
      }
    }

    const { submission_token, answers, q1_ano_escolar } = body;

    // 1. Validação Estrita do Token de Idempotência (UUID v4)
    if (!submission_token || typeof submission_token !== "string" || !UUID_REGEX.test(submission_token)) {
      return res.status(400).json({
        success: false,
        error: "Identificador de submissão (submission_token) inválido ou ausente."
      });
    }

    // 2. Validação da Quantidade de Respostas
    if (!Array.isArray(answers) || answers.length !== 10) {
      return res.status(400).json({
        success: false,
        error: `O questionário exige exatamente 10 respostas. Recebido: ${Array.isArray(answers) ? answers.length : 0}.`
      });
    }

    // 3. Validação Estrita de Cada Pergunta e Opção Permitida (Canônica)
    const sanitizedAnswers = [];
    for (let i = 0; i < 10; i++) {
      const ans = answers[i];
      if (typeof ans !== "string") {
        return res.status(400).json({
          success: false,
          error: `Resposta para a Pergunta ${i + 1} deve ser uma string de texto.`,
          questionIndex: i + 1
        });
      }
      const matchedOption = ALLOWED_OPTIONS[i].find(opt => opt === ans);
      if (!matchedOption) {
        return res.status(400).json({
          success: false,
          error: `Resposta inválida ou não autorizada para a Pergunta ${i + 1}.`,
          questionIndex: i + 1
        });
      }
      sanitizedAnswers.push(matchedOption);
    }

    // 3.1. Validação Opcional de Ano Escolar (Etapa 2 da Questão 1)
    let sanitizedSchoolYear = null;
    if (q1_ano_escolar !== undefined && q1_ano_escolar !== null) {
      if (typeof q1_ano_escolar !== "string" || !ALLOWED_SCHOOL_YEARS.includes(q1_ano_escolar)) {
        return res.status(400).json({
          success: false,
          error: "Opção de ano escolar selecionada é inválida."
        });
      }
      sanitizedSchoolYear = q1_ano_escolar;
    }

    // 4. Envio Atômico para o Supabase via RPC
    const rpcPayload = {
      p_submission_token: submission_token,
      p_q1: sanitizedAnswers[0],
      p_q1_ano: sanitizedSchoolYear,
      p_q2: sanitizedAnswers[1],
      p_q3: sanitizedAnswers[2],
      p_q4: sanitizedAnswers[3],
      p_q5: sanitizedAnswers[4],
      p_q6: sanitizedAnswers[5],
      p_q7: sanitizedAnswers[6],
      p_q8: sanitizedAnswers[7],
      p_q9: sanitizedAnswers[8],
      p_q10: sanitizedAnswers[9]
    };

    const supabaseRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/submit_quiz_response`, {
      method: "POST",
      headers: {
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(rpcPayload)
    });

    if (!supabaseRes.ok) {
      const errText = await supabaseRes.text();
      console.error("[Backend Error] Supabase RPC falhou:", errText);
      return res.status(500).json({
        success: false,
        error: "Falha ao registrar respostas no banco de dados."
      });
    }

    const result = await supabaseRes.json();
    const cleanToken = (submission_token || "").replace(/[^a-fA-F0-9]/g, "").toUpperCase();
    const receiptCode = `MED-${cleanToken.slice(0, 4)}-${cleanToken.slice(4, 8)}-${cleanToken.slice(8, 12)}`;

    // Persistência de Cookie de Conclusão no Header HTTP para Prevenção Anti-Fraude
    res.setHeader("Set-Cookie", [
      "idomed_quiz_completed=true; Path=/; Max-Age=31536000; SameSite=Lax",
      `idomed_receipt_token=${receiptCode}; Path=/; Max-Age=31536000; SameSite=Lax`
    ]);

    return res.status(200).json({
      success: true,
      idempotent: result.idempotent || false,
      message: result.message || "Resposta registrada com sucesso.",
      receipt_code: receiptCode
    });

  } catch (err) {
    console.error("[Backend Error] Exceção inesperada:", err);
    return res.status(500).json({
      success: false,
      error: "Erro interno no servidor ao processar resposta."
    });
  }
}
