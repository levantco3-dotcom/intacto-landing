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
      telefonoInput.value = telefonoInput.value.replace(/\D/g, '').slice(0, 10);
    });
  }

  // -- Departamento → Ciudad (cascada) --------------------------------------
  const departamentoSelect = document.getElementById('departamento');
  const ciudadSelect = document.getElementById('ciudad');
  const ciudadOtroField = document.getElementById('ciudad-otro-field');
  const ciudadOtroInput = document.getElementById('ciudad-otro');
  const departamentos = window.COLOMBIA_DEPARTMENTS || [];
  const OTRO_VALUE = window.COLOMBIA_OTHER_CITY_VALUE || '__otro__';

  if (departamentoSelect && ciudadSelect) {
    departamentos.forEach((dep) => {
      const option = document.createElement('option');
      option.value = dep.name;
      option.textContent = dep.name;
      departamentoSelect.appendChild(option);
    });

    departamentoSelect.addEventListener('change', () => {
      const selected = departamentos.find((dep) => dep.name === departamentoSelect.value);

      ciudadSelect.innerHTML = '';
      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.disabled = true;
      placeholder.selected = true;
      placeholder.textContent = 'Selecciona tu ciudad/municipio';
      ciudadSelect.appendChild(placeholder);

      if (selected) {
        selected.cities.forEach((city) => {
          const option = document.createElement('option');
          option.value = city;
          option.textContent = city;
          ciudadSelect.appendChild(option);
        });

        const otroOption = document.createElement('option');
        otroOption.value = OTRO_VALUE;
        otroOption.textContent = 'Otro municipio';
        ciudadSelect.appendChild(otroOption);

        ciudadSelect.disabled = false;
      } else {
        ciudadSelect.disabled = true;
      }

      ciudadOtroField.hidden = true;
      ciudadOtroInput.required = false;
      ciudadOtroInput.value = '';
    });

    ciudadSelect.addEventListener('change', () => {
      const isOtro = ciudadSelect.value === OTRO_VALUE;
      ciudadOtroField.hidden = !isOtro;
      ciudadOtroInput.required = isOtro;
      if (!isOtro) ciudadOtroInput.value = '';
    });
  }

  function resolveCiudad() {
    if (ciudadSelect && ciudadSelect.value === OTRO_VALUE) {
      return ciudadOtroInput.value.trim();
    }
    return ciudadSelect ? ciudadSelect.value : '';
  }

  const submitButton = form.querySelector('.checkout-page__submit');
  const resultBox = document.getElementById('checkout-result');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    // Si el cliente eligió pagar con Bold, este submit (contra entrega)
    // nunca debe ejecutarse — el flujo de Bold lo maneja checkout-bold.js
    // por su cuenta con un botón type="button" aparte.
    const selectedMethod = form.querySelector('input[name="payment-method"]:checked');
    if (selectedMethod && selectedMethod.value === 'bold') return;

    const nombre = form.nombre.value.trim();
    const apellidos = form.apellidos.value.trim();
    const telefono = form.telefono.value.trim();
    const direccion = form.direccion.value.trim();
    const direccion2 = form.direccion2.value.trim();
    const departamento = departamentoSelect ? departamentoSelect.value : '';
    const ciudad = resolveCiudad();
    const email = form.email.value.trim();

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
          apellidos,
          telefono,
          direccion,
          direccion2,
          departamento,
          ciudad,
          email,
          eventId,
          eventSourceUrl: window.location.href,
          wheelTokens: wheelState.tokens || [],
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
