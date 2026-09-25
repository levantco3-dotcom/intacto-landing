// Datos del producto único, reutilizados por los eventos de Meta Pixel.
const INTACTO_PRODUCT = {
  contentName: 'Kit INTACTO',
  contentType: 'product',
  value: 119900,
  currency: 'COP'
};

function trackFbq(eventName, params, options) {
  if (typeof fbq !== 'function') return;
  if (options) {
    fbq('track', eventName, params, options);
  } else {
    fbq('track', eventName, params);
  }
}

function trackViewContentOnce() {
  trackFbq('ViewContent', {
    content_name: INTACTO_PRODUCT.contentName,
    content_type: INTACTO_PRODUCT.contentType,
    value: INTACTO_PRODUCT.value,
    currency: INTACTO_PRODUCT.currency
  });
}

function initInitiateCheckoutTracking() {
  const STORAGE_KEY = 'intacto_initiate_checkout_fired';
  let fired = false;

  try {
    fired = sessionStorage.getItem(STORAGE_KEY) === '1';
  } catch (err) {
    // sessionStorage no disponible (modo privado, etc.) — se controla solo con la variable en memoria
  }

  function fireOnce() {
    if (fired) return;
    fired = true;

    try {
      sessionStorage.setItem(STORAGE_KEY, '1');
    } catch (err) {
      // no crítico si no se puede persistir
    }

    trackFbq('InitiateCheckout', {
      content_name: INTACTO_PRODUCT.contentName,
      content_type: INTACTO_PRODUCT.contentType,
      value: INTACTO_PRODUCT.value,
      currency: INTACTO_PRODUCT.currency
    });
  }

  if (fired) return; // ya se disparó en una carga anterior de esta misma sesión

  const form = document.getElementById('checkout-form');
  if (form) {
    form.querySelectorAll('input').forEach((input) => {
      input.addEventListener('focus', fireOnce, { once: true });
      input.addEventListener('input', fireOnce, { once: true });
    });
  }

  document.querySelectorAll('[data-scroll-to="#pedido"]').forEach((el) => {
    el.addEventListener('click', fireOnce);
  });
}

