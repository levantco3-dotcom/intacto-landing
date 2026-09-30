function generateEventId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `evt_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

document.addEventListener('DOMContentLoaded', () => {
  // Llegar a esta página ya es la intención de compra — se dispara una sola
  // vez, al cargar, en vez de depender de la primera interacción con un
  // formulario embebido (que ya no existe en la landing).
  trackFbq('InitiateCheckout', {
    content_name: INTACTO_PRODUCT.contentName,
    content_type: INTACTO_PRODUCT.contentType,
    value: INTACTO_PRODUCT.value,
    currency: INTACTO_PRODUCT.currency
  });

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

  const submitButton = form.querySelector('.checkout-page__submit');
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

    // Si la ruleta de exit-intent ya se giró en esta sesión, se manda el
    // token firmado (nunca el prizeId "en crudo") para que el servidor lo
    // vuelva a verificar antes de aplicar cualquier premio.
    const wheelState = window.INTACTO_WHEEL_STATE || {};

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
          eventSourceUrl: window.location.href,
          wheelToken: wheelState.token,
          wantsSecondKit: wheelState.wantsSecondKit
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
        <p class="checkout-page__result-title">Pedido confirmado — ${orderNumber}</p>
        <p class="checkout-page__result-reinforcement">Tus tenis te lo van a agradecer. Bienvenido a INTACTO.</p>
        <p class="checkout-page__result-text">Te vamos a escribir por WhatsApp en las próximas horas para confirmar tu dirección de entrega.</p>
        <a class="checkout-page__result-whatsapp" href="https://wa.me/573203886918?text=${whatsappMessage}" target="_blank" rel="noopener noreferrer">Escríbenos por WhatsApp</a>
      `;
    } else {
      resultBox.innerHTML = `
        <p class="checkout-page__result-title">No pudimos procesar tu pedido</p>
        <p class="checkout-page__result-text">Escríbenos por WhatsApp y lo confirmamos ahí mismo.</p>
        <a class="checkout-page__result-whatsapp" href="https://wa.me/573203886918?text=${encodeURIComponent('Hola, quiero hacer un pedido de INTACTO')}" target="_blank" rel="noopener noreferrer">Escríbenos por WhatsApp</a>
      `;
    }

    resultBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
});
