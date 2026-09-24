# Pesquisa Acadêmica sobre Vape/Pod — IDOMED FAMEJIPA

Aplicação web completa, moderna, responsiva e segura desenvolvida para a **Faculdade de Medicina de Ji-Paraná (IDOMED / FAMEJIPA)** com o objetivo de mapear percepções e hábitos de estudantes em relação ao uso de cigarros eletrônicos (vapes e pods).

---

## 🔒 Princípios de Privacidade e Anonimato Absoluto
- **Zero Coleta de Dados Pessoais:** O questionário não solicita nem registra nome, e-mail, telefone, endereço, login ou identificação pessoal.
- **Isolamento de Rastreadores:** Nenhum endereço IP, fingerprinting ou metadado de navegação é armazenado.
- **Idempotência Segura:** O controle anti-duplo clique utiliza um token criptográfico efêmero gerado no momento do envio (`submission_token` UUID v4), garantindo integridade sem qualquer identificação do respondente.

---

## 🏛️ Conteúdo Oficial do Questionário
As **10 perguntas e suas respectivas alternativas originais foram rigorosamente preservadas** em ordem, texto e estrutura:
1. *Qual é a sua idade e ano escolar?*
2. *Você já teve contato com cigarro eletrônico (vape/pod)?*
3. *Com qual idade ocorreu o primeiro contato?*
4. *Qual dispositivo é mais popular entre o seu grupo?*
5. *O que mais atrai a atenção dos jovens para testar?*
6. *Quantos dos seus amigos mais próximos usam vape?*
7. *Como a maioria dos jovens consegue esses produtos?*
8. *Com que frequência você vê uso de vape ao redor da escola?*
9. *Qual o grau de risco do vape comparado ao cigarro tradicional?*
10. *Você já teve conversas sobre os riscos com a escola ou família?*

---

## ⚙️ Arquitetura do Sistema

```text
       [ ESTUDANTE / PARTICIPANTE ]
                     │ (Acesso Mobile / Desktop / QR Code)
                     ▼
         [ Frontend: index.html ]
                     │
           ┌─────────┴─────────┐
           │ (Submissão)       │ (Fallback Direto)
           ▼                   ▼
   [ /api/submit ]     [ Supabase RPC ]
   (Vercel Serverless)         │
           │                   │
           └─────────┬─────────┘
                     ▼
     [ PostgreSQL 17 (Supabase) ]
       • CHECK Constraints nas 10 perguntas
       • Controle de Idempotência (UUID)
       • Row Level Security (RLS Ativo)
       • Leitura Pública: BLOQUEADA (0 registros)
                     ▲
                     │ (Autenticação JWT)
         [ Frontend: /admin ]
     (Dashboard com Gráficos, Tabela, CSV & QR Code)
```

---

## 🛡️ Segurança no Banco de Dados (Supabase & PostgreSQL)

### 1. Validação em Nível de Banco de Dados (CHECK Constraints)
Cada uma das 10 colunas possui uma restrição `CHECK` formal no PostgreSQL. Qualquer tentativa de enviar textos arbitrários, opções inexistentes ou campos maliciosos é rejeitada pelo banco (`SQLSTATE 23514`).

### 2. Políticas de Row Level Security (RLS)
- **Inserção Pública:** Permitida para qualquer visitante anônimo registrar suas respostas.
- **Leitura Pública:** Estritamente bloqueada. Visitantes anônimos que tentarem consultar a API recebem `[]` (0 registros).
- **Modificação / Exclusão:** Bloqueadas para usuários anônimos.
- **Acesso Administrativo:** Somente pesquisadores autenticados via Supabase Auth possuem acesso de leitura.

---

## 💻 Estrutura de Arquivos

```text
Quiz IDOMED/
├── api/
│   ├── submit.js          # Endpoint serverless de validação e submissão
│   └── health.js          # Verificação de status e saúde da API
├── css/
│   ├── main.css           # Design system, tipografia, resets e acessibilidade
│   ├── quiz.css           # Interface do quiz, transições e microinterações
│   └── admin.css          # Estilos do painel, métricas, gráficos e modais
├── js/
│   ├── config.js          # Configurações públicas (Supabase URL e Anon Key)
│   ├── quiz-data.js       # Fonte da verdade das 10 perguntas e alternativas
│   ├── quiz.js            # Lógica do questionário, atalhos e envio resiliente
│   ├── admin.js           # Lógica do dashboard, gráficos, paginação e exportação
│   └── qrcode-lib.js      # Gerador autônomo de QR Code (PNG e SVG vetorial)
├── index.html             # Ponto de entrada do Quiz público
├── admin.html             # Ponto de entrada do Painel Administrativo (/admin)
├── vercel.json            # Roteamento limpo e cabeçalhos de segurança HTTP
├── .env.example           # Modelo de variáveis de ambiente sem segredos
├── .gitignore             # Arquivos ignorados pelo Git
└── README.md              # Documentação completa
```

---

## 🚀 Como Executar Localmente

Como a aplicação é estruturada com HTML5, CSS3 e JavaScript modular nativo:
1. Abra a pasta do projeto no VS Code ou terminal.
2. Inicie qualquer servidor HTTP local (ex: extensão *Live Server* ou `npx serve .`).
3. Acesse `http://localhost:3000` para o quiz ou `http://localhost:3000/admin.html` para o painel administrativo.

---

## ☁️ Publicação na Vercel

1. Suba as alterações para o seu repositório no GitHub:
   ```bash
   git push origin main
   ```
2. Acesse [vercel.com](https://vercel.com) e importe o repositório `quiz-idomed`.
3. Não são necessárias configurações de compilação adicionais (Framework Preset: **Other**).
4. Clique em **Deploy**.

---

## 📱 Como Gerar o QR Code para Divulgação
1. Acesse o painel em `/admin` e faça login.
2. Clique no botão **"📱 Gerar QR Code"** na barra superior.
3. A URL pública da aplicação será preenchida automaticamente (ou informe o domínio customizado).
4. Baixe em **PNG** (para redes sociais/documentos) ou **SVG Vetorial** (para cartazes e faixas em alta resolução com contraste ideal).

---

## 📊 Exportação de Dados para Pesquisa
No painel `/admin`, clique em **"📥 Exportar CSV"**. O arquivo gerado inclui:
- Cabeçalhos descritivos para cada uma das 10 perguntas.
- Marcação de ordem de bytes (**UTF-8 BOM**), garantindo que acentos e caracteres especiais abram perfeitamente no **Microsoft Excel**, **Google Sheets**, **SPSS** e **Jamovi**.
