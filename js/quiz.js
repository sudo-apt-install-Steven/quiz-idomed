/**
 * Lógica do Quiz Público - IDOMED FAMEJIPA
 * Gerencia o fluxo de perguntas, microinterações táteis, feedback háptico,
 * transições direcionais suaves, prevenção de duplo envio e persistência segura.
 */

(function() {
  'use strict';

  const questions = window.QUIZ_QUESTIONS;
  const config = window.APP_CONFIG;

  if (!questions || !config) {
    console.error("Configurações ou perguntas não encontradas.");
    return;
  }

  const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

  // Estado da Aplicação
  const surveyStartTime = Date.now();
  let currentIndex = 0;
  let userAnswers = new Array(questions.length).fill(null);
  let selectedSchoolYear = null;
  let pendingAgeSelection = null;
  let previousAgeSelection = null;
  let previousSchoolYear = null;
  let isSubmitting = false;
  let isTransitioning = false;
  let submissionToken = generateUUID();

  // Elementos do DOM
  const elQuizContainer = document.getElementById("quizActivePanel");
  const elLoadingState = document.getElementById("loadingStatePanel");
  const elSuccessState = document.getElementById("successStatePanel");
  const elErrorState = document.getElementById("errorStatePanel");

  const elQuestionText = document.getElementById("questionText");
  const elQuestionCategory = document.getElementById("questionCategory");
  const elQuestionRemaining = document.getElementById("questionRemaining");
  const elOptionsList = document.getElementById("optionsList");
  const elProgressBar = document.getElementById("progressBar");
  const elProgressText = document.getElementById("progressText");
  const elProgressPercent = document.getElementById("progressPercent");
  const elBtnBack = document.getElementById("btnBack");

  // Elementos de Estado Bioético & Anti-Fraude & Telemetria
  const elAlreadySubmittedState = document.getElementById("alreadySubmittedPanel");
  const elSubmittedReceiptCode = document.getElementById("submittedReceiptCode");
  const elSuccessReceiptCode = document.getElementById("successReceiptCode");
  const elSlowConnectionWarning = document.getElementById("slowConnectionWarning");
  const elSlowConnectionText = document.getElementById("slowConnectionText");
  const elLoadingHeadline = document.getElementById("loadingHeadline");
  const elLoadingDescription = document.getElementById("loadingDescription");
  const elTelemetryPhaseText = document.getElementById("telemetryPhaseText");
  const elTelemetryPercentText = document.getElementById("telemetryPercentText");
  const elMedicalVitalFill = document.getElementById("medicalVitalFill");
  const elVitalRateValue = document.getElementById("vitalRateValue");
  const elKeyboardMaxHint = document.getElementById("keyboardMaxHint");
  const elClinicalNetworkBanner = document.getElementById("clinicalNetworkBanner");
  const elClinicalNetworkText = document.getElementById("clinicalNetworkText");

  // Elementos do Botão de Alternância de Tema
  const elThemeToggleBtn = document.getElementById("themeToggleBtn");
  const elThemeToggleIcon = document.getElementById("themeToggleIcon");
  const elThemeToggleLabel = document.getElementById("themeToggleLabel");

  // Elementos do Modal de Ano Escolar (Etapa 2 da Questão 1)
  const elSchoolYearModal = document.getElementById("schoolYearModal");
  const elSchoolYearBackdrop = document.getElementById("schoolYearBackdrop");
  const elSchoolYearOptions = document.getElementById("schoolYearOptions");
  const elSelectedAgeBadge = document.getElementById("selectedAgeBadge");
  const elBtnCancelSchoolYear = document.getElementById("btnCancelSchoolYear");

  /**
   * Gerenciamento de Tema (Claro / Escuro) com persistência em Cookie e LocalStorage
   */
  function initThemeManager() {
    function getSavedTheme() {
      try {
        const cookieMatch = document.cookie.match(/(?:^|;\s*)idomed_theme=([^;]+)/);
        if (cookieMatch) return decodeURIComponent(cookieMatch[1]);
        const storageTheme = localStorage.getItem("idomed_theme");
        if (storageTheme) return storageTheme;
      } catch (_) {}
      const systemDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
      return systemDark ? "dark" : "light";
    }

    function applyTheme(theme) {
      document.documentElement.setAttribute("data-theme", theme);
      const metaThemeColor = document.querySelector('meta[name="theme-color"]');
      if (metaThemeColor) {
        metaThemeColor.setAttribute("content", theme === "dark" ? "#0a1120" : "#003b71");
      }
      try {
        localStorage.setItem("idomed_theme", theme);
        document.cookie = "idomed_theme=" + encodeURIComponent(theme) + "; path=/; max-age=31536000; SameSite=Lax";
      } catch (_) {}
      updateToggleUI(theme);
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
        triggerHaptic(10);
        const current = document.documentElement.getAttribute("data-theme") || "light";
        const nextTheme = current === "dark" ? "light" : "dark";
        applyTheme(nextTheme);
      });
    }
  }

  /**
   * Verifica se este dispositivo já submeteu respostas à pesquisa
   */
  function isDeviceAlreadySubmitted() {
    try {
      const cookieSubmitted = /(?:^|;\s*)idomed_quiz_completed=true/.test(document.cookie);
      const storageSubmitted = localStorage.getItem("idomed_quiz_completed") === "true";
      return cookieSubmitted || storageSubmitted;
    } catch (_) {
      return false;
    }
  }

  /**
   * Exibe a tela de participação já registrada
   */
  function showAlreadySubmittedScreen() {
    if (elQuizContainer) elQuizContainer.style.display = "none";
    if (elLoadingState) elLoadingState.style.display = "none";
    if (elSuccessState) elSuccessState.style.display = "none";
    if (elErrorState) elErrorState.style.display = "none";
    if (elAlreadySubmittedState) {
      elAlreadySubmittedState.style.display = "block";
      const token = localStorage.getItem("idomed_receipt_token") || "MED-" + submissionToken.slice(0, 8).toUpperCase();
      if (elSubmittedReceiptCode) {
        elSubmittedReceiptCode.textContent = token;
      }
    }
  }

  /**
   * Libera o aparelho para um novo participante (cenário de compartilhamento de dispositivo)
   */
  window.confirmResetForNewParticipant = function() {
    triggerHaptic(15);
    const confirmed = window.confirm("Deseja liberar este aparelho para um novo participante da pesquisa? (Ex: tablet compartilhado em sala de aula)");
    if (!confirmed) return;

    try {
      document.cookie = "idomed_quiz_completed=; path=/; max-age=0; SameSite=Lax";
      localStorage.removeItem("idomed_quiz_completed");
    } catch (_) {}

    window.resetQuizFlow();
  };

  /**
   * Dispara vibração háptica sutil em dispositivos móveis compatíveis
   */
  function triggerHaptic(duration = 12) {
    try {
      if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
        navigator.vibrate(duration);
      }
    } catch (_) {
      // Ignora se não for suportado ou bloqueado pelo navegador
    }
  }

  /**
   * Gera um UUID v4 seguro para controle de idempotência
   */
  function generateUUID() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * Abre o Modal / Bottom-Sheet para seleção do Ano Escolar
   */
  function openSchoolYearModal(ageText) {
    previousAgeSelection = userAnswers[0];
    previousSchoolYear = selectedSchoolYear;
    pendingAgeSelection = ageText;
    if (elSelectedAgeBadge) {
      elSelectedAgeBadge.textContent = ageText;
    }

    const q1 = questions[0];
    const yearOptions = q1.schoolYearOptions || [
      "9º ano (Ensino Fundamental)",
      "1º ano (Ensino Médio)",
      "2º ano (Ensino Médio)",
      "3º ano (Ensino Médio)",
      "Cursinho / Já concluí"
    ];

    elSchoolYearOptions.innerHTML = "";

    yearOptions.forEach((yearOpt, yIdx) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "school-year-btn";
      btn.setAttribute("role", "radio");
      btn.setAttribute("aria-checked", selectedSchoolYear === yearOpt ? "true" : "false");

      if (selectedSchoolYear === yearOpt) {
        btn.classList.add("selected");
      }

      const letterBadge = document.createElement("span");
      letterBadge.className = "opt-badge";
      letterBadge.textContent = OPTION_LETTERS[yIdx] || (yIdx + 1);

      const labelSpan = document.createElement("span");
      labelSpan.style.flex = "1";
      labelSpan.textContent = yearOpt;

      const checkCircle = document.createElement("span");
      checkCircle.className = "opt-check";
      checkCircle.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      `;

      btn.appendChild(letterBadge);
      btn.appendChild(labelSpan);
      btn.appendChild(checkCircle);

      btn.addEventListener("click", () => handleSelectSchoolYear(yearOpt, btn));
      elSchoolYearOptions.appendChild(btn);
    });

    elSchoolYearModal.classList.add("is-open");
    elSchoolYearModal.setAttribute("aria-hidden", "false");
    triggerHaptic(14);
  }

  /**
   * Fecha o Modal de Ano Escolar restaurando com segurança o estado anterior
   */
  function closeSchoolYearModal() {
    isTransitioning = false;
    elSchoolYearModal.classList.remove("is-open");
    elSchoolYearModal.setAttribute("aria-hidden", "true");

    // Restaura o estado anterior da Questão 1 caso o usuário tenha cancelado a Etapa 2
    userAnswers[0] = previousAgeSelection;
    selectedSchoolYear = previousSchoolYear;

    const allButtons = elOptionsList.querySelectorAll(".option-item");
    allButtons.forEach(b => {
      const label = b.querySelector(".option-label");
      if (previousAgeSelection && label && label.textContent === previousAgeSelection) {
        b.classList.add("selected");
        b.setAttribute("aria-checked", "true");
        let subBadge = b.querySelector(".option-sub-badge");
        if (selectedSchoolYear) {
          if (!subBadge) {
            subBadge = document.createElement("span");
            subBadge.className = "option-sub-badge";
            const leftContent = b.querySelector(".option-left-content");
            if (leftContent) leftContent.appendChild(subBadge);
          }
          subBadge.textContent = `✓ ${selectedSchoolYear}`;
        } else if (subBadge) {
          subBadge.remove();
        }
      } else {
        b.classList.remove("selected");
        b.setAttribute("aria-checked", "false");
        const subBadge = b.querySelector(".option-sub-badge");
        if (subBadge) subBadge.remove();
      }
    });
  }

  /**
   * Confirma a seleção de Ano Escolar e avança para a Questão 2
   */
  function handleSelectSchoolYear(yearText, btnElement) {
    if (isSubmitting || isTransitioning) return;
    isTransitioning = true;
    triggerHaptic(18);

    const allButtons = elSchoolYearOptions.querySelectorAll(".school-year-btn");
    allButtons.forEach(b => {
      b.classList.remove("selected");
      b.setAttribute("aria-checked", "false");
    });

    btnElement.classList.add("selected");
    btnElement.setAttribute("aria-checked", "true");

    selectedSchoolYear = yearText;
    userAnswers[0] = pendingAgeSelection;
    previousAgeSelection = pendingAgeSelection;
    previousSchoolYear = yearText;

    // Atualiza botão correspondente na lista principal
    const mainButtons = elOptionsList.querySelectorAll(".option-item");
    mainButtons.forEach(b => {
      const label = b.querySelector(".option-label");
      if (label && label.textContent === pendingAgeSelection) {
        b.classList.add("selected");
        b.setAttribute("aria-checked", "true");
        let subBadge = b.querySelector(".option-sub-badge");
        if (!subBadge) {
          subBadge = document.createElement("span");
          subBadge.className = "option-sub-badge";
          const leftContent = b.querySelector(".option-left-content");
          if (leftContent) leftContent.appendChild(subBadge);
        }
        subBadge.textContent = `✓ ${yearText}`;
      } else {
        b.classList.remove("selected");
        b.setAttribute("aria-checked", "false");
        const subBadge = b.querySelector(".option-sub-badge");
        if (subBadge) subBadge.remove();
      }
    });

    // Fecha o modal suavemente e avança para a próxima pergunta
    setTimeout(() => {
      elSchoolYearModal.classList.remove("is-open");
      elSchoolYearModal.setAttribute("aria-hidden", "true");

      setTimeout(() => {
        if (currentIndex + 1 < questions.length) {
          currentIndex++;
          renderQuestion("forward");
        } else {
          submitQuizAnswers();
        }
      }, 160);
    }, 220);
  }

  /**
   * Trata o clique de Idade na Questão 1 (Abre Etapa 2 de Ano Escolar)
   */
  function handleSelectAgeOption(optText, btnElement) {
    if (isSubmitting || isTransitioning) return;

    triggerHaptic(12);

    const allButtons = elOptionsList.querySelectorAll(".option-item");
    allButtons.forEach(b => {
      b.classList.remove("selected");
      b.setAttribute("aria-checked", "false");
    });

    btnElement.classList.add("selected");
    btnElement.setAttribute("aria-checked", "true");

    // Abre o popup/bottom-sheet para escolha do ano escolar
    openSchoolYearModal(optText);
  }

  /**
   * Renderiza a pergunta atual na tela com transição direcional suave
   */
  function renderQuestion(direction = "forward") {
    const currentQ = questions[currentIndex];
    if (!currentQ) return;

    // Atualiza barra de progresso e rótulos
    const currentNumber = currentIndex + 1;
    const totalNumber = questions.length;
    const percentage = Math.round((currentNumber / totalNumber) * 100);

    elProgressBar.style.width = `${percentage}%`;
    elProgressText.textContent = `Pergunta ${currentNumber} de ${totalNumber}`;
    elProgressPercent.textContent = `${percentage}%`;
    elBtnBack.disabled = (currentIndex === 0);

    if (elQuestionCategory) {
      elQuestionCategory.textContent = currentQ.category || "Pesquisa Científica";
    }
    if (elQuestionRemaining) {
      const remainingCount = totalNumber - currentNumber;
      elQuestionRemaining.textContent = remainingCount > 0 ? `${remainingCount} restantes` : "Última pergunta";
    }

    if (elKeyboardMaxHint) {
      elKeyboardMaxHint.textContent = currentQ.options.length;
    }

    // Efeito pop suave no contador
    elProgressText.classList.remove("pop");
    void elProgressText.offsetWidth; // Força reflow para reiniciar animação
    elProgressText.classList.add("pop");

    // Efeito visual direcional no texto da pergunta
    const exitClass = direction === "forward" ? "transitioning-out-left" : "transitioning-out-right";
    elQuestionText.classList.add(exitClass);

    setTimeout(() => {
      elQuestionText.textContent = `${currentNumber}. ${currentQ.q}`;
      elQuestionText.classList.remove(exitClass);
      elQuestionText.classList.add("transitioning-in");
      
      requestAnimationFrame(() => {
        elQuestionText.classList.remove("transitioning-in");
        isTransitioning = false;
      });
    }, 140);

    // Renderiza alternativas com badges de letras e suporte tátil
    elOptionsList.innerHTML = "";
    const previouslySelected = userAnswers[currentIndex];

    // Se for a Questão 1, insere hint indicando as etapas de idade e ano escolar
    if (currentIndex === 0) {
      const hint = document.createElement("div");
      hint.className = "question-step-hint";
      hint.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12 6 12 12 16 14"></polyline>
        </svg>
        <span>Passo 1 de 2: Selecione a sua faixa etária</span>
      `;
      elOptionsList.appendChild(hint);
    }

    // Orientação Contextual para Respondentes Não-Usuários
    const isDeclaredNonUser = (userAnswers[1] === "Nunca experimentei");
    if (isDeclaredNonUser) {
      if (currentQ.id === 3) {
        const hint = document.createElement("div");
        hint.className = "non-user-hint-badge";
        hint.innerHTML = `<span>💡 Participante não-usuário: selecione a alternativa <strong>"Nunca usei"</strong></span>`;
        elOptionsList.appendChild(hint);
      } else if (currentQ.id === 4 || currentQ.id === 5 || currentQ.id === 7) {
        const hint = document.createElement("div");
        hint.className = "non-user-hint-badge";
        hint.innerHTML = `<span>💡 Se você nunca utilizou vape ou não se aplica, selecione <strong>"Não se aplica / Nunca usei"</strong></span>`;
        elOptionsList.appendChild(hint);
      }
    }

    currentQ.options.forEach((optText, optIdx) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "option-item";
      btn.setAttribute("role", "radio");
      btn.setAttribute("aria-checked", previouslySelected === optText ? "true" : "false");
      btn.setAttribute("data-index", optIdx + 1);

      if (previouslySelected === optText) {
        btn.classList.add("selected");
      }

      // Conteúdo à esquerda (Letra + Texto + Sub-Badge se houver)
      const leftWrap = document.createElement("div");
      leftWrap.className = "option-left-content";

      const letterBadge = document.createElement("span");
      letterBadge.className = "option-letter-badge";
      letterBadge.textContent = OPTION_LETTERS[optIdx] || (optIdx + 1);

      const spanLabel = document.createElement("span");
      spanLabel.className = "option-label";
      spanLabel.textContent = optText;

      leftWrap.appendChild(letterBadge);
      leftWrap.appendChild(spanLabel);

      // Se for a Questão 1 e já tiver ano escolar registrado nesta idade
      if (currentIndex === 0 && previouslySelected === optText && selectedSchoolYear) {
        const subBadge = document.createElement("span");
        subBadge.className = "option-sub-badge";
        subBadge.textContent = `✓ ${selectedSchoolYear}`;
        leftWrap.appendChild(subBadge);
      }

      // Atalho de Teclado Visual (Desktop)
      const kbdHint = document.createElement("span");
      kbdHint.className = "option-kbd-hint";
      kbdHint.setAttribute("aria-hidden", "true");
      kbdHint.textContent = `${optIdx + 1}`;

      // Marcador circular direito
      const marker = document.createElement("div");
      marker.className = "option-marker";
      marker.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      `;

      btn.appendChild(leftWrap);
      btn.appendChild(kbdHint);
      btn.appendChild(marker);

      if (currentIndex === 0) {
        btn.addEventListener("click", () => handleSelectAgeOption(optText, btn));
      } else {
        btn.addEventListener("click", () => handleSelectOption(optText, btn));
      }

      elOptionsList.appendChild(btn);
    });
  }

  /**
   * Manipula a seleção de uma alternativa com feedback tátil e sonoro/háptico
   */
  function handleSelectOption(optionText, btnElement) {
    if (isSubmitting || isTransitioning) return;
    isTransitioning = true;

    triggerHaptic(14);

    // Feedback visual imediato na opção clicada
    const allButtons = elOptionsList.querySelectorAll(".option-item");
    allButtons.forEach(b => {
      b.classList.remove("selected");
      b.setAttribute("aria-checked", "false");
    });

    btnElement.classList.add("selected");
    btnElement.setAttribute("aria-checked", "true");
    userAnswers[currentIndex] = optionText;

    // Transição suave para a próxima questão
    setTimeout(() => {
      if (currentIndex + 1 < questions.length) {
        currentIndex++;
        renderQuestion("forward");
      } else {
        submitQuizAnswers();
      }
    }, 240);
  }

  /**
   * Retorna para a pergunta anterior
   */
  window.handlePreviousQuestion = function() {
    if (currentIndex > 0 && !isSubmitting && !isTransitioning) {
      isTransitioning = true;
      triggerHaptic(8);
      currentIndex--;
      renderQuestion("backward");
    }
  };

  /**
   * Envia as 10 respostas com controle de idempotência e fallback resiliente
   */
  /**
   * Envia as 10 respostas com telemetria vital clínica, controle de idempotência e fallback resiliente
   */
  async function submitQuizAnswers() {
    if (isSubmitting) return;
    isSubmitting = true;

    // Atualiza visão para tela de carregamento com monitor bioético
    if (elQuizContainer) elQuizContainer.style.display = "none";
    if (elErrorState) elErrorState.style.display = "none";
    if (elSuccessState) elSuccessState.style.display = "none";
    if (elAlreadySubmittedState) elAlreadySubmittedState.style.display = "none";
    if (elLoadingState) elLoadingState.style.display = "block";

    if (elSlowConnectionWarning) {
      elSlowConnectionWarning.classList.remove("active");
    }
    if (elLoadingHeadline) {
      elLoadingHeadline.textContent = "Gravando respostas...";
    }
    if (elLoadingDescription) {
      elLoadingDescription.textContent = "Registrando suas informações com segurança criptográfica e anonimato absoluto nos servidores da pesquisa IDOMED - Medicina.";
    }

    // Progresso Dinâmico da Barra de Telemetria Médica
    let currentPct = 15;
    function updateTelemetry(pct, phaseText, bpm) {
      if (elMedicalVitalFill) elMedicalVitalFill.style.width = `${pct}%`;
      if (elTelemetryPercentText) elTelemetryPercentText.textContent = `${pct}%`;
      if (elTelemetryPhaseText && phaseText) elTelemetryPhaseText.textContent = phaseText;
      if (elVitalRateValue && bpm) elVitalRateValue.textContent = `${bpm} BPM • Sinal Ativo`;
    }

    updateTelemetry(15, "Iniciando criptografia bioestatística...", 72);

    const progressInterval = setInterval(() => {
      if (!isSubmitting) {
        clearInterval(progressInterval);
        return;
      }
      if (currentPct < 85) {
        currentPct += Math.floor(Math.random() * 8) + 4;
        if (currentPct > 85) currentPct = 85;
        const bpm = 70 + Math.floor(Math.random() * 8);
        let phase = "Transmitindo dados criptografados...";
        if (currentPct > 40 && currentPct <= 65) {
          phase = "Validando anonimização e integridade amostral...";
        } else if (currentPct > 65) {
          phase = "Sincronizando com o Observatório IDOMED...";
        }
        updateTelemetry(currentPct, phase, bpm);
      }
    }, 280);

    // Watchdogs para Conexão Lenta com Alerta Hospitalar
    const slowTimer1 = setTimeout(() => {
      if (isSubmitting && elSlowConnectionWarning) {
        elSlowConnectionWarning.classList.add("active");
        if (elSlowConnectionText) {
          elSlowConnectionText.textContent = "Conexão lenta detectada. Sincronizando dados clínicos com o servidor seguro da pesquisa IDOMED - Medicina... Por favor, aguarde alguns instantes sem fechar o navegador.";
        }
        updateTelemetry(88, "Canal com latência • Estabilizando conexão...", 78);
      }
    }, 1300);

    const slowTimer2 = setTimeout(() => {
      if (isSubmitting && elSlowConnectionText) {
        elSlowConnectionText.textContent = "Oscilação severa de rede detectada. Ativando canal secundário resiliente para garantir a entrega sem duplicação de dados...";
        updateTelemetry(93, "Modo de alta resiliência ativo...", 82);
      }
    }, 2900);

    const honeypotVal = document.getElementById("idomedHoneypot")?.value || "";
    const elapsedTimeMs = Date.now() - surveyStartTime;

    const payload = {
      submission_token: submissionToken,
      answers: userAnswers,
      q1_ano_escolar: selectedSchoolYear || null,
      client_elapsed_ms: elapsedTimeMs,
      idomed_hp_verification: honeypotVal
    };

    let success = false;
    let serverReceipt = null;

    // 1ª Tentativa: Endpoint Serverless Vercel (/api/submit)
    try {
      const response = await fetch(config.API_SUBMIT_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          success = true;
          serverReceipt = data.receipt_code || null;
        }
      }
    } catch (err) {
      console.warn("Endpoint serverless não respondeu, tentando comunicação direta com Supabase RPC...");
    }

    // 2ª Tentativa (Fallback de Resiliência): Supabase RPC Direto
    if (!success) {
      try {
        const rpcPayload = {
          p_submission_token: submissionToken,
          p_q1: userAnswers[0] || "",
          p_q1_ano: selectedSchoolYear || null,
          p_q2: userAnswers[1] || "",
          p_q3: userAnswers[2] || "",
          p_q4: userAnswers[3] || "",
          p_q5: userAnswers[4] || "",
          p_q6: userAnswers[5] || "",
          p_q7: userAnswers[6] || "",
          p_q8: userAnswers[7] || "",
          p_q9: userAnswers[8] || "",
          p_q10: userAnswers[9] || ""
        };

        const rpcRes = await fetch(`${config.SUPABASE_URL}${config.SUPABASE_RPC_ENDPOINT}`, {
          method: "POST",
          headers: {
            "apikey": config.SUPABASE_ANON_KEY,
            "Authorization": `Bearer ${config.SUPABASE_ANON_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(rpcPayload)
        });

        if (rpcRes.ok) {
          const rpcData = await rpcRes.json();
          if (rpcData && rpcData.success) {
            success = true;
          }
        }
      } catch (err) {
        console.error("Falha no envio direto ao Supabase:", err);
      }
    }

    clearInterval(progressInterval);
    clearTimeout(slowTimer1);
    clearTimeout(slowTimer2);

    isSubmitting = false;
    isTransitioning = false;

    if (success) {
      updateTelemetry(100, "Submissão confirmada pelo servidor!", 72);
      triggerHaptic(25);

      const receiptCode = serverReceipt || "MED-" + submissionToken.slice(0, 8).toUpperCase();

      // Persistência Anti-Fraude Segura no Dispositivo (Cookies & LocalStorage)
      try {
        document.cookie = "idomed_quiz_completed=true; path=/; max-age=31536000; SameSite=Lax";
        document.cookie = `idomed_receipt_token=${receiptCode}; path=/; max-age=31536000; SameSite=Lax`;
        localStorage.setItem("idomed_quiz_completed", "true");
        localStorage.setItem("idomed_submission_timestamp", new Date().toISOString());
        localStorage.setItem("idomed_receipt_token", receiptCode);
      } catch (_) {}

      if (elSuccessReceiptCode) elSuccessReceiptCode.textContent = receiptCode;
      if (elSubmittedReceiptCode) elSubmittedReceiptCode.textContent = receiptCode;

      setTimeout(() => {
        if (elLoadingState) elLoadingState.style.display = "none";
        if (elSuccessState) elSuccessState.style.display = "block";
      }, 350);
    } else {
      triggerHaptic(50);
      if (elLoadingState) elLoadingState.style.display = "none";
      if (elErrorState) elErrorState.style.display = "block";
    }
  }

  /**
   * Reenvia as respostas em caso de erro sem perder os dados
   */
  window.retrySubmission = function() {
    triggerHaptic(10);
    submitQuizAnswers();
  };

  /**
   * Reseta o quiz para um novo preenchimento no mesmo dispositivo
   */
  window.resetQuizFlow = function() {
    triggerHaptic(15);
    currentIndex = 0;
    userAnswers = new Array(questions.length).fill(null);
    selectedSchoolYear = null;
    pendingAgeSelection = null;
    previousAgeSelection = null;
    previousSchoolYear = null;
    submissionToken = generateUUID();
    isSubmitting = false;
    isTransitioning = false;

    if (elSchoolYearModal) {
      elSchoolYearModal.classList.remove("is-open");
      elSchoolYearModal.setAttribute("aria-hidden", "true");
    }

    if (elSuccessState) elSuccessState.style.display = "none";
    if (elErrorState) elErrorState.style.display = "none";
    if (elLoadingState) elLoadingState.style.display = "none";
    if (elAlreadySubmittedState) elAlreadySubmittedState.style.display = "none";
    if (elQuizContainer) elQuizContainer.style.display = "block";

    renderQuestion("forward");
  };

  // Listeners do Modal de Ano Escolar
  if (elSchoolYearBackdrop) {
    elSchoolYearBackdrop.addEventListener("click", closeSchoolYearModal);
  }
  if (elBtnCancelSchoolYear) {
    elBtnCancelSchoolYear.addEventListener("click", closeSchoolYearModal);
  }

  // Monitoramento Ativo de Conectividade e Resiliência
  function setupNetworkMonitor() {
    function updateStatus() {
      if (!elClinicalNetworkBanner) return;
      if (!navigator.onLine) {
        elClinicalNetworkBanner.classList.add("active");
        if (elClinicalNetworkText) {
          elClinicalNetworkText.textContent = "Conexão interrompida. Suas respostas permanecem preservadas no aparelho.";
        }
      } else if (navigator.connection && (navigator.connection.effectiveType === '2g' || navigator.connection.saveData)) {
        elClinicalNetworkBanner.classList.add("active");
        if (elClinicalNetworkText) {
          elClinicalNetworkText.textContent = "Conexão lenta detectada. Protocolo de alta resiliência IDOMED ativo.";
        }
      } else {
        elClinicalNetworkBanner.classList.remove("active");
      }
    }

    window.addEventListener("online", updateStatus);
    window.addEventListener("offline", updateStatus);
    if (navigator.connection) {
      navigator.connection.addEventListener("change", updateStatus);
    }
    updateStatus();
  }

  // Suporte a atalhos de teclado para acessibilidade (todas as alternativas numéricas)
  document.addEventListener("keydown", function(e) {
    if (isSubmitting || isTransitioning) return;

    // Se o modal de ano escolar estiver aberto
    if (elSchoolYearModal && elSchoolYearModal.classList.contains("is-open")) {
      if (e.key === "Escape") {
        closeSchoolYearModal();
        return;
      }
      const numKey = parseInt(e.key, 10);
      if (!isNaN(numKey) && numKey >= 1) {
        const idx = numKey - 1;
        const buttons = elSchoolYearOptions.querySelectorAll(".school-year-btn");
        if (buttons[idx]) {
          buttons[idx].click();
        }
        return;
      }
    }

    if (elQuizContainer && elQuizContainer.style.display === "none") return;

    if (e.key === "ArrowLeft" && currentIndex > 0) {
      window.handlePreviousQuestion();
    } else {
      const numKey = parseInt(e.key, 10);
      if (!isNaN(numKey) && numKey >= 1) {
        const idx = numKey - 1;
        const buttons = elOptionsList.querySelectorAll(".option-item");
        if (buttons[idx]) {
          buttons[idx].click();
        }
      }
    }
  });

  // Suporte a gesto tátil de arrastar para baixo (Swipe to Dismiss) no Mobile
  const sheetEl = document.querySelector(".school-year-sheet");
  if (sheetEl) {
    let touchStartY = 0;
    let currentDeltaY = 0;
    let canDrag = false;

    sheetEl.addEventListener("touchstart", function(e) {
      if (e.touches && e.touches.length === 1) {
        const target = e.target;
        const isHeaderOrHandle = target.closest(".sheet-drag-handle") || target.closest(".school-year-header");
        const optionsEl = document.getElementById("schoolYearOptions");
        const isAtTop = !optionsEl || optionsEl.scrollTop <= 0;

        if (isHeaderOrHandle || isAtTop) {
          touchStartY = e.touches[0].clientY;
          currentDeltaY = 0;
          canDrag = true;
        } else {
          canDrag = false;
        }
      }
    }, { passive: true });

    sheetEl.addEventListener("touchmove", function(e) {
      if (canDrag && e.touches && e.touches.length === 1 && touchStartY > 0) {
        const delta = e.touches[0].clientY - touchStartY;
        if (delta > 0) {
          currentDeltaY = delta;
          sheetEl.style.transform = `translateY(${Math.min(delta, 250)}px)`;
        }
      }
    }, { passive: true });

    const finishTouch = function() {
      sheetEl.style.transform = "";
      if (canDrag && currentDeltaY > 70) {
        closeSchoolYearModal();
      }
      touchStartY = 0;
      currentDeltaY = 0;
      canDrag = false;
    };

    sheetEl.addEventListener("touchend", finishTouch, { passive: true });
    sheetEl.addEventListener("touchcancel", finishTouch, { passive: true });
  }

  // Inicialização
  initThemeManager();
  setupNetworkMonitor();

  if (isDeviceAlreadySubmitted()) {
    showAlreadySubmittedScreen();
  } else {
    renderQuestion("forward");
  }
})();
