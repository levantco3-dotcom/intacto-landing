(function () {
  const SESSION_KEY = 'intacto_quiz_shown';
  const TIME_MS = 15000;
  const SCROLL_RATIO = 0.45;
  const YES_THRESHOLD = 2;

  const QUESTIONS = [
    '¿Alguna vez has lavado tus tenis a mano o en la lavadora?',
    '¿Te molesta que tus tenis blancos se pongan amarillos o manchados con el tiempo?',
    '¿Te gustaría dejarlos como nuevos en solo 2 minutos, sin agua ni jabón?'
  ];

  function hasBeenShown() {
    try {
      return sessionStorage.getItem(SESSION_KEY) === '1';
    } catch (err) {
      return false;
    }
  }

  function markShown() {
    try {
      sessionStorage.setItem(SESSION_KEY, '1');
    } catch (err) {
      // no crítico si no se puede persistir
    }
  }

  function scrollRatio() {
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    if (scrollable <= 0) return 1;
    return window.scrollY / scrollable;
  }

  function buildQuestionRow(text, index, answers, onAnswered) {
    const row = document.createElement('div');
    row.className = 'quiz-modal__question';

    const label = document.createElement('p');
    label.className = 'quiz-modal__question-text';
    label.textContent = text;

    const answerRow = document.createElement('div');
    answerRow.className = 'quiz-modal__answers';

    const yesBtn = document.createElement('button');
    yesBtn.type = 'button';
    yesBtn.className = 'quiz-modal__answer';
    yesBtn.textContent = 'Sí';

    const noBtn = document.createElement('button');
    noBtn.type = 'button';
    noBtn.className = 'quiz-modal__answer';
    noBtn.textContent = 'No';

    function select(isYes) {
      answers[index] = isYes;
      yesBtn.classList.toggle('is-selected', isYes);
      noBtn.classList.toggle('is-selected', !isYes);
      onAnswered();
    }

    yesBtn.addEventListener('click', () => select(true));
    noBtn.addEventListener('click', () => select(false));

    answerRow.append(yesBtn, noBtn);
    row.append(label, answerRow);
    return row;
  }

  function buildQuiz() {
    const root = document.getElementById('quiz-root');
    if (!root) return;

    const answers = new Array(QUESTIONS.length).fill(null);

    const overlay = document.createElement('div');
    overlay.className = 'quiz-overlay';

    const modal = document.createElement('div');
    modal.className = 'quiz-modal';

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'quiz-modal__close';
    closeBtn.setAttribute('aria-label', 'Cerrar');
    closeBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"></path></svg>';

    const title = document.createElement('h2');
    title.className = 'quiz-modal__title';
    title.textContent = 'Mini encuesta para saber si INTACTO es lo que necesitas';

    const questionsBox = document.createElement('div');
    questionsBox.className = 'quiz-modal__questions';

    const resultBox = document.createElement('div');
    resultBox.className = 'quiz-modal__result';
    resultBox.hidden = true;

    const resultTitle = document.createElement('p');
    resultTitle.className = 'quiz-modal__result-title';

    const resultText = document.createElement('p');
    resultText.className = 'quiz-modal__result-text';

    const resultButton = document.createElement('a');
    resultButton.className = 'quiz-modal__result-button';
    resultButton.href = '/checkout';
    resultButton.textContent = 'Quiero mi kit INTACTO';

    resultBox.append(resultTitle, resultText, resultButton);

    function revealResultIfComplete() {
      if (answers.some((a) => a === null)) return;

      const yesCount = answers.filter(Boolean).length;
      questionsBox.hidden = true;

      if (yesCount >= YES_THRESHOLD) {
        resultTitle.textContent = 'Sí, INTACTO es para ti';
        resultText.textContent = 'Tenis siempre listos, sin lavadora ni pereza. Espuma, cepillo, 2 minutos.';
      } else {
        resultTitle.textContent = 'Igual muchos clientes lo aman';
        resultText.textContent = 'Aunque no lavas tenis seguido, INTACTO deja los tuyos como el día uno, en 2 minutos, cuando los necesites.';
      }

      resultBox.hidden = false;
    }

    QUESTIONS.forEach((text, index) => {
      questionsBox.appendChild(buildQuestionRow(text, index, answers, revealResultIfComplete));
    });

    modal.append(closeBtn, title, questionsBox, resultBox);
    overlay.appendChild(modal);
    root.appendChild(overlay);

    function close() {
      overlay.classList.remove('is-visible');
      document.body.style.overflow = '';
      window.setTimeout(() => overlay.remove(), 250);
    }

    closeBtn.addEventListener('click', close);
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) close();
    });

    // El modal ocupa toda la pantalla en mobile y detiene el scroll de
    // fondo mientras está abierto.
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => overlay.classList.add('is-visible'));
  }

  function initTrigger() {
    if (hasBeenShown()) return;

    let timeOk = false;
    let scrollOk = false;
    let shown = false;

    function maybeShow() {
      if (shown || !timeOk || !scrollOk) return;
      shown = true;
      markShown();
      window.removeEventListener('scroll', onScroll);
      buildQuiz();
    }

    window.setTimeout(() => {
      timeOk = true;
      maybeShow();
    }, TIME_MS);

    let ticking = false;

    function onScroll() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        ticking = false;
        if (scrollRatio() >= SCROLL_RATIO) {
          scrollOk = true;
          maybeShow();
        }
      });
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  document.addEventListener('DOMContentLoaded', initTrigger);
})();
