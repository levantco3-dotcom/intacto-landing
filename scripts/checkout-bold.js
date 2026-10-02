(function () {
  const KIT_PRICE_COP = 119900;
  const SECOND_KIT_PRICE_COP = 83930;

  function formatCOP(amount) {
    return '$' + Math.round(amount).toLocaleString('es-CO');
  }

  // Estimación client-side SOLO para mostrar el precio antes de pagar — el
  // monto real y la firma siempre los calcula el servidor en
  // create-bold-order.js, nunca se confía en esto para cobrar.
  function computeSubtotal() {
    const wheelState = window.INTACTO_WHEEL_STATE || {};
    const prizeIds = wheelState.prizeIds || [];
    const wonSecondKit = prizeIds.includes('segundo-kit-30') && wheelState.wantsSecondKit === true;
    return wonSecondKit ? KIT_PRICE_COP + SECOND_KIT_PRICE_COP : KIT_PRICE_COP;
  }

  function computeBoldDiscountRate() {
    const wheelState = window.INTACTO_WHEEL_STATE || {};
    const prizeIds = wheelState.prizeIds || [];
    let rate = 0.05; // siempre 5% por elegir pagar con Bold
    if (prizeIds.includes('prepago-5')) rate += 0.05; // se acumula con el premio de la ruleta
    return rate;
  }

  function updatePriceDisplays() {
    const subtotal = computeSubtotal();
    const codPriceEl = document.getElementById('cod-price');
    const boldOldEl = document.getElementById('bold-price-old');
    const boldNewEl = document.getElementById('bold-price-new');

    if (codPriceEl) codPriceEl.textContent = formatCOP(subtotal);
    if (boldOldEl) boldOldEl.textContent = formatCOP(subtotal);
    if (boldNewEl) boldNewEl.textContent = formatCOP(subtotal * (1 - computeBoldDiscountRate()));
  }

  document.addEventListener('DOMContentLoaded', () => {
    updatePriceDisplays();
    window.addEventListener('intacto:wheel-state-changed', updatePriceDisplays);

    const form = document.getElementById('checkout-form');
    const codSubmitButton = document.getElementById('cod-submit-button');
    const boldArea = document.getElementById('bold-payment-area');
    const prepareButton = document.getElementById('bold-prepare-button');
    const errorText = document.getElementById('bold-prepare-error');
    const paymentNote = document.getElementById('payment-method-note');

    if (!form || !codSubmitButton || !boldArea || !prepareButton) return;

    const radios = form.querySelectorAll('input[name="payment-method"]');

    function applyPaymentMethodUI(isBold) {
      codSubmitButton.hidden = isBold;
      codSubmitButton.disabled = isBold;
      boldArea.hidden = !isBold;

      if (paymentNote) {
        paymentNote.textContent = isBold
          ? 'Pago seguro procesado por Bold — tarjeta, Nequi o Bre-B.'
          : 'Pagas en efectivo o con datáfono cuando recibas tu pedido — sin adelantos.';
      }
    }

    // Bold viene pre-seleccionado por defecto (checked en el HTML), así que
    // el estado inicial de la UI se aplica una vez al cargar — el evento
    // 'change' nunca dispara para una opción que ya nace marcada.
    const initiallyChecked = Array.prototype.find.call(radios, (r) => r.checked);
    applyPaymentMethodUI(!!initiallyChecked && initiallyChecked.value === 'bold');

    radios.forEach((radio) => {
      radio.addEventListener('change', () => {
        if (!radio.checked) return;
        applyPaymentMethodUI(radio.value === 'bold');
      });
    });

    // Una vez armado el checkout de Bold con los datos reales (order-id,
    // monto, firma), se reutiliza: un segundo click solo vuelve a abrir el
    // mismo widget, sin pegarle de nuevo al backend.
    let checkout = null;
    let preparing = false;

    function resolveCiudad() {
      const ciudadSelect = document.getElementById('ciudad');
      const ciudadOtroInput = document.getElementById('ciudad-otro');
      const OTRO_VALUE = window.COLOMBIA_OTHER_CITY_VALUE || '__otro__';
      if (ciudadSelect && ciudadSelect.value === OTRO_VALUE) {
        return ciudadOtroInput ? ciudadOtroInput.value.trim() : '';
      }
      return ciudadSelect ? ciudadSelect.value : '';
    }

    prepareButton.addEventListener('click', async () => {
      if (checkout) {
        checkout.open();
        return;
      }

      if (preparing) return;

      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      preparing = true;
      prepareButton.disabled = true;
      prepareButton.textContent = 'Preparando pago...';
      errorText.hidden = true;

      const nombre = form.nombre.value.trim();
      const apellidos = form.apellidos.value.trim();
      const telefono = form.telefono.value.trim();
      const direccion = form.direccion.value.trim();
      const direccion2 = form.direccion2.value.trim();
      const departamento = document.getElementById('departamento').value;
      const ciudad = resolveCiudad();
      const email = form.email.value.trim();
      const wheelState = window.INTACTO_WHEEL_STATE || {};

      try {
        const orderResponse = await fetch('/api/create-bold-order', {
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
            wheelTokens: wheelState.tokens || [],
            wantsSecondKit: wheelState.wantsSecondKit
          })
        });

        const orderData = await orderResponse.json();
        if (!orderResponse.ok || !orderData.success) {
          throw new Error(orderData.error || `HTTP ${orderResponse.status}`);
        }

        const { orderId, amount, currency, apiKey } = orderData;

        const signatureResponse = await fetch('/api/bold-signature', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId, amount, currency })
        });

        const signatureData = await signatureResponse.json();
        if (!signatureResponse.ok || !signatureData.signature) {
          throw new Error(signatureData.error || `HTTP ${signatureResponse.status}`);
        }

        if (typeof BoldCheckout !== 'function') {
          throw new Error('No se pudo cargar el widget de Bold. Recargá la página e intentá de nuevo.');
        }

        // Integración programática (no el botón data-bold-button): el
        // monto y el order-id solo se conocen después de estas dos
        // llamadas al backend, así que no hay forma de tenerlos listos de
        // entrada como pide el botón declarativo de Bold.
        checkout = new BoldCheckout({
          orderId,
          currency,
          amount: String(amount),
          apiKey,
          integritySignature: signatureData.signature,
          description: 'Kit INTACTO',
          redirectionUrl: `${window.location.origin}/gracias`,
          renderMode: 'embedded'
        });

        prepareButton.disabled = false;
        prepareButton.textContent = 'Pagar con Bold';
        preparing = false;

        checkout.open();
      } catch (err) {
        preparing = false;
        checkout = null;
        prepareButton.disabled = false;
        prepareButton.textContent = 'Pagar con Bold';
        errorText.textContent = `No pudimos preparar el pago: ${err.message || 'error desconocido'}. Intenta de nuevo.`;
        errorText.hidden = false;
      }
    });
  });
})();
