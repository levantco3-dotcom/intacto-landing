(function () {
  const SESSION_KEY = 'intacto_quiz_shown';
  const TIME_MS = 15000;
  const SCROLL_RATIO = 0.45;

  const QUESTIONS = [
    '¿Lavas tus tenis en la lavadora?',
    '¿Se ensucian con la palanca de cambios de tu moto o el pedal del carro?',
    '¿Sales con los tenis sucios porque no te da tiempo de limpiarlos?'
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

  function buildQuiz() {
    const root = document.getElementById('quiz-root');
    if (!root) return;

    let step = 0;

    const sheet = document.createElement('div');
    sheet.className = 'quiz-sheet';

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'quiz-sheet__close';
    closeBtn.setAttribute('aria-label', 'Cerrar');
    closeBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"></path></svg>';

    const questionStep = document.createElement('div');
    questionStep.className = 'quiz-sheet__step';

    const eyebrow = document.createElement('span');
    eyebrow.className = 'quiz-sheet__eyebrow';
    eyebrow.textContent = '¿ES INTACTO PARA TI?';

    const question = document.createElement('p');
    question.className = 'quiz-sheet__question';

    const answers = document.createElement('div');
    answers.className = 'quiz-sheet__answers';

    const yesBtn = document.createElement('button');
    yesBtn.type = 'button';
    yesBtn.className = 'quiz-sheet__answer';
    yesBtn.textContent = 'Sí';

    const noBtn = document.createElement('button');
    noBtn.type = 'button';
    noBtn.className = 'quiz-sheet__answer';
    noBtn.textContent = 'No';

    answers.append(yesBtn, noBtn);

    const progress = document.createElement('div');
    progress.className = 'quiz-sheet__progress';

    const dots = QUESTIONS.map(() => {
      const dot = document.createElement('span');
      dot.className = 'quiz-sheet__dot';
      progress.appendChild(dot);
      return dot;
    });

    questionStep.append(eyebrow, question, answers, progress);

    const resultStep = document.createElement('div');
    resultStep.className = 'quiz-sheet__result';
    resultStep.hidden = true;

    const resultTitle = document.createElement('p');
    resultTitle.className = 'quiz-sheet__result-title';
    resultTitle.textContent = 'INTACTO es para ti';

    const resultText = document.createElement('p');
    resultText.className = 'quiz-sheet__result-text';
    resultText.textContent = 'Tenis siempre listos, sin lavadora ni pereza. Espuma, cepillo, 2 minutos.';

    const resultButton = document.createElement('a');
    resultButton.className = 'quiz-sheet__result-button';
    resultButton.href = '/checkout';
    resultButton.textContent = 'Quiero mi kit INTACTO';

    resultStep.append(resultTitle, resultText, resultButton);

    sheet.append(closeBtn, questionStep, resultStep);
    root.appendChild(sheet);

    function renderQuestion() {
      question.textContent = QUESTIONS[step];
      dots.forEach((dot, i) => dot.classList.toggle('is-active', i === step));
    }

    function advance() {
      step += 1;
      if (step >= QUESTIONS.length) {
        questionStep.hidden = true;
        resultStep.hidden = false;
      } else {
        renderQuestion();
      }
    }

    yesBtn.addEventListener('click', advance);
    noBtn.addEventListener('click', advance);

    function close() {
      sheet.classList.remove('is-visible');
      window.setTimeout(() => sheet.remove(), 350);
    }

    closeBtn.addEventListener('click', close);

    renderQuestion();
    requestAnimationFrame(() => sheet.classList.add('is-visible'));
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
