function trackViewContentOnce() {
  trackFbq('ViewContent', {
    content_name: INTACTO_PRODUCT.contentName,
    content_type: INTACTO_PRODUCT.contentType,
    value: INTACTO_PRODUCT.value,
    currency: INTACTO_PRODUCT.currency
  });
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
      if (entry.isIntersecting) {
        // La tarjeta está visible: la barra sticky se mantiene oculta.
        stickyCta.classList.remove('is-visible');
        return;
      }

      // No está intersectando, pero eso puede significar dos cosas muy
      // distintas: (a) todavía no se llegó a ella (sigue más abajo, boundingClientRect.top > 0 —
      // no se debe mostrar la barra todavía) o (b) ya se pasó de largo hacia
      // arriba (boundingClientRect.top < 0 — ahí sí corresponde mostrarla).
      const scrolledPast = entry.boundingClientRect.top < 0;
      stickyCta.classList.toggle('is-visible', scrolledPast);
    });
  }, { threshold: 0.15 });

  observer.observe(heroCard);
}

function populateHeroStock(available) {
  const shipping = document.querySelector('.hero__shipping');
  if (!shipping || document.querySelector('.hero__stock')) return;

  const stock = document.createElement('p');
  stock.className = 'hero__stock';

  const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  icon.setAttribute('class', 'hero__stock-icon');
  icon.setAttribute('viewBox', '0 0 24 24');
  icon.setAttribute('fill', 'none');
  icon.setAttribute('stroke', 'currentColor');
  icon.setAttribute('stroke-width', '1.6');
  icon.setAttribute('stroke-linecap', 'round');
  icon.setAttribute('stroke-linejoin', 'round');
  icon.setAttribute('aria-hidden', 'true');
  icon.innerHTML = '<path d="M12 3 4 7v10l8 4 8-4V7z"></path><path d="M4 7l8 4 8-4"></path><path d="M12 11v10"></path>';

  const count = document.createElement('span');
  count.className = 'hero__stock-count';
  count.textContent = available;

  stock.append(icon, 'Quedan ', count, ' unidades del primer lote');
  shipping.insertAdjacentElement('afterend', stock);
}

function populateStickyStock(available) {
  const stickyButton = document.querySelector('.sticky-cta__button');
  if (!stickyButton || document.querySelector('.sticky-cta__stock')) return;

  const stock = document.createElement('p');
  stock.className = 'sticky-cta__stock';

  const count = document.createElement('span');
  count.className = 'sticky-cta__stock-count';
  count.textContent = available;

  stock.append('Quedan ', count, ' unidades del primer lote');
  stickyButton.insertAdjacentElement('beforebegin', stock);
}

function initInventoryDisplays() {
  const heroShipping = document.querySelector('.hero__shipping');
  const stickyButton = document.querySelector('.sticky-cta__button');
  if (!heroShipping && !stickyButton) return;

  // Un solo fetch alimenta ambos consumidores (hero + barra sticky) — el
  // servidor ya cachea 45s, así que esto además evita un segundo round-trip
  // innecesario desde el cliente para el mismo dato.
  fetch('/api/get-inventory')
    .then((response) => {
      if (!response.ok) throw new Error('Respuesta no válida');
      return response.json();
    })
    .then((data) => {
      if (typeof data.available !== 'number') throw new Error('Payload inválido');
      if (heroShipping) populateHeroStock(data.available);
      if (stickyButton) populateStickyStock(data.available);
    })
    .catch(() => {
      // silenciosamente no se agrega nada si falla o el payload es inválido
    });
}

document.addEventListener('DOMContentLoaded', () => {
  initHeroGallery();
  initResultados();
  initComparativa();
  initStickyCtaVisibility();
  initInventoryDisplays();
  trackViewContentOnce();

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
});
