(function () {
  const BOLD_SCRIPT_SRC = 'https://checkout.bold.co/library/boldPaymentButton.js';

  document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('checkout-form');
    const codSubmitButton = document.getElementById('cod-submit-button');
    const boldArea = document.getElementById('bold-payment-area');
    const prepareButton = document.getElementById('bold-prepare-button');
    const errorText = document.getElementById('bold-prepare-error');
    const buttonContainer = document.getElementById('bold-button-container');
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

    let prepared = false;

    prepareButton.addEventListener('click', async () => {
      if (prepared) return;

      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      prepared = true;
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
        const draftResponse = await fetch('/api/create-bold-draft-order', {
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

        const draftData = await draftResponse.json();
        if (!draftResponse.ok || !draftData.success) {
          throw new Error(draftData.error || `HTTP ${draftResponse.status}`);
        }

        const { orderId, amount, currency, apiKey } = draftData;

        const signatureResponse = await fetch('/api/bold-signature', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId, amount, currency })
        });

        const signatureData = await signatureResponse.json();
        if (!signatureResponse.ok || !signatureData.signature) {
          throw new Error(signatureData.error || `HTTP ${signatureResponse.status}`);
        }

        const boldButton = document.createElement('button');
        boldButton.type = 'button';
        boldButton.setAttribute('data-bold-button', 'dark-L');
        boldButton.setAttribute('data-api-key', apiKey);
        boldButton.setAttribute('data-order-id', orderId);
        boldButton.setAttribute('data-currency', currency);
        boldButton.setAttribute('data-amount', String(amount));
        boldButton.setAttribute('data-integrity-signature', signatureData.signature);
        boldButton.setAttribute('data-description', 'Kit INTACTO');
        boldButton.setAttribute('data-redirection-url', `${window.location.origin}/gracias`);

        buttonContainer.appendChild(boldButton);

        // El script de Bold escanea el DOM al cargarse, por eso se agrega
        // recién ahora que el botón con sus atributos ya está en la página.
        const script = document.createElement('script');
        script.src = BOLD_SCRIPT_SRC;
        document.body.appendChild(script);

        prepareButton.hidden = true;
      } catch (err) {
        prepared = false;
        prepareButton.disabled = false;
        prepareButton.textContent = 'Continuar al pago';
        errorText.textContent = `No pudimos preparar el pago: ${err.message || 'error desconocido'}. Intenta de nuevo.`;
        errorText.hidden = false;
      }
    });
  });
})();
