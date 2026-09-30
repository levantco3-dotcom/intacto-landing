(function () {
  const SPINS_USED_KEY = 'intacto_wheel_spins_used';
  const PRIZES_WON_KEY = 'intacto_wheel_prizes';
  const MAX_SPINS = 2;
  const SVG_NS = 'http://www.w3.org/2000/svg';

  // Copia LOCAL, solo para dibujar los segmentos a escala real. El sorteo
  // real siempre ocurre en /api/wheel-spin — esto nunca decide nada, solo
  // sabe dónde pintar cada premio en el círculo.
  const PRIZES_DISPLAY = [
    { id: 'casi-ganas', lines: ["¡PA' LA", 'PRÓXIMA!'], weight: 40, color: 'var(--carbon-suave)' },
    { id: 'garantia-extra', lines: ['+5 DÍAS', 'GARANTÍA'], weight: 10, color: 'var(--cobre-oscuro)' },
    { id: 'prepago-5', lines: ['5% OFF', 'PAGO YA'], weight: 30, color: 'var(--cobre)' },
    { id: 'segundo-kit-30', lines: ['30% OFF', '2DO KIT'], weight: 20, color: 'var(--crema-oscuro)' }
  ];

  const PRIZE_RESULT_COPY = {
    'casi-ganas': {
      title: '¡Pa\' la próxima!',
      text: 'Esta vez no hubo premio, pero tu kit INTACTO te espera igual.'
    },
    'garantia-extra': {
      title: '¡Ganaste 5 días extra de garantía!',
      text: 'Tu garantía queda en 20 días desde la entrega — se aplica sola, no necesitas hacer nada.'
    },
    'prepago-5': {
      title: '¡Ganaste 5% off pagando ahora!',
      text: 'Elige "Pagar ahora con tarjeta o PSE" en el método de pago y el descuento se aplica solo.'
    },
    'segundo-kit-30': {
      title: '¡Ganaste 30% en tu segundo kit!',
      text: 'Ya lo activamos abajo del resumen de tu pedido — puedes quitarlo si no lo quieres.'
    }
  };

  function getSpinsUsed() {
    try {
      const raw = sessionStorage.getItem(SPINS_USED_KEY);
      const parsed = parseInt(raw, 10);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    } catch (err) {
      return 0;
    }
  }

  function setSpinsUsed(count) {
    try {
      sessionStorage.setItem(SPINS_USED_KEY, String(count));
    } catch (err) {
      // no crítico
    }
  }

  function savePrizeWon(prizeId, token) {
    try {
      const raw = sessionStorage.getItem(PRIZES_WON_KEY);
      const list = raw ? JSON.parse(raw) : [];
      list.push({ prizeId, token });
      sessionStorage.setItem(PRIZES_WON_KEY, JSON.stringify(list));
    } catch (err) {
      // no crítico
    }
  }

  function loadPrizesWon() {
    try {
      const raw = sessionStorage.getItem(PRIZES_WON_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (err) {
      return [];
    }
  }

  window.INTACTO_WHEEL_STATE = window.INTACTO_WHEEL_STATE || { tokens: [] };

  function updateSummaryPrice(withSecondKit) {
    const priceEl = document.querySelector('.checkout-page__summary-price-current');
    const metaEl = document.querySelector('.checkout-page__summary-meta');
    if (!priceEl) return;

    priceEl.textContent = withSecondKit ? '$203.830' : '$119.900';

    if (metaEl) {
      const chevron = metaEl.querySelector('svg');
      metaEl.textContent = withSecondKit ? '2 unidades · Ver detalle ' : '1 unidad · Ver detalle ';
      if (chevron) metaEl.appendChild(chevron);
    }
  }

  function renderSecondKitBanner() {
    const container = document.getElementById('wheel-second-kit-banner');
    if (!container || container.childElementCount) return;

    const banner = document.createElement('label');
    banner.className = 'wheel-second-kit-banner';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'wheel-second-kit-banner__checkbox';
    checkbox.checked = true;

    const body = document.createElement('div');
    body.className = 'wheel-second-kit-banner__body';

    const title = document.createElement('p');
    title.className = 'wheel-second-kit-banner__title';
    title.textContent = 'Sí, quiero un segundo kit INTACTO con 30% off';

    const price = document.createElement('p');
    price.className = 'wheel-second-kit-banner__price';

    function refresh() {
      price.innerHTML = checkbox.checked
        ? '2 kits por <strong>$203.830</strong> (antes $239.800)'
        : '1 kit por <strong>$119.900</strong>';
      window.INTACTO_WHEEL_STATE.wantsSecondKit = checkbox.checked;
      updateSummaryPrice(checkbox.checked);
    }

    checkbox.addEventListener('change', refresh);

    body.append(title, price);
    banner.append(checkbox, body);
    container.appendChild(banner);

    refresh();
  }

  // Aplica los efectos de TODOS los premios ganados hasta ahora (puede haber
  // hasta 2, uno por giro). Se puede llamar varias veces sin duplicar nada.
  function applyWonPrizes() {
    const won = loadPrizesWon();
    window.INTACTO_WHEEL_STATE.tokens = won.map((p) => p.token);

    if (won.some((p) => p.prizeId === 'segundo-kit-30')) {
      renderSecondKitBanner();
    }
  }

  // -- Dibujo de la ruleta (SVG) --------------------------------------------

  function polarPoint(cx, cy, r, angleDeg) {
    const rad = (angleDeg * Math.PI) / 180;
    return { x: cx + r * Math.sin(rad), y: cy - r * Math.cos(rad) };
  }

  function describeWedge(cx, cy, r, startAngle, endAngle) {
    const start = polarPoint(cx, cy, r, startAngle);
    const end = polarPoint(cx, cy, r, endAngle);
    const largeArc = endAngle - startAngle > 180 ? 1 : 0;
    return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y} Z`;
  }

  function addWrappedLabel(x, y, angle, lines) {
    const text = document.createElementNS(SVG_NS, 'text');
    text.setAttribute('class', 'wheel__segment-label');
    text.setAttribute('x', String(x));
    text.setAttribute('y', String(y));
    text.setAttribute('font-size', '9');
    text.setAttribute('text-anchor', 'middle');

    let textRotation = angle;
    if (textRotation > 90 && textRotation < 270) textRotation += 180;
    text.setAttribute('transform', `rotate(${textRotation} ${x} ${y})`);

    lines.forEach((line, i) => {
      const tspan = document.createElementNS(SVG_NS, 'tspan');
      tspan.setAttribute('x', String(x));
      tspan.setAttribute('dy', i === 0 ? String(-((lines.length - 1) * 5.5)) : '11');
      tspan.textContent = line;
      text.appendChild(tspan);
    });

    return text;
  }

  function buildWheelSvg(prizes) {
    const cx = 110;
    const cy = 110;
    const r = 105;
    const totalWeight = prizes.reduce((sum, p) => sum + p.weight, 0);

    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 220 220');
    svg.setAttribute('class', 'wheel__svg');

    const segments = [];
    let angle = 0;

    prizes.forEach((prize) => {
      const sweep = (prize.weight / totalWeight) * 360;
      const startAngle = angle;
      const endAngle = angle + sweep;
      const midAngle = startAngle + sweep / 2;

      const path = document.createElementNS(SVG_NS, 'path');
      path.setAttribute('d', describeWedge(cx, cy, r, startAngle, endAngle));
      path.setAttribute('style', `fill: ${prize.color}`);
      path.setAttribute('stroke', 'var(--blanco-calido)');
      path.setAttribute('stroke-width', '2');
      svg.appendChild(path);

      const labelPoint = polarPoint(cx, cy, r * 0.62, midAngle);
      svg.appendChild(addWrappedLabel(labelPoint.x, labelPoint.y, midAngle, prize.lines));

      segments.push({ id: prize.id, midAngle });
      angle = endAngle;
    });

    const hub = document.createElementNS(SVG_NS, 'circle');
    hub.setAttribute('cx', String(cx));
    hub.setAttribute('cy', String(cy));
    hub.setAttribute('r', '14');
    hub.setAttribute('class', 'wheel__hub');
    svg.appendChild(hub);

    return { svg, segments };
  }

  let currentRotation = 0;

  function spinToSegment(svg, segment) {
    const extraSpins = 5 * 360;
    const target = currentRotation + extraSpins + (360 - segment.midAngle);
    currentRotation = target % 360;
    svg.style.transform = `rotate(${target}deg)`;
  }

  // -- Modal -----------------------------------------------------------------

  function buildModal() {
    const root = document.getElementById('wheel-modal-root');
    if (!root) return;

    const overlay = document.createElement('div');
    overlay.className = 'wheel-overlay';

    const modal = document.createElement('div');
    modal.className = 'wheel-modal';

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'wheel-modal__close';
    closeBtn.setAttribute('aria-label', 'Cerrar sin girar');
    closeBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"></path></svg>';

    const title = document.createElement('h2');
    title.className = 'wheel-modal__title';
    title.textContent = '¡Espera! Gira y gana';

    const subtitle = document.createElement('p');
    subtitle.className = 'wheel-modal__subtitle';
    subtitle.textContent = 'Una vuelta, un premio para tu pedido de hoy.';

    const wheelWrap = document.createElement('div');
    wheelWrap.className = 'wheel';

    const pointer = document.createElement('div');
    pointer.className = 'wheel__pointer';

    const { svg, segments } = buildWheelSvg(PRIZES_DISPLAY);
    wheelWrap.append(pointer, svg);

    const spinPrompt = document.createElement('div');
    spinPrompt.className = 'wheel-modal__spin-prompt';

    const spinButton = document.createElement('button');
    spinButton.type = 'button';
    spinButton.className = 'wheel-modal__spin-button';
    spinButton.textContent = 'Girar la ruleta';
    spinPrompt.appendChild(spinButton);

    const resultBox = document.createElement('div');
    resultBox.className = 'wheel-modal__result';

    const resultTitle = document.createElement('p');
    resultTitle.className = 'wheel-modal__result-label';

    const resultText = document.createElement('p');
    resultText.className = 'wheel-modal__result-text';

    const spinAgainButton = document.createElement('button');
    spinAgainButton.type = 'button';
    spinAgainButton.className = 'wheel-modal__spin-button';
    spinAgainButton.textContent = 'Girar de nuevo';
    spinAgainButton.hidden = true;

    const resultButton = document.createElement('button');
    resultButton.type = 'button';
    resultButton.className = 'wheel-modal__result-button';
    resultButton.textContent = 'Continuar con mi pedido';

    resultBox.append(resultTitle, resultText, spinAgainButton, resultButton);
    modal.append(closeBtn, title, subtitle, wheelWrap, spinPrompt, resultBox);
    overlay.appendChild(modal);
    root.appendChild(overlay);

    function close() {
      overlay.classList.remove('is-visible');
      window.setTimeout(() => overlay.remove(), 250);
    }

    closeBtn.addEventListener('click', close);
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) close();
    });
    resultButton.addEventListener('click', close);

    function doSpin() {
      spinButton.disabled = true;
      spinAgainButton.disabled = true;
      spinButton.textContent = 'Girando...';

      fetch('/api/wheel-spin', { method: 'POST' })
        .then((response) => {
          if (!response.ok) throw new Error('No se pudo girar');
          return response.json();
        })
        .then((data) => {
          const segment = segments.find((s) => s.id === data.prizeId) || segments[0];
          spinToSegment(svg, segment);

          window.setTimeout(() => {
            const copy = PRIZE_RESULT_COPY[data.prizeId] || PRIZE_RESULT_COPY['casi-ganas'];
            resultTitle.textContent = copy.title;
            resultText.textContent = copy.text;
            modal.classList.add('is-result');

            setSpinsUsed(data.spinsUsed);
            savePrizeWon(data.prizeId, data.token);
            applyWonPrizes();

            spinAgainButton.hidden = data.spinsRemaining <= 0;
            spinAgainButton.disabled = false;
            spinButton.disabled = false;
            spinButton.textContent = 'Girar la ruleta';
          }, 4700);
        })
        .catch(() => {
          spinButton.disabled = false;
          spinAgainButton.disabled = false;
          spinButton.textContent = 'Girar la ruleta';
        });
    }

    spinButton.addEventListener('click', doSpin);
    spinAgainButton.addEventListener('click', () => {
      modal.classList.remove('is-result');
      doSpin();
    });

    requestAnimationFrame(() => overlay.classList.add('is-visible'));
  }

  // -- Disparador: EXCLUSIVAMENTE el botón atrás (popstate) ------------------
  //
  // Por decisión explícita: la ruleta es una estrategia de exit-intent, así
  // que se reserva solo para el momento en que el cliente intenta irse — no
  // compite con un timer de inactividad que podría dispararse mientras el
  // cliente todavía está llenando el formulario (eso le restaba el único
  // intento disponible antes de que el cliente llegara a presionar atrás).
  //
  // Diseño de UN SOLO INTENTO: el primer back-press dispara el modal y
  // desarma el listener para siempre en esta carga de página — si el
  // cliente cierra la ruleta y presiona atrás de nuevo, sale normal. El
  // segundo giro (si queda) se resuelve con el botón "Girar de nuevo" DENTRO
  // del modal ya abierto, nunca disparando un nuevo intento de salida.

  function initTriggers() {
    applyWonPrizes();

    if (getSpinsUsed() >= MAX_SPINS) return;

    let triggered = false;

    function trigger() {
      if (triggered) return;
      triggered = true;
      window.removeEventListener('popstate', onPopState);
      buildModal();
    }

    function onPopState() {
      trigger();
    }

    // Truco estándar para "exit intent" con botón de retroceso: se agrega
    // una entrada extra al historial para que el primer back-press dispare
    // un popstate en esta misma página en vez de sacar al usuario del
    // checkout de inmediato.
    window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', onPopState);

    // bfcache (muy relevante en iOS Safari, también ocurre en Chrome
    // móvil): si el navegador restaura esta página desde caché en vez de
    // recargarla, popstate puede no dispararse de forma confiable. Si eso
    // ocurre y la ruleta todavía no se mostró, se dispara directamente acá.
    window.addEventListener('pageshow', (event) => {
      if (event.persisted) trigger();
    });
  }

  document.addEventListener('DOMContentLoaded', initTriggers);
})();
