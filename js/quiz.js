/**
 * Lógica do Quiz Público - IDOMED FAMEJIPA
 * Gerencia o fluxo de perguntas, microinterações, transições suaves,
 * prevenção de duplo envio e persistência segura no Supabase.
 */

(function() {
  'use strict';

  const questions = window.QUIZ_QUESTIONS;
  const config = window.APP_CONFIG;

  if (!questions || !config) {
    console.error("Configurações ou perguntas não encontradas.");
    return;
  }

  // Estado da Aplicação
  let currentIndex = 0;
  let userAnswers = new Array(questions.length).fill(null);
  let isSubmitting = false;
  let submissionToken = generateUUID();

  // Elementos do DOM
  const elQuizContainer = document.getElementById("quizActivePanel");
  const elLoadingState = document.getElementById("loadingStatePanel");
  const elSuccessState = document.getElementById("successStatePanel");
  const elErrorState = document.getElementById("errorStatePanel");

  const elQuestionText = document.getElementById("questionText");
  const elOptionsList = document.getElementById("optionsList");
  const elProgressBar = document.getElementById("progressBar");
  const elProgressText = document.getElementById("progressText");
  const elProgressPercent = document.getElementById("progressPercent");
  const elBtnBack = document.getElementById("btnBack");

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
   * Renderiza a pergunta atual na tela com transição suave
   */
  function renderQuestion() {
    const currentQ = questions[currentIndex];
    if (!currentQ) return;

    // Atualiza progresso
    const currentNumber = currentIndex + 1;
    const totalNumber = questions.length;
    const percentage = Math.round((currentNumber / totalNumber) * 100);

    elProgressBar.style.width = `${percentage}%`;
    elProgressText.textContent = `Pergunta ${currentNumber} de ${totalNumber}`;
    elProgressPercent.textContent = `${percentage}%`;
    elBtnBack.disabled = (currentIndex === 0);

    // Efeito suave na transição do texto
    elQuestionText.classList.add("transitioning");
    setTimeout(() => {
      elQuestionText.textContent = `${currentNumber}. ${currentQ.q}`;
      elQuestionText.classList.remove("transitioning");
    }, 120);

    // Renderiza alternativas
    elOptionsList.innerHTML = "";
    const previouslySelected = userAnswers[currentIndex];

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

      // Rótulo da opção
      const spanLabel = document.createElement("span");
      spanLabel.className = "option-label";
      spanLabel.textContent = optText;

      // Marcador circular visual
      const marker = document.createElement("div");
      marker.className = "option-marker";
      marker.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      `;

      btn.appendChild(spanLabel);
      btn.appendChild(marker);

      btn.addEventListener("click", () => handleSelectOption(optText, btn));
      elOptionsList.appendChild(btn);
    });
  }

  /**
   * Manipula a seleção de uma alternativa com feedback tátil
   */
  function handleSelectOption(optionText, btnElement) {
    if (isSubmitting) return;

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
        renderQuestion();
      } else {
        submitQuizAnswers();
      }
    }, 220);
  }

  /**
   * Retorna para a pergunta anterior
   */
  window.handlePreviousQuestion = function() {
    if (currentIndex > 0 && !isSubmitting) {
      currentIndex--;
      renderQuestion();
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
      answers: userAnswers
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

    if (success) {
      elLoadingState.style.display = "none";
      elSuccessState.style.display = "block";
    } else {
      elLoadingState.style.display = "none";
      elErrorState.style.display = "block";
    }
  }

  /**
   * Reenvia as respostas em caso de erro sem perder os dados
   */
  window.retrySubmission = function() {
    submitQuizAnswers();
  };

  /**
   * Reseta o quiz para um novo preenchimento no mesmo dispositivo
   */
  window.resetQuizFlow = function() {
    currentIndex = 0;
    userAnswers = new Array(questions.length).fill(null);
    submissionToken = generateUUID();
    isSubmitting = false;

    elSuccessState.style.display = "none";
    elErrorState.style.display = "none";
    elLoadingState.style.display = "none";
    elQuizContainer.style.display = "block";

    renderQuestion();
  };

  // Suporte a atalhos de teclado para acessibilidade
  document.addEventListener("keydown", function(e) {
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

  // Inicialização
  renderQuestion();
})();
