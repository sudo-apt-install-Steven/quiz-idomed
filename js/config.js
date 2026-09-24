/**
 * Configurações da Aplicação - Pesquisa IDOMED FAMEJIPA
 * Contém exclusivamente credenciais públicas (ANON) seguras para o frontend.
 */
window.APP_CONFIG = {
  // Supabase URL e Chave Pública Anon
  SUPABASE_URL: "https://awetqrqxvosoejxnwlsx.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3ZXRxcnF4dm9zb2VqeG53bHN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyODEyMzUsImV4cCI6MjEwNTg1NzIzNX0.bMHSB_mN6U5kYf2578n9mZo3IY9g_jfqkdXMN7EqI3o",
  
  // Endpoints da Arquitetura
  API_SUBMIT_ENDPOINT: "/api/submit",
  SUPABASE_RPC_ENDPOINT: "/rest/v1/rpc/submit_quiz_response",
  SUPABASE_REST_TABLE: "/rest/v1/quiz_responses",

  // Metadados Institucionais
  INSTITUTION: "IDOMED - Faculdade de Medicina de Ji-Paraná (FAMEJIPA)",
  RESEARCH_TITLE: "Pesquisa Acadêmica sobre o Uso de Cigarro Eletrônico (Vape/Pod)",
  TOTAL_QUESTIONS: 10
};
