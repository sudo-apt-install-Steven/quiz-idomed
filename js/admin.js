/**
 * Painel Administrativo de Pesquisa - IDOMED FAMEJIPA
 * Gestão de Dados, Estatísticas Epidemiológicas, Gráficos Interativos (Chart.js),
 * Cruzamentos Multifatoriais, Filtros Dinâmicos, Exportação CSV e Utilitário QR Code.
 */

(function() {
  'use strict';

  const config = window.APP_CONFIG;
  const questions = window.QUIZ_QUESTIONS;

  // Estado Local
  let authToken = sessionStorage.getItem("idomed_admin_token") || null;
  let cachedData = [];
  let filteredData = [];
  let currentPage = 1;
  const rowsPerPage = 10;
  let searchQuery = "";

  // Filtros Ativos
  let filterAge = "ALL";
  let filterSchoolYear = "ALL";
  let filterContact = "ALL";

  // Registro de Instâncias do Chart.js para destruição segura ao re-renderizar
  const chartInstances = {};

  // Elementos do DOM
  const elLoginBox = document.getElementById("loginPanel");
  const elLoginForm = document.getElementById("loginForm");
  const elLoginError = document.getElementById("loginErrorAlert");
  const elDashboard = document.getElementById("dashboardPanel");
  const elNavActions = document.getElementById("navActions");

  // KPIs
  const elTotalCount = document.getElementById("totalResponsesCount");
  const elKpiExperimentationRate = document.getElementById("kpiExperimentationRate");
  const elKpiExperimentationSub = document.getElementById("kpiExperimentationSub");
  const elKpiActiveUsageRate = document.getElementById("kpiActiveUsageRate");
  const elKpiActiveUsageSub = document.getElementById("kpiActiveUsageSub");
  const elKpiTopDevice = document.getElementById("kpiTopDevice");
  const elKpiHighRiskRate = document.getElementById("kpiHighRiskRate");
  const elKpiSchoolExposureRate = document.getElementById("kpiSchoolExposureRate");
  const elFilterStatusBadge = document.getElementById("filterStatusBadge");
  const elInsightsContent = document.getElementById("insightsContent");

  // Gráficos e Tabela
  const elQuestionsGrid = document.getElementById("questionsChartGrid");
  const elTableBody = document.getElementById("responsesTableBody");
  const elTablePagination = document.getElementById("tablePagination");
  const elSearchInput = document.getElementById("tableSearchInput");
  const elTableResultCount = document.getElementById("tableResultCount");

  // Modal QR Code
  const elQrModal = document.getElementById("qrModal");
  const elQrInput = document.getElementById("qrTargetUrl");
  const elQrCanvas = document.getElementById("qrCanvasPreview");

  // Paleta de Cores Acadêmica para os Gráficos (Claro & Escuro)
  const LIGHT_PALETTE = [
    '#003b71', // Azul Marinho IDOMED
    '#00a896', // Verde Cirúrgico Teal
    '#02c39a', // Acento Esmeralda
    '#f59e0b', // Âmbar / Alerta
    '#f43f5e', // Rosa Coral
    '#8b5cf6', // Violeta
    '#64748b'  // Cinza Ardósia
  ];

  const DARK_PALETTE = [
    '#38bdf8', // Azul Celeste IDOMED (Alto contraste)
    '#14b8a6', // Verde Cirúrgico Teal Límpido
    '#34d399', // Acento Esmeralda
    '#fbbf24', // Âmbar Fluorescente
    '#fb7185', // Rosa Coral Límpido
    '#a78bfa', // Violeta Suave
    '#94a3b8'  // Cinza Ardósia Claro
  ];

  function getPalette() {
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    return isDark ? DARK_PALETTE : LIGHT_PALETTE;
  }

  /**
   * Sanitização estrita contra XSS para inserções no DOM
   */
  function escapeHTML(str) {
    if (str === null || str === undefined) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  /**
   * Sanitização de células CSV contra CSV Formula Injection (DDE)
   */
  function sanitizeCSVCell(val) {
    if (val === null || val === undefined) return '""';
    let str = String(val);
    if (/^[=+\-@\t\r]/.test(str)) {
      str = "'" + str;
    }
    return `"${str.replace(/"/g, '""')}"`;
  }

  // Elementos do Botão de Alternância de Tema
  const elThemeToggleBtn = document.getElementById("themeToggleBtn");
  const elThemeToggleIcon = document.getElementById("themeToggleIcon");
  const elThemeToggleLabel = document.getElementById("themeToggleLabel");

  /**
   * Atualiza configurações visuais do Chart.js conforme o tema ativo
   */
  function updateChartTheme(theme) {
    const isDark = (theme === "dark");
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute("content", isDark ? "#0a1120" : "#003b71");
    }

    if (typeof Chart === "undefined") return;
    Chart.defaults.color = isDark ? '#94a3b8' : '#64748b';
    Chart.defaults.borderColor = isDark ? 'rgba(30, 51, 90, 0.6)' : '#e2e8f0';
    if (filteredData && filteredData.length > 0) {
      renderComparisonCharts();
      renderDetailedQuestionCharts();
    }
  }

  /**
   * Gerenciamento de Tema (Claro / Escuro) com persistência em Cookie e LocalStorage
   */
  function initThemeManager() {
    function getSavedTheme() {
      try {
        const cookieMatch = document.cookie.match(/(?:^|;\s*)idomed_theme=([^;]+)/);
        if (cookieMatch) return (decodeURIComponent(cookieMatch[1]) === "dark") ? "dark" : "light";
        const storageTheme = localStorage.getItem("idomed_theme");
        if (storageTheme) return (storageTheme === "dark") ? "dark" : "light";
      } catch (_) {}
      return "light";
    }

    function applyTheme(theme) {
      document.documentElement.setAttribute("data-theme", theme);
      try {
        localStorage.setItem("idomed_theme", theme);
        document.cookie = "idomed_theme=" + encodeURIComponent(theme) + "; path=/; max-age=31536000; SameSite=Lax";
      } catch (_) {}
      updateToggleUI(theme);
      updateChartTheme(theme);
    }

    function updateToggleUI(theme) {
      if (!elThemeToggleBtn) return;
      const isDark = (theme === "dark");
      if (elThemeToggleIcon) {
        elThemeToggleIcon.innerHTML = isDark
          ? `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`
          : `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
      }
      if (elThemeToggleLabel) {
        elThemeToggleLabel.textContent = isDark ? "Tema Claro" : "Tema Escuro";
      }
      elThemeToggleBtn.setAttribute("aria-label", isDark ? "Alternar para Tema Claro" : "Alternar para Tema Escuro");
      elThemeToggleBtn.setAttribute("title", isDark ? "Ativar Modo Claro" : "Ativar Modo Escuro");
    }

    const initialTheme = document.documentElement.getAttribute("data-theme") || getSavedTheme();
    applyTheme(initialTheme);

    if (elThemeToggleBtn) {
      elThemeToggleBtn.addEventListener("click", () => {
        const current = document.documentElement.getAttribute("data-theme") || "light";
        const nextTheme = current === "dark" ? "light" : "dark";
        applyTheme(nextTheme);
      });
    }
  }

  /**
   * Inicialização do Painel
   */
  function init() {
    initThemeManager();
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
    filteredData = [];
    destroyAllCharts();
    showLoginScreen();
  };

  /**
   * Consulta Respostas no Supabase
   */
  window.loadDashboardData = async function() {
    if (!authToken) {
      showLoginScreen();
      return;
    }

    showDashboardScreen();

    const btnRefresh = document.getElementById("btnRefreshData");
    if (btnRefresh) {
      btnRefresh.classList.add("loading");
      btnRefresh.disabled = true;
    }

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

      if (!res.ok) {
        throw new Error(`Falha no banco de dados (${res.status})`);
      }

      const data = await res.json();
      cachedData = Array.isArray(data) ? data : [];
      applyFilters();

    } catch (err) {
      console.error("Falha ao consultar respostas no Supabase:", err);
      cachedData = [];
      applyFilters();
    } finally {
      if (btnRefresh) {
        btnRefresh.classList.remove("loading");
        btnRefresh.disabled = false;
      }
    }
  };

  /**
   * Aplica Filtros e Recalcula Todas as Estatísticas
   */
  window.applyFilters = function() {
    filterAge = document.getElementById("filterAge").value;
    const elSchoolYear = document.getElementById("filterSchoolYear");
    filterSchoolYear = elSchoolYear ? elSchoolYear.value : "ALL";
    filterContact = document.getElementById("filterContact").value;

    filteredData = cachedData.filter(row => {
      // Filtro por Idade
      if (filterAge !== "ALL" && row.q1_faixa_etaria !== filterAge) {
        return false;
      }

      // Filtro por Ano Escolar
      if (filterSchoolYear !== "ALL" && row.q1_ano_escolar !== filterSchoolYear) {
        return false;
      }

      // Filtro por Contato com Vape
      if (filterContact === "NEVER" && row.q2_contato_vape !== "Nunca experimentei") {
        return false;
      }
      if (filterContact === "EXPERIENCED" && row.q2_contato_vape === "Nunca experimentei") {
        return false;
      }
      if (filterContact === "FREQUENT" && row.q2_contato_vape !== "Uso frequentemente") {
        return false;
      }

      return true;
    });

    const isFiltered = (filterAge !== "ALL" || filterSchoolYear !== "ALL" || filterContact !== "ALL");
    elFilterStatusBadge.textContent = isFiltered
      ? `Filtrado: ${filteredData.length} de ${cachedData.length} registros`
      : `Exibindo todos os ${cachedData.length} registros`;

    currentPage = 1;
    renderKPIs();
    renderExecutiveInsights();
    renderComparisonCharts();
    renderDetailedQuestionCharts();
    renderTableRows();
  };

  window.resetFilters = function() {
    document.getElementById("filterAge").value = "ALL";
    const elSchoolYear = document.getElementById("filterSchoolYear");
    if (elSchoolYear) elSchoolYear.value = "ALL";
    document.getElementById("filterContact").value = "ALL";
    applyFilters();
  };

  /**
   * Renderiza os 6 Cards de Indicadores Epidemiológicos (KPIs)
   */
  function renderKPIs() {
    const total = filteredData.length;
    elTotalCount.textContent = total;

    if (total === 0) {
      elKpiExperimentationRate.textContent = "0%";
      elKpiActiveUsageRate.textContent = "0%";
      elKpiTopDevice.textContent = "-";
      elKpiHighRiskRate.textContent = "0%";
      elKpiSchoolExposureRate.textContent = "0%";
      return;
    }

    // 1. Taxa de Experimentação
    const experiencedCount = filteredData.filter(r => r.q2_contato_vape && r.q2_contato_vape !== "Nunca experimentei").length;
    const expRate = Math.round((experiencedCount / total) * 100);
    elKpiExperimentationRate.textContent = `${expRate}%`;
    elKpiExperimentationSub.textContent = `${experiencedCount} de ${total} participantes`;

    // 2. Uso Ativo (Frequente + Ocasional)
    const activeCount = filteredData.filter(r => 
      r.q2_contato_vape === "Uso frequentemente" || r.q2_contato_vape === "Uso ocasionalmente"
    ).length;
    const activeRate = Math.round((activeCount / total) * 100);
    elKpiActiveUsageRate.textContent = `${activeRate}%`;
    elKpiActiveUsageSub.textContent = `${activeCount} usuários ativos`;

    // 3. Dispositivo Líder (exclui respostas de não aplicabilidade para capturar o modelo líder real)
    const deviceCounts = {};
    filteredData.forEach(r => {
      const dev = r.q4_dispositivo_popular;
      if (dev && dev !== "Não se aplica / Nunca usei" && dev !== "Não sei a diferença") {
        deviceCounts[dev] = (deviceCounts[dev] || 0) + 1;
      }
    });
    let topDevice = "-";
    let maxDeviceCount = 0;
    Object.keys(deviceCounts).forEach(dev => {
      if (deviceCounts[dev] > maxDeviceCount) {
        maxDeviceCount = deviceCounts[dev];
        topDevice = dev;
      }
    });
    if (topDevice === "-" && total > 0) {
      topDevice = "Sem uso ativo relatado";
    }
    elKpiTopDevice.textContent = topDevice;

    // 4. Percepção de Alto Risco (Tão ou Mais prejudicial)
    const highRiskCount = filteredData.filter(r => 
      r.q9_percepcao_risco === "Tão prejudicial quanto" || r.q9_percepcao_risco === "Mais prejudicial"
    ).length;
    const highRiskRate = Math.round((highRiskCount / total) * 100);
    elKpiHighRiskRate.textContent = `${highRiskRate}%`;

    // 5. Exposição Escolar (Diariamente ou Às vezes)
    const schoolExposureCount = filteredData.filter(r => 
      r.q8_frequencia_escola === "Diariamente / É muito comum" || r.q8_frequencia_escola === "Às vezes"
    ).length;
    const schoolExposureRate = Math.round((schoolExposureCount / total) * 100);
    elKpiSchoolExposureRate.textContent = `${schoolExposureRate}%`;
  }

  /**
   * Gera Síntese Científica / Executive Summary com Base nos Dados Reais
   */
  function renderExecutiveInsights() {
    const total = filteredData.length;
    if (total === 0) {
      elInsightsContent.innerHTML = "Aguardando submissão de respostas pelos participantes para processar a síntese.";
      return;
    }

    const experienced = filteredData.filter(r => r.q2_contato_vape && r.q2_contato_vape !== "Nunca experimentei").length;
    const expPct = Math.round((experienced / total) * 100);

    const earlyContact = filteredData.filter(r => 
      r.q3_idade_primeiro_contato === "Menos de 12 anos" || r.q3_idade_primeiro_contato === "12 a 13 anos" || r.q3_idade_primeiro_contato === "14 a 15 anos"
    ).length;
    const earlyPct = experienced > 0 ? Math.round((earlyContact / experienced) * 100) : 0;

    // Atrativo mais comum (filtrando 'Não se aplica / Nunca usei' para obter a motivação real)
    const atrativoCounts = {};
    filteredData.forEach(r => {
      if (r.q5_atrativo_principal && r.q5_atrativo_principal !== "Não se aplica / Nunca usei") {
        atrativoCounts[r.q5_atrativo_principal] = (atrativoCounts[r.q5_atrativo_principal] || 0) + 1;
      }
    });
    const atrativoKeys = Object.keys(atrativoCounts);
    const topAtrativo = atrativoKeys.length > 0
      ? atrativoKeys.sort((a,b) => atrativoCounts[b] - atrativoCounts[a])[0]
      : "Nenhum atrativo apontado (sem uso ativo)";

    // Fonte de aquisição (filtrando 'Não se aplica / Nunca usei')
    const acessoCounts = {};
    filteredData.forEach(r => {
      if (r.q7_forma_acesso && r.q7_forma_acesso !== "Não se aplica / Nunca usei") {
        acessoCounts[r.q7_forma_acesso] = (acessoCounts[r.q7_forma_acesso] || 0) + 1;
      }
    });
    const acessoKeys = Object.keys(acessoCounts);
    const topAcesso = acessoKeys.length > 0
      ? acessoKeys.sort((a,b) => acessoCounts[b] - acessoCounts[a])[0]
      : "Sem aquisição relatada (amostra sem uso)";

    // Diálogo
    const noDialogue = filteredData.filter(r => r.q10_dialogo_prevencao === "Nunca conversei sobre isso").length;
    const noDialoguePct = Math.round((noDialogue / total) * 100);

    elInsightsContent.innerHTML = `
      <p>Com base na amostra de <strong>${total} respondentes</strong> analisada pelo Observatório IDOMED FAMEJIPA:</p>
      <ul>
        <li><strong>Prevalência Geral:</strong> <strong>${expPct}%</strong> dos estudantes relatam já ter experimentado ou fazer uso ativo de cigarros eletrônicos (vape/pod).</li>
        <li><strong>Idade de Iniciação Precoce:</strong> Entre os que já tiveram contato com o dispositivo, <strong>${earlyPct}%</strong> experimentaram antes dos 15 anos de idade.</li>
        <li><strong>Fator Atrativo Predominante:</strong> A principal motivação apontada para o primeiro contato é <em>"${escapeHTML(topAtrativo)}"</em>.</li>
        <li><strong>Cadeia de Fornecimento:</strong> A forma mais expressiva de acesso aos dispositivos entre os jovens é através de <em>"${escapeHTML(topAcesso)}"</em>.</li>
        <li><strong>Lacuna de Comunicação Preventiva:</strong> <strong>${noDialoguePct}%</strong> dos estudantes apontam que <em>nunca tiveram conversas</em> sobre os riscos associados ao vape na escola ou em casa.</li>
      </ul>
    `;
  }

  /**
   * Destrói Gráficos do Chart.js com Segurança
   */
  function destroyChart(chartId) {
    if (chartInstances[chartId]) {
      chartInstances[chartId].destroy();
      delete chartInstances[chartId];
    }
  }

  function destroyAllCharts() {
    Object.keys(chartInstances).forEach(id => destroyChart(id));
  }

  function ensureCanvas(containerId, canvasId) {
    const container = document.getElementById(containerId);
    if (!container) return null;
    let canvas = document.getElementById(canvasId);
    if (!canvas) {
      container.innerHTML = `<canvas id="${canvasId}"></canvas>`;
      canvas = document.getElementById(canvasId);
    }
    return canvas;
  }

  function showChartEmptyState(containerId, message) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = `
      <div class="chart-empty-state">
        <svg class="empty-state-svg" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <line x1="18" y1="20" x2="18" y2="10"></line>
          <line x1="12" y1="20" x2="12" y2="4"></line>
          <line x1="6" y1="20" x2="6" y2="14"></line>
        </svg>
        <span class="empty-state-msg">${escapeHTML(message || "Aguardando respostas para este cruzamento")}</span>
      </div>
    `;
  }

  /**
   * Renderiza os Gráficos de Cruzamentos Estatísticos (Comparações)
   */
  function renderComparisonCharts() {
    if (typeof Chart === "undefined") return;

    const total = filteredData.length;
    if (total === 0) {
      destroyChart("chartAgeVsUsage");
      destroyChart("chartRiskVsUsage");
      destroyChart("chartPeerInfluence");
      destroyChart("chartDialogueVsUsage");
      showChartEmptyState("wrap_chartAgeVsUsage", "Aguardando respostas para correlacionar Idade vs Uso");
      showChartEmptyState("wrap_chartRiskVsUsage", "Aguardando respostas para correlacionar Percepção de Risco vs Uso");
      showChartEmptyState("wrap_chartPeerInfluence", "Aguardando respostas para avaliar a Pressão de Pares");
      showChartEmptyState("wrap_chartDialogueVsUsage", "Aguardando respostas para avaliar o Diálogo Preventivo");
      return;
    }

    // 1. Idade vs Contato com Vape (Grouped Bar)
    renderChartAgeVsUsage();

    // 2. Percepção de Risco vs Uso Real (Grouped Bar)
    renderChartRiskVsUsage();

    // 3. Influência de Amigos vs Uso Pessoal (Doughnut/Bar)
    renderChartPeerInfluence();

    // 4. Diálogo Preventivo vs Contato (Bar)
    renderChartDialogueVsUsage();
  }

  function renderChartAgeVsUsage() {
    destroyChart("chartAgeVsUsage");
    const ctx = ensureCanvas("wrap_chartAgeVsUsage", "chartAgeVsUsage");
    if (!ctx) return;

    const ageGroups = ["14 a 15 anos", "16 a 17 anos", "18 anos"];
    const usageTypes = ["Nunca experimentei", "Já experimentei, mas não uso", "Uso ocasionalmente", "Uso frequentemente"];

    const currentPalette = getPalette();
    const datasets = usageTypes.map((usage, idx) => {
      return {
        label: usage,
        data: ageGroups.map(age => {
          return filteredData.filter(r => r.q1_faixa_etaria === age && r.q2_contato_vape === usage).length;
        }),
        backgroundColor: currentPalette[idx % currentPalette.length]
      };
    });

    chartInstances["chartAgeVsUsage"] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ageGroups,
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } },
          tooltip: { mode: 'index', intersect: false }
        },
        scales: {
          x: { stacked: true, grid: { display: false } },
          y: { stacked: true, beginAtZero: true, ticks: { precision: 0 } }
        }
      }
    });
  }

  function renderChartRiskVsUsage() {
    destroyChart("chartRiskVsUsage");
    const ctx = ensureCanvas("wrap_chartRiskVsUsage", "chartRiskVsUsage");
    if (!ctx) return;

    const userCategories = ["Nunca usou", "Usuário Ativo / Ocasional"];
    const riskOptions = ["Muito menos prejudicial", "Um pouco menos prejudicial", "Tão prejudicial quanto", "Mais prejudicial"];

    const nonUsers = filteredData.filter(r => r.q2_contato_vape === "Nunca experimentei");
    const activeUsers = filteredData.filter(r => r.q2_contato_vape === "Uso ocasionalmente" || r.q2_contato_vape === "Uso frequentemente");

    const currentPalette = getPalette();
    const datasets = riskOptions.map((risk, idx) => {
      const nonUserCount = nonUsers.filter(r => r.q9_percepcao_risco === risk).length;
      const activeUserCount = activeUsers.filter(r => r.q9_percepcao_risco === risk).length;

      const nonUserPct = nonUsers.length > 0 ? Math.round((nonUserCount / nonUsers.length) * 100) : 0;
      const activeUserPct = activeUsers.length > 0 ? Math.round((activeUserCount / activeUsers.length) * 100) : 0;

      return {
        label: risk,
        data: [nonUserPct, activeUserPct],
        backgroundColor: currentPalette[(idx + 2) % currentPalette.length]
      };
    });

    chartInstances["chartRiskVsUsage"] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: userCategories,
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } },
          tooltip: {
            callbacks: {
              label: (context) => `${context.dataset.label}: ${context.raw}%`
            }
          }
        },
        scales: {
          y: { beginAtZero: true, max: 100, ticks: { callback: v => v + '%' } }
        }
      }
    });
  }

  function renderChartPeerInfluence() {
    destroyChart("chartPeerInfluence");
    const ctx = ensureCanvas("wrap_chartPeerInfluence", "chartPeerInfluence");
    if (!ctx) return;

    const peerCategories = ["Nenhum", "Poucos (1 ou 2)", "A maioria", "Todos"];

    // % de uso próprio conforme a quantidade de amigos usuários
    const userRates = peerCategories.map(cat => {
      const cohort = filteredData.filter(r => r.q6_amigos_usam === cat);
      if (cohort.length === 0) return 0;
      const usersInCohort = cohort.filter(r => r.q2_contato_vape !== "Nunca experimentei").length;
      return Math.round((usersInCohort / cohort.length) * 100);
    });

    chartInstances["chartPeerInfluence"] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: peerCategories,
        datasets: [{
          label: '% de Experimentação Pessoal',
          data: userRates,
          backgroundColor: '#00a896',
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context) => `Taxa de experimentação do grupo: ${context.raw}%`
            }
          }
        },
        scales: {
          x: { title: { display: true, text: 'Amigos mais próximos que usam vape' } },
          y: { beginAtZero: true, max: 100, ticks: { callback: v => v + '%' } }
        }
      }
    });
  }

  function renderChartDialogueVsUsage() {
    destroyChart("chartDialogueVsUsage");
    const ctx = ensureCanvas("wrap_chartDialogueVsUsage", "chartDialogueVsUsage");
    if (!ctx) return;

    const dialogues = ["Na escola e em casa", "Apenas na escola", "Apenas em casa", "Nunca conversei sobre isso"];

    const neverRates = dialogues.map(d => {
      const cohort = filteredData.filter(r => r.q10_dialogo_prevencao === d);
      if (cohort.length === 0) return 0;
      const neverCount = cohort.filter(r => r.q2_contato_vape === "Nunca experimentei").length;
      return Math.round((neverCount / cohort.length) * 100);
    });

    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    chartInstances["chartDialogueVsUsage"] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: dialogues,
        datasets: [{
          label: '% de Jovens que Nunca Experimentaram',
          data: neverRates,
          backgroundColor: isDark ? '#38bdf8' : '#003b71',
          borderRadius: 6
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context) => `Proteção (Nunca experimentaram): ${context.raw}%`
            }
          }
        },
        scales: {
          x: { beginAtZero: true, max: 100, ticks: { callback: v => v + '%' } }
        }
      }
    });
  }

  /**
   * Renderiza os Gráficos Detalhados e Mini-Tabelas das 10 Perguntas
   */
  function renderDetailedQuestionCharts() {
    const total = filteredData.length;
    elQuestionsGrid.innerHTML = "";

    if (total === 0) {
      elQuestionsGrid.innerHTML = `
        <div class="empty-state-card" style="grid-column: 1 / -1;">
          <div class="empty-state-icon">🔬</div>
          <h3 class="empty-state-title">Aguardando Respostas</h3>
          <p class="empty-state-desc">Nenhum registro foi encontrado com os filtros selecionados ou o observatório ainda não possui respostas enviadas.</p>
        </div>
      `;
      return;
    }

    questions.forEach(q => {
      // Contagem para cada alternativa definida
      const counts = {};
      q.options.forEach(opt => counts[opt] = 0);

      filteredData.forEach(row => {
        const val = row[q.field];
        if (val && counts[val] !== undefined) {
          counts[val]++;
        } else if (val) {
          counts[val] = (counts[val] || 0) + 1;
        }
      });

      const card = document.createElement("div");
      card.className = "q-stat-card";

      const canvasId = `chart_q_${q.id}`;
      const cardTitle = q.id === 1 ? '1A. Faixa Etária (Idade)' : `${q.id}. ${q.q}`;

      card.innerHTML = `
        <h3 class="q-stat-title">${cardTitle}</h3>
        <div class="q-chart-wrap">
          <canvas id="${canvasId}"></canvas>
        </div>
        <table class="freq-table">
          <thead>
            <tr>
              <th>Alternativa</th>
              <th style="text-align: right;">N</th>
              <th style="text-align: right;">%</th>
            </tr>
          </thead>
          <tbody id="tbody_${canvasId}"></tbody>
        </table>
      `;

      elQuestionsGrid.appendChild(card);

      // Preenche Mini Tabela de Frequência N e %
      const tbody = document.getElementById(`tbody_${canvasId}`);
      let maxCount = -1;
      let topOption = "";
      Object.keys(counts).forEach(opt => {
        if (counts[opt] > maxCount) {
          maxCount = counts[opt];
          topOption = opt;
        }
      });

      Object.keys(counts).forEach(opt => {
        const count = counts[opt];
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        const isTop = opt === topOption && count > 0;

        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${escapeHTML(opt)} ${isTop ? '<span class="badge-top">Líder</span>' : ''}</td>
          <td class="num">${count}</td>
          <td class="num">${pct}%</td>
        `;
        tbody.appendChild(tr);
      });

      // Renderiza Gráfico Chart.js (Doughnut ou Bar)
      renderQuestionChart(canvasId, q.options, counts);

      // Se for a Questão 1 e possuir opções de ano escolar, gera um card analítico dedicado
      if (q.id === 1 && q.schoolYearOptions) {
        const yearCounts = {};
        q.schoolYearOptions.forEach(opt => yearCounts[opt] = 0);

        filteredData.forEach(row => {
          const val = row.q1_ano_escolar;
          if (val && yearCounts[val] !== undefined) {
            yearCounts[val]++;
          } else if (val) {
            yearCounts[val] = (yearCounts[val] || 0) + 1;
          }
        });

        const yearCard = document.createElement("div");
        yearCard.className = "q-stat-card";
        const yearCanvasId = `chart_q_1_ano`;
        yearCard.innerHTML = `
          <h3 class="q-stat-title">1B. Ano Escolar (Distribuição)</h3>
          <div class="q-chart-wrap">
            <canvas id="${yearCanvasId}"></canvas>
          </div>
          <table class="freq-table">
            <thead>
              <tr>
                <th>Ano Escolar</th>
                <th style="text-align: right;">N</th>
                <th style="text-align: right;">%</th>
              </tr>
            </thead>
            <tbody id="tbody_${yearCanvasId}"></tbody>
          </table>
        `;
        elQuestionsGrid.appendChild(yearCard);

        const yearTbody = document.getElementById(`tbody_${yearCanvasId}`);
        let maxYearCount = -1;
        let topYearOption = "";
        Object.keys(yearCounts).forEach(opt => {
          if (yearCounts[opt] > maxYearCount) {
            maxYearCount = yearCounts[opt];
            topYearOption = opt;
          }
        });

        Object.keys(yearCounts).forEach(opt => {
          const count = yearCounts[opt];
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          const isTop = opt === topYearOption && count > 0;

          const tr = document.createElement("tr");
          tr.innerHTML = `
            <td>${escapeHTML(opt)} ${isTop ? '<span class="badge-top">Líder</span>' : ''}</td>
            <td class="num">${count}</td>
            <td class="num">${pct}%</td>
          `;
          yearTbody.appendChild(tr);
        });

        renderQuestionChart(yearCanvasId, q.schoolYearOptions, yearCounts);
      }
    });
  }

  function renderQuestionChart(canvasId, labels, counts) {
    destroyChart(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx || typeof Chart === "undefined") return;

    const dataValues = labels.map(l => counts[l] || 0);
    const isDonut = labels.length <= 4;

    chartInstances[canvasId] = new Chart(ctx, {
      type: isDonut ? 'doughnut' : 'bar',
      data: {
        labels: labels,
        datasets: [{
          data: dataValues,
          backgroundColor: getPalette().slice(0, labels.length),
          borderRadius: isDonut ? 0 : 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: !isDonut ? 'y' : undefined,
        cutout: isDonut ? '68%' : undefined,
        plugins: {
          legend: {
            display: isDonut,
            position: 'right',
            labels: { boxWidth: 10, font: { size: 10 } }
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const total = dataValues.reduce((a, b) => a + b, 0);
                const pct = total > 0 ? Math.round((context.raw / total) * 100) : 0;
                return ` ${context.raw} (${pct}%)`;
              }
            }
          }
        },
        scales: !isDonut ? {
          x: { beginAtZero: true, ticks: { precision: 0 } },
          y: { grid: { display: false }, ticks: { font: { size: 10 } } }
        } : undefined
      }
    });
  }

  /**
   * Renderiza a Tabela com Paginação e Busca
   */
  function renderTableRows() {
    let dataset = filteredData;

    if (searchQuery) {
      dataset = filteredData.filter(row => {
        return Object.values(row).some(val => 
          typeof val === "string" && val.toLowerCase().includes(searchQuery)
        );
      });
    }

    const totalRows = dataset.length;

    if (elTableResultCount) {
      if (searchQuery) {
        elTableResultCount.style.display = "inline-block";
        elTableResultCount.textContent = `${totalRows} resultado(s)`;
      } else {
        elTableResultCount.style.display = "none";
      }
    }

    const totalPages = Math.ceil(totalRows / rowsPerPage) || 1;

    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const startIdx = (currentPage - 1) * rowsPerPage;
    const endIdx = startIdx + rowsPerPage;
    const currentRows = dataset.slice(startIdx, endIdx);

    elTableBody.innerHTML = "";

    if (currentRows.length === 0) {
      elTableBody.innerHTML = `
        <tr>
          <td colspan="12" style="text-align: center; padding: 24px; color: var(--color-text-muted);">
            Nenhum registro encontrado para a busca.
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
          <td><strong>${escapeHTML(formattedDate)}</strong></td>
          <td><span class="table-pill age">${escapeHTML(row.q1_faixa_etaria || "-")}</span></td>
          <td><span class="table-pill year">${escapeHTML(row.q1_ano_escolar || "-")}</span></td>
          <td><span class="table-pill contact">${escapeHTML(row.q2_contato_vape || "-")}</span></td>
          <td>${escapeHTML(row.q3_idade_primeiro_contato || "-")}</td>
          <td>${escapeHTML(row.q4_dispositivo_popular || "-")}</td>
          <td>${escapeHTML(row.q5_atrativo_principal || "-")}</td>
          <td>${escapeHTML(row.q6_amigos_usam || "-")}</td>
          <td>${escapeHTML(row.q7_forma_acesso || "-")}</td>
          <td>${escapeHTML(row.q8_frequencia_escola || "-")}</td>
          <td>${escapeHTML(row.q9_percepcao_risco || "-")}</td>
          <td>${escapeHTML(row.q10_dialogo_prevencao || "-")}</td>
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
    const dataset = filteredData.length > 0 ? filteredData : cachedData;

    if (dataset.length === 0) {
      alert("Não há dados cadastrados para exportação.");
      return;
    }

    const headers = [
      "ID",
      "Data/Hora (UTC)",
      "1A. Faixa Etária (Idade)",
      "1B. Ano Escolar",
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

    const rows = dataset.map(r => [
      sanitizeCSVCell(r.id),
      sanitizeCSVCell(r.created_at),
      sanitizeCSVCell(r.q1_faixa_etaria),
      sanitizeCSVCell(r.q1_ano_escolar),
      sanitizeCSVCell(r.q2_contato_vape),
      sanitizeCSVCell(r.q3_idade_primeiro_contato),
      sanitizeCSVCell(r.q4_dispositivo_popular),
      sanitizeCSVCell(r.q5_atrativo_principal),
      sanitizeCSVCell(r.q6_amigos_usam),
      sanitizeCSVCell(r.q7_forma_acesso),
      sanitizeCSVCell(r.q8_frequencia_escola),
      sanitizeCSVCell(r.q9_percepcao_risco),
      sanitizeCSVCell(r.q10_dialogo_prevencao)
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
    setTimeout(() => URL.revokeObjectURL(url), 1000);
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
    setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
  };

  // Listeners do Modal QR Code (Backdrop & Teclado)
  if (elQrModal) {
    elQrModal.addEventListener("click", function(e) {
      if (e.target === elQrModal) {
        window.closeQrModal();
      }
    });
  }

  document.addEventListener("keydown", function(e) {
    if (e.key === "Escape" && elQrModal && elQrModal.style.display === "flex") {
      window.closeQrModal();
    }
  });

  // Inicializa o script
  init();
})();
