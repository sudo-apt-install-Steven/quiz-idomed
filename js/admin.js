/**
 * Painel Administrativo de Pesquisa - IDOMED FAMEJIPA
 * Gerencia autenticação via Supabase Auth, renderização de métricas e gráficos,
 * paginação de respostas, exportação de CSV compatível com Excel e utilitário QR Code.
 */

(function() {
  'use strict';

  const config = window.APP_CONFIG;
  const questions = window.QUIZ_QUESTIONS;

  // Estado Local
  let authToken = sessionStorage.getItem("idomed_admin_token") || null;
  let cachedData = [];
  let currentPage = 1;
  const rowsPerPage = 10;
  let searchQuery = "";

  // Elementos do DOM
  const elLoginBox = document.getElementById("loginPanel");
  const elLoginForm = document.getElementById("loginForm");
  const elLoginError = document.getElementById("loginErrorAlert");
  const elDashboard = document.getElementById("dashboardPanel");
  const elNavActions = document.getElementById("navActions");
  const elTotalCount = document.getElementById("totalResponsesCount");
  const elQuestionsGrid = document.getElementById("questionsChartGrid");
  const elTableBody = document.getElementById("responsesTableBody");
  const elTablePagination = document.getElementById("tablePagination");
  const elSearchInput = document.getElementById("tableSearchInput");

  // Modal QR Code
  const elQrModal = document.getElementById("qrModal");
  const elQrInput = document.getElementById("qrTargetUrl");
  const elQrCanvas = document.getElementById("qrCanvasPreview");

  /**
   * Inicialização
   */
  function init() {
    setupEventListeners();

    if (authToken) {
      loadDashboardData();
    } else {
      showLoginScreen();
    }
  }

  function setupEventListeners() {
    elLoginForm.addEventListener("submit", handleLoginSubmit);
    if (elSearchInput) {
      elSearchInput.addEventListener("input", (e) => {
        searchQuery = e.target.value.toLowerCase().trim();
        currentPage = 1;
        renderTableRows();
      });
    }
  }

  function showLoginScreen() {
    elDashboard.style.display = "none";
    elNavActions.style.display = "none";
    elLoginBox.style.display = "block";
  }

  function showDashboardScreen() {
    elLoginBox.style.display = "none";
    elDashboard.style.display = "block";
    elNavActions.style.display = "flex";
  }

  /**
   * Autenticação Segura via Supabase Auth
   */
  async function handleLoginSubmit(e) {
    e.preventDefault();
    const email = document.getElementById("inputAdminEmail").value.trim();
    const password = document.getElementById("inputAdminPassword").value;
    const btnSubmit = elLoginForm.querySelector("button[type='submit']");

    elLoginError.style.display = "none";
    btnSubmit.disabled = true;
    btnSubmit.textContent = "Verificando credenciais...";

    try {
      const response = await fetch(`${config.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: {
          "apikey": config.SUPABASE_ANON_KEY,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error_description || data.msg || "Credenciais de acesso incorretas.");
      }

      authToken = data.access_token;
      sessionStorage.setItem("idomed_admin_token", authToken);
      showDashboardScreen();
      loadDashboardData();

    } catch (err) {
      elLoginError.textContent = err.message;
      elLoginError.style.display = "block";
    } finally {
      btnSubmit.disabled = false;
      btnSubmit.textContent = "Acessar Painel";
    }
  }

  /**
   * Encerra a Sessão Administrativa
   */
  window.handleLogout = function() {
    sessionStorage.removeItem("idomed_admin_token");
    authToken = null;
    cachedData = [];
    showLoginScreen();
  };

  /**
   * Carrega Respostas do Banco de Dados com Validação RLS
   */
  window.loadDashboardData = async function() {
    if (!authToken) {
      showLoginScreen();
      return;
    }

    showDashboardScreen();

    try {
      const res = await fetch(`${config.SUPABASE_URL}${config.SUPABASE_REST_TABLE}?select=*&order=created_at.desc`, {
        headers: {
          "apikey": config.SUPABASE_ANON_KEY,
          "Authorization": `Bearer ${authToken}`
        }
      });

      if (res.status === 401 || res.status === 403) {
        window.handleLogout();
        return;
      }

      cachedData = await res.json();
      renderDashboardOverview();
      renderTableRows();

    } catch (err) {
      console.error("Falha ao consultar respostas no Supabase:", err);
    }
  };

  /**
   * Renderiza os Gráficos Estatísticos das 10 Perguntas
   */
  function renderDashboardOverview() {
    const total = cachedData.length;
    elTotalCount.textContent = total;

    elQuestionsGrid.innerHTML = "";

    if (total === 0) {
      elQuestionsGrid.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 40px; text-align: center; color: var(--color-text-muted);">
          Nenhuma resposta registrada até o momento no banco de dados.
        </div>
      `;
      return;
    }

    questions.forEach(q => {
      // Contagem para cada alternativa definida
      const counts = {};
      q.options.forEach(opt => counts[opt] = 0);

      cachedData.forEach(row => {
        const val = row[q.field];
        if (val && counts[val] !== undefined) {
          counts[val]++;
        } else if (val) {
          counts[val] = (counts[val] || 0) + 1;
        }
      });

      const card = document.createElement("div");
      card.className = "q-stat-card";

      let barsHtml = "";
      Object.keys(counts).forEach(optionLabel => {
        const count = counts[optionLabel];
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;

        barsHtml += `
          <div class="chart-item">
            <div class="chart-labels">
              <span>${optionLabel}</span>
              <strong>${count} (${pct}%)</strong>
            </div>
            <div class="chart-track">
              <div class="chart-fill" style="width: ${pct}%"></div>
            </div>
          </div>
        `;
      });

      card.innerHTML = `
        <h3 class="q-stat-title">${q.id}. ${q.q}</h3>
        <div class="chart-bar-group">
          ${barsHtml}
        </div>
      `;

      elQuestionsGrid.appendChild(card);
    });
  }

  /**
   * Renderiza a Tabela com Paginação e Busca
   */
  function renderTableRows() {
    let filtered = cachedData;

    if (searchQuery) {
      filtered = cachedData.filter(row => {
        return Object.values(row).some(val => 
          typeof val === "string" && val.toLowerCase().includes(searchQuery)
        );
      });
    }

    const totalRows = filtered.length;
    const totalPages = Math.ceil(totalRows / rowsPerPage) || 1;

    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const startIdx = (currentPage - 1) * rowsPerPage;
    const endIdx = startIdx + rowsPerPage;
    const currentRows = filtered.slice(startIdx, endIdx);

    elTableBody.innerHTML = "";

    if (currentRows.length === 0) {
      elTableBody.innerHTML = `
        <tr>
          <td colspan="11" style="text-align: center; padding: 24px; color: var(--color-text-muted);">
            Nenhum registro encontrado.
          </td>
        </tr>
      `;
    } else {
      currentRows.forEach(row => {
        const tr = document.createElement("tr");
        const formattedDate = row.created_at 
          ? new Date(row.created_at).toLocaleString("pt-BR") 
          : "-";

        tr.innerHTML = `
          <td><strong>${formattedDate}</strong></td>
          <td>${row.q1_faixa_etaria || "-"}</td>
          <td>${row.q2_contato_vape || "-"}</td>
          <td>${row.q3_idade_primeiro_contato || "-"}</td>
          <td>${row.q4_dispositivo_popular || "-"}</td>
          <td>${row.q5_atrativo_principal || "-"}</td>
          <td>${row.q6_amigos_usam || "-"}</td>
          <td>${row.q7_forma_acesso || "-"}</td>
          <td>${row.q8_frequencia_escola || "-"}</td>
          <td>${row.q9_percepcao_risco || "-"}</td>
          <td>${row.q10_dialogo_prevencao || "-"}</td>
        `;
        elTableBody.appendChild(tr);
      });
    }

    renderPaginationControls(totalRows, totalPages);
  }

  /**
   * Controles de Paginação
   */
  function renderPaginationControls(totalRows, totalPages) {
    elTablePagination.innerHTML = "";

    if (totalRows <= rowsPerPage) return;

    const btnPrev = document.createElement("button");
    btnPrev.className = "btn-action secondary";
    btnPrev.textContent = "← Anterior";
    btnPrev.disabled = (currentPage === 1);
    btnPrev.onclick = () => { currentPage--; renderTableRows(); };

    const pageIndicator = document.createElement("span");
    pageIndicator.style.fontSize = "0.85rem";
    pageIndicator.style.fontWeight = "600";
    pageIndicator.style.color = "var(--color-text-muted)";
    pageIndicator.textContent = `Página ${currentPage} de ${totalPages} (${totalRows} registros)`;

    const btnNext = document.createElement("button");
    btnNext.className = "btn-action secondary";
    btnNext.textContent = "Próxima →";
    btnNext.disabled = (currentPage === totalPages);
    btnNext.onclick = () => { currentPage++; renderTableRows(); };

    elTablePagination.appendChild(btnPrev);
    elTablePagination.appendChild(pageIndicator);
    elTablePagination.appendChild(btnNext);
  }

  /**
   * Exporta Dados Completos para CSV (Compatível com Excel/Google Sheets)
   */
  window.exportResponsesCSV = function() {
    if (cachedData.length === 0) {
      alert("Não há dados cadastrados para exportação.");
      return;
    }

    const headers = [
      "ID",
      "Data/Hora (UTC)",
      "1. Faixa Etária e Ano Escolar",
      "2. Contato com Cigarro Eletrônico",
      "3. Idade do Primeiro Contato",
      "4. Dispositivo Mais Popular",
      "5. Atrativo Principal",
      "6. Amigos Próximos que Usam",
      "7. Forma de Aquisição",
      "8. Frequência ao Redor da Escola",
      "9. Grau de Risco Percebido",
      "10. Diálogo com Escola ou Família"
    ];

    const rows = cachedData.map(r => [
      `"${r.id || ""}"`,
      `"${r.created_at || ""}"`,
      `"${(r.q1_faixa_etaria || "").replace(/"/g, '""')}"`,
      `"${(r.q2_contato_vape || "").replace(/"/g, '""')}"`,
      `"${(r.q3_idade_primeiro_contato || "").replace(/"/g, '""')}"`,
      `"${(r.q4_dispositivo_popular || "").replace(/"/g, '""')}"`,
      `"${(r.q5_atrativo_principal || "").replace(/"/g, '""')}"`,
      `"${(r.q6_amigos_usam || "").replace(/"/g, '""')}"`,
      `"${(r.q7_forma_acesso || "").replace(/"/g, '""')}"`,
      `"${(r.q8_frequencia_escola || "").replace(/"/g, '""')}"`,
      `"${(r.q9_percepcao_risco || "").replace(/"/g, '""')}"`,
      `"${(r.q10_dialogo_prevencao || "").replace(/"/g, '""')}"`
    ]);

    // Adiciona BOM (Byte Order Mark) UTF-8 para Excel abrir sem corromper acentos
    const csvContent = "\uFEFF" + [headers.join(";"), ...rows.map(row => row.join(";"))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const today = new Date().toISOString().slice(0, 10);
    link.setAttribute("href", url);
    link.setAttribute("download", `pesquisa_vape_idomed_famejipa_${today}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  /**
   * Modal do Utilitário de QR Code
   */
  window.openQrModal = function() {
    const defaultUrl = window.location.origin;
    elQrInput.value = defaultUrl;
    renderQrCodePreview();
    elQrModal.style.display = "flex";
  };

  window.closeQrModal = function() {
    elQrModal.style.display = "none";
  };

  window.renderQrCodePreview = function() {
    const url = elQrInput.value.trim();
    if (!url || !window.QRCodeGenerator) return;

    window.QRCodeGenerator.renderCanvas(elQrCanvas, url, {
      size: 260,
      margin: 4
    });
  };

  window.downloadQrPNG = function() {
    const link = document.createElement("a");
    link.download = "qrcode_pesquisa_idomed.png";
    link.href = elQrCanvas.toDataURL("image/png");
    link.click();
  };

  window.downloadQrSVG = function() {
    const url = elQrInput.value.trim();
    if (!url || !window.QRCodeGenerator) return;

    const svgContent = window.QRCodeGenerator.generateSVG(url, { size: 300, margin: 4 });
    const blob = new Blob([svgContent], { type: "image/svg+xml;charset=utf-8;" });
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.download = "qrcode_pesquisa_idomed.svg";
    link.href = downloadUrl;
    link.click();
    URL.revokeObjectURL(downloadUrl);
  };

  // Inicializa o script
  init();
})();
