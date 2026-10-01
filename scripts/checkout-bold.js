(function () {
  document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('checkout-form');
    const codSubmitButton = document.getElementById('cod-submit-button');
    const boldArea = document.getElementById('bold-payment-area');
    const prepareButton = document.getElementById('bold-prepare-button');
    const errorText = document.getElementById('bold-prepare-error');
    const paymentNote = document.getElementById('payment-method-note');

    if (!form || !codSubmitButton || !boldArea || !prepareButton) return;

    const radios = form.querySelectorAll('input[name="payment-method"]');

    radios.forEach((radio) => {
      radio.addEventListener('change', () => {
        const isBold = radio.value === 'bold' && radio.checked;
        if (!radio.checked) return;

        codSubmitButton.hidden = isBold;
        codSubmitButton.disabled = isBold;
        boldArea.hidden = !isBold;

        if (paymentNote) {
          paymentNote.textContent = isBold
            ? 'Pago seguro procesado por Bold — tarjeta, Nequi o Bre-B.'
            : 'Pagas en efectivo o con datáfono cuando recibas tu pedido — sin adelantos.';
        }
      });
    });

    // Una vez armado el checkout de Bold con los datos reales (order-id,
    // monto, firma), se reutiliza: un segundo click solo vuelve a abrir el
    // mismo widget, sin pegarle de nuevo al backend.
    let checkout = null;
    let preparing = false;

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
      const telefono = form.telefono.value.trim();
      const direccion = form.direccion.value.trim();
      const ciudad = form.ciudad.value.trim();
      const email = form.email.value.trim();
      const wheelState = window.INTACTO_WHEEL_STATE || {};

      try {
        const orderResponse = await fetch('/api/create-bold-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nombre,
            telefono,
            direccion,
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