function generateEventId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `evt_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function buildComparativaBlobCell(entry, isIntacto) {
  const cell = document.createElement('div');
  cell.className = 'comparativa__cell comparativa__blob-cell' + (isIntacto ? ' comparativa__cell--intacto comparativa__cell--intacto-first' : '');

  const blob = document.createElement('div');
  blob.className = 'comparativa__blob';

  const img = document.createElement('img');
  img.src = entry.img;
  img.alt = entry.alt || entry.titulo;
  img.loading = 'lazy';
  blob.appendChild(img);

  cell.appendChild(blob);
  return cell;
}

function buildComparativaTitleCell(entry, isIntacto) {
  const cell = document.createElement('div');
  cell.className = 'comparativa__cell comparativa__title-cell' + (isIntacto ? ' comparativa__cell--intacto' : '');

  const title = document.createElement('h3');
  title.className = 'comparativa__column-title';
  title.textContent = entry.titulo;

  cell.appendChild(title);
  return cell;
}

function buildComparativaRowCell(item, isIntacto, isLast) {
  const cell = document.createElement('dl');
  cell.className = 'comparativa__cell comparativa__row-cell' +
    (isLast ? ' comparativa__row-cell--last' : '') +
    (isIntacto ? ' comparativa__cell--intacto' : '') +
    (isIntacto && isLast ? ' comparativa__cell--intacto-last' : '');

  const dt = document.createElement('dt');
  dt.textContent = item.etiqueta;

  const dd = document.createElement('dd');
  dd.textContent = item.valor;

  cell.append(dt, dd);
  return cell;
}

function renderComparativaPanel(tabId) {
  const panel = document.getElementById('comparativa-panel');
  const data = typeof COMPARATIVA_DATA !== 'undefined' ? COMPARATIVA_DATA : [];
  const intacto = typeof COMPARATIVA_INTACTO !== 'undefined' ? COMPARATIVA_INTACTO : null;
  if (!panel || !intacto) return;

  const entry = data.find((item) => item.id === tabId) || data[0];
  if (!entry) return;

  panel.innerHTML = '';

  const columns = document.createElement('div');
  columns.className = 'comparativa__columns';

  columns.append(
    buildComparativaBlobCell(entry, false),
    buildComparativaBlobCell(intacto, true),
    buildComparativaTitleCell(entry, false),
    buildComparativaTitleCell(intacto, true)
  );

  const rowCount = Math.max(entry.items.length, intacto.items.length);
  for (let i = 0; i < rowCount; i += 1) {
    const isLast = i === rowCount - 1;
    if (entry.items[i]) columns.appendChild(buildComparativaRowCell(entry.items[i], false, isLast));
    if (intacto.items[i]) columns.appendChild(buildComparativaRowCell(intacto.items[i], true, isLast));
  }

  panel.appendChild(columns);
}

function initComparativa() {
  const data = typeof COMPARATIVA_DATA !== 'undefined' ? COMPARATIVA_DATA : [];
  const tabsContainer = document.getElementById('comparativa-tabs');
  const panel = document.getElementById('comparativa-panel');
  if (!tabsContainer || !panel || !data.length) return;

  data.forEach((entry, index) => {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = 'comparativa__tab' + (index === 0 ? ' is-active' : '');
    tab.textContent = entry.tab;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('data-tab', entry.id);
    tab.setAttribute('aria-selected', index === 0 ? 'true' : 'false');
    tabsContainer.appendChild(tab);
  });

  const tabs = Array.from(tabsContainer.querySelectorAll('.comparativa__tab'));

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      if (tab.classList.contains('is-active')) return;

      tabs.forEach((t) => {
        t.classList.remove('is-active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('is-active');
      tab.setAttribute('aria-selected', 'true');

      panel.classList.remove('is-visible');
      window.setTimeout(() => {
        renderComparativaPanel(tab.getAttribute('data-tab'));
        requestAnimationFrame(() => panel.classList.add('is-visible'));
      }, 180);
    });
  });

  renderComparativaPanel(data[0].id);
  requestAnimationFrame(() => panel.classList.add('is-visible'));
}

function getResultadoCaption(item) {
  if (item.tipo === 'comparacion-lateral') {
    const left = item.sucio === 'izquierda' ? 'ANTES' : 'DESPUÉS';
    const right = item.sucio === 'derecha' ? 'ANTES' : 'DESPUÉS';
    return `${left} · ${right}`;
  }

  if (item.tipo === 'combo-vertical') {
    const top = item.sucio === 'arriba' ? 'ANTES' : 'DESPUÉS';
    const bottom = item.sucio === 'abajo' ? 'ANTES' : 'DESPUÉS';
    return `${top} (arriba) · ${bottom} (abajo)`;
  }

  return 'CON INTACTO';
}

function initResultados() {
  const data = typeof RESULTADOS_DATA !== 'undefined' ? RESULTADOS_DATA : [];
  const carousel = document.getElementById('resultados-carousel');
  const progress = document.getElementById('resultados-progress');
  if (!carousel || !progress || !data.length) return;

  data.forEach((item) => {
    const card = document.createElement('article');
    card.className = 'resultado-card';

    const frame = document.createElement('div');
    frame.className = 'resultado-card__frame';

    const photo = document.createElement('div');
    photo.className = 'resultado-card__photo';

    const img = document.createElement('img');
    img.className = 'resultado-card__img';
    img.src = item.src;
    img.alt = 'Resultado real con INTACTO';
    img.loading = 'lazy';
    photo.appendChild(img);

    const caption = document.createElement('p');
    caption.className = 'resultado-card__caption';
    caption.textContent = getResultadoCaption(item);

    frame.appendChild(photo);
    frame.appendChild(caption);
    card.appendChild(frame);
    carousel.appendChild(card);

    const line = document.createElement('span');
    line.className = 'resultados__progress-line';
    progress.appendChild(line);
  });

  const cards = Array.from(carousel.querySelectorAll('.resultado-card'));
  const lines = progress.querySelectorAll('.resultados__progress-line');

  if (lines.length) lines[0].classList.add('is-active');

  if ('IntersectionObserver' in window) {
    const progressObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const index = cards.indexOf(entry.target);
        if (index === -1) return;
        lines.forEach((line) => line.classList.remove('is-active'));
        lines[index].classList.add('is-active');
      });
    }, { root: carousel, threshold: 0.6 });

    cards.forEach((card) => progressObserver.observe(card));
  }
}

function initHeroGallery() {
  const gallery = document.getElementById('hero-gallery');
  if (!gallery) return;

  const mainImg = document.getElementById('hero-gallery-main-img');
  const thumbs = Array.from(gallery.querySelectorAll('.hero__gallery-thumb'));
  if (!mainImg || !thumbs.length) return;

  let index = 0;
  let isSwapping = false;

  function setActive(newIndex) {
    if (isSwapping) return;
    index = (newIndex + thumbs.length) % thumbs.length;
    const thumb = thumbs[index];

    thumbs.forEach((t, i) => {
      const isActive = i === index;
      t.classList.toggle('is-active', isActive);
      t.setAttribute('aria-selected', String(isActive));
    });

    isSwapping = true;
    mainImg.style.opacity = '0';
    window.setTimeout(() => {
      mainImg.src = thumb.getAttribute('data-src');
      mainImg.alt = thumb.getAttribute('data-alt') || '';
      mainImg.style.opacity = '1';
      isSwapping = false;
    }, 150);
  }

  thumbs.forEach((thumb, i) => {
    thumb.addEventListener('click', () => setActive(i));
  });

  let touchStartX = 0;
  let touchDeltaX = 0;
  let isTouching = false;

  const mainMedia = gallery.querySelector('.hero__gallery-main');

  mainMedia.addEventListener('touchstart', (event) => {
    isTouching = true;
    touchStartX = event.touches[0].clientX;
    touchDeltaX = 0;
  }, { passive: true });

  mainMedia.addEventListener('touchmove', (event) => {
    if (!isTouching) return;
    touchDeltaX = event.touches[0].clientX - touchStartX;
  }, { passive: true });

  mainMedia.addEventListener('touchend', () => {
    if (!isTouching) return;
    isTouching = false;

    const threshold = 40;
    if (touchDeltaX > threshold) {
      setActive(index - 1);
    } else if (touchDeltaX < -threshold) {
      setActive(index + 1);
    }
    touchDeltaX = 0;
  });
}

function initStickyCtaVisibility() {
  const heroCard = document.querySelector('.hero__card');
  const stickyCta = document.querySelector('.sticky-cta');
  if (!heroCard || !stickyCta) return;

  if (!('IntersectionObserver' in window)) {
    stickyCta.classList.add('is-visible');
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      stickyCta.classList.toggle('is-visible', !entry.isIntersecting);
    });
  }, { threshold: 0.15 });

  observer.observe(heroCard);
}

document.addEventListener('DOMContentLoaded', () => {
  initHeroGallery();
  initResultados();
  initComparativa();
  initStickyCtaVisibility();
  trackViewContentOnce();
  initInitiateCheckoutTracking();

  const scrollTargets = document.querySelectorAll('[data-scroll-to]');
  scrollTargets.forEach((el) => {
    el.addEventListener('click', () => {
      const target = document.querySelector(el.getAttribute('data-scroll-to'));
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  const escenas = document.querySelectorAll('.escena');
  if (escenas.length && 'IntersectionObserver' in window) {
    const escenaObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-unlocked');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.4 });

    escenas.forEach((escena) => escenaObserver.observe(escena));
  } else {
    escenas.forEach((escena) => escena.classList.add('is-unlocked'));
  }

  const form = document.getElementById('checkout-form');
  if (!form) return;

  const telefonoInput = document.getElementById('telefono');
  if (telefonoInput) {
    telefonoInput.addEventListener('input', () => {
      const digits = telefonoInput.value.replace(/\D/g, '');
      const isInvalid = digits.length > 0 && digits.length !== 10;
      telefonoInput.setAttribute('data-invalid', String(isInvalid));
    });
  }

  const submitButton = form.querySelector('.checkout__submit');
  const resultBox = document.getElementById('checkout-result');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const nombre = form.nombre.value.trim();
    const telefono = form.telefono.value.trim();
    const direccion = form.direccion.value.trim();
    const ciudad = form.ciudad.value.trim();

    // event_id único por pedido: se manda al backend para que dispare la
    // Purchase de servidor (Conversions API) con el MISMO id que usará el
    // pixel del navegador, para que Meta deduplique un solo evento.
    const eventId = generateEventId();

    submitButton.disabled = true;
    submitButton.textContent = 'Enviando...';

    try {
      const response = await fetch('/api/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre,
          telefono,
          direccion,
          ciudad,
          eventId,
          eventSourceUrl: window.location.href
        })
      });

      const data = await response.json();

      if (data.success) {
        showResult('success', data.orderNumber);
        form.reset();

        // Purchase solo se dispara aquí porque el backend ya confirmó que
        // la orden se creó en Shopify. El mismo eventId ya se usó del lado
        // del servidor para la Conversions API — eventID aquí deduplica.
        trackFbq('Purchase', {
          content_name: INTACTO_PRODUCT.contentName,
          content_type: INTACTO_PRODUCT.contentType,
          value: INTACTO_PRODUCT.value,
          currency: INTACTO_PRODUCT.currency
        }, { eventID: eventId });
      } else {
        showResult('error');
      }
    } catch (err) {
      showResult('error');
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = 'Confirmar pedido';
    }
  });

  function showResult(state, orderNumber) {
    form.hidden = true;
    resultBox.setAttribute('data-state', state);

    if (state === 'success') {
      const whatsappMessage = encodeURIComponent(`Hola, acabo de hacer el pedido ${orderNumber}`);
      resultBox.innerHTML = `
        <p class="checkout__result-title">Pedido confirmado — ${orderNumber}</p>
        <p class="checkout__result-reinforcement">Tus tenis te lo van a agradecer. Bienvenido a INTACTO.</p>
        <p class="checkout__result-text">Te vamos a escribir por WhatsApp en las próximas horas para confirmar tu dirección de entrega.</p>
        <a class="checkout__result-whatsapp" href="https://wa.me/573203886918?text=${whatsappMessage}" target="_blank" rel="noopener noreferrer">Escríbenos por WhatsApp</a>
      `;
    } else {
      resultBox.innerHTML = `
        <p class="checkout__result-title">No pudimos procesar tu pedido</p>
        <p class="checkout__result-text">Escríbenos por WhatsApp y lo confirmamos ahí mismo.</p>
        <a class="checkout__result-whatsapp" href="https://wa.me/573203886918?text=${encodeURIComponent('Hola, quiero hacer un pedido de INTACTO')}" target="_blank" rel="noopener noreferrer">Escríbenos por WhatsApp</a>
      `;
    }

    resultBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
});
