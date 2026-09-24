# Pesquisa Vape/Pod - IDOMED FAMEJIPA

Aplicação web e infraestrutura completa para coleta e análise de dados acadêmicos da **Faculdade de Medicina de Ji-Paraná (IDOMED / FAMEJIPA)** sobre o uso de cigarros eletrônicos (vape/pod) entre jovens.

---

## 🔒 Privacidade e Anonimato Garantidos
- **Zero Coleta de Dados Pessoais:** Não são solicitados nem gravados nomes, e-mails, telefones ou endereços IP.
- **Armazenamento Mínimo Necessário:** Apenas as respostas das 10 perguntas e a data/hora em UTC são persistidas para estudo estatístico.

---

## ⚙️ Arquitetura e Infraestrutura Supabase

- **Projeto Supabase:** `Quiz Idomed` (ID: `awetqrqxvosoejxnwlsx`)
- **Região:** `us-west-2` (AWS Oregon)
- **Database Engine:** PostgreSQL 17
- **Tabela Principal:** `public.quiz_responses`

### Schema da Tabela `quiz_responses`
| Coluna | Tipo | Descrição |
| :--- | :--- | :--- |
| `id` | `uuid PRIMARY KEY` | Identificador único (`gen_random_uuid()`) |
| `created_at` | `timestamptz` | Carimbo de data/hora em UTC |
| `q1_faixa_etaria` | `text` | Qual é a sua idade e ano escolar? |
| `q2_contato_vape` | `text` | Você já teve contato com cigarro eletrônico? |
| `q3_idade_primeiro_contato`| `text` | Com qual idade ocorreu o primeiro contato? |
| `q4_dispositivo_popular` | `text` | Qual dispositivo é mais popular no grupo? |
| `q5_atrativo_principal` | `text` | O que mais atrai a atenção dos jovens? |
| `q6_amigos_usam` | `text` | Quantos amigos próximos usam? |
| `q7_forma_acesso` | `text` | Como a maioria consegue os produtos? |
| `q8_frequencia_escola` | `text` | Frequência de uso ao redor da escola? |
| `q9_percepcao_risco` | `text` | Grau de risco comparado ao tradicional? |
| `q10_dialogo_prevencao` | `text` | Já conversou sobre riscos com escola/família? |

### Índices Criados
- `idx_quiz_responses_created_at` em `created_at DESC`
- `idx_quiz_responses_q1` em `q1_faixa_etaria`
- `idx_quiz_responses_q2` em `q2_contato_vape`

### Segurança em Nível de Linha (RLS)
- **RLS Ativo:** Sim (`ALTER TABLE quiz_responses ENABLE ROW LEVEL SECURITY;`).
- **Política de Inserção Pública (`Permitir insercao anonima de respostas`):**
  - Permite que qualquer participante responda anonimamente usando a chave pública (`anon`).
- **Política de Leitura Administrativa (`Permitir leitura apenas para usuarios autenticados`):**
  - Usuários anônimos/visitantes recebem **0 registros** ao tentar consultar o banco diretamente via REST API (`GET /rest/v1/quiz_responses`).
  - Somente administradores autenticados via Supabase Auth ou `service_role` conseguem consultar e extrair os dados.

---

## 🚀 Telas da Aplicação

1. **`index.html` (Público - Alunos / Participantes):**
   - Questionário dinâmico com 10 perguntas de múltipla escolha.
   - Design institucional IDOMED com paleta médica oficial (azul marinho e verde-água).
   - Barra de progresso com porcentagem em tempo real e botão para voltar e revisar respostas.
   - Envio assíncrono direto para a API do Supabase com tratamento de falhas e reenvio.

2. **`admin.html` (Restrito - Pesquisadores IDOMED):**
   - Autenticação com e-mail e senha.
   - Dashboard com contagem total de participantes.
   - Gráficos de barras proporcionais para cada uma das 10 perguntas.
   - Tabela com as submissões recentes.
   - Botão para exportação direta em formato **CSV (Excel/SPSS)** com codificação UTF-8 BOM.

---

## 🌐 Credenciais Públicas (Frontend)
- **URL da API:** `https://awetqrqxvosoejxnwlsx.supabase.co`
- **Chave Pública Anon (JWT):**
  ```text
  eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3ZXRxcnF4dm9zb2VqeG53bHN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyODEyMzUsImV4cCI6MjEwNTg1NzIzNX0.bMHSB_mN6U5kYf2578n9mZo3IY9g_jfqkdXMN7EqI3o
  ```

---

## 📦 Como Publicar na Vercel

### Opção 1: Vercel CLI
```bash
npx vercel
```

### Opção 2: GitHub + Vercel Dashboard
1. Suba o projeto para o GitHub:
   ```bash
   git init
   git add .
   git commit -m "feat: quiz idomed integrado com supabase"
   git branch -M main
   git remote add origin <url-do-repositorio>
   git push -u origin main
   ```
2. No painel da Vercel ([vercel.com](https://vercel.com)), clique em **Add New Project** e importe o repositório.
3. Não são necessários comandos de build (é um projeto estático ultra-rápido otimizado para Edge CDN). Clique em **Deploy**.
