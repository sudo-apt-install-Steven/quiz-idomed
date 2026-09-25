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

  // Elementos do Modal de Ano Escolar (Etapa 2 da Questão 1)
  const elSchoolYearModal = document.getElementById("schoolYearModal");
  const elSchoolYearBackdrop = document.getElementById("schoolYearBackdrop");
  const elSchoolYearOptions = document.getElementById("schoolYearOptions");
  const elSelectedAgeBadge = document.getElementById("selectedAgeBadge");
  const elBtnCancelSchoolYear = document.getElementById("btnCancelSchoolYear");

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
  async function submitQuizAnswers() {
    if (isSubmitting) return;
    isSubmitting = true;

    // Atualiza visão para tela de carregamento
    elQuizContainer.style.display = "none";
    elErrorState.style.display = "none";
    elSuccessState.style.display = "none";
    elLoadingState.style.display = "block";

    const payload = {
      submission_token: submissionToken,
      answers: userAnswers,
      q1_ano_escolar: selectedSchoolYear || null
    };

    let success = false;

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

    isSubmitting = false;
    isTransitioning = false;

    if (success) {
      triggerHaptic(25);
      elLoadingState.style.display = "none";
      elSuccessState.style.display = "block";
    } else {
      triggerHaptic(50);
      elLoadingState.style.display = "none";
      elErrorState.style.display = "block";
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

    elSuccessState.style.display = "none";
    elErrorState.style.display = "none";
    elLoadingState.style.display = "none";
    elQuizContainer.style.display = "block";

    renderQuestion("forward");
  };

  // Listeners do Modal de Ano Escolar
  if (elSchoolYearBackdrop) {
    elSchoolYearBackdrop.addEventListener("click", closeSchoolYearModal);
  }
  if (elBtnCancelSchoolYear) {
    elBtnCancelSchoolYear.addEventListener("click", closeSchoolYearModal);
  }

  // Suporte a atalhos de teclado para acessibilidade
  document.addEventListener("keydown", function(e) {
    if (isSubmitting || isTransitioning) return;

    // Se o modal estiver aberto
    if (elSchoolYearModal && elSchoolYearModal.classList.contains("is-open")) {
      if (e.key === "Escape") {
        closeSchoolYearModal();
        return;
      }
      if (e.key >= "1" && e.key <= "5") {
        const idx = parseInt(e.key, 10) - 1;
        const buttons = elSchoolYearOptions.querySelectorAll(".school-year-btn");
        if (buttons[idx]) {
          buttons[idx].click();
        }
        return;
      }
    }

    if (elQuizContainer.style.display === "none") return;

    if (e.key === "ArrowLeft" && currentIndex > 0) {
      window.handlePreviousQuestion();
    } else if (e.key >= "1" && e.key <= "5") {
      const idx = parseInt(e.key, 10) - 1;
      const buttons = elOptionsList.querySelectorAll(".option-item");
      if (buttons[idx]) {
        buttons[idx].click();
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
  renderQuestion("forward");
})();
