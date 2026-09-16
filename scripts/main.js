document.addEventListener('DOMContentLoaded', () => {
  const inventoryBanner = document.getElementById('inventory-banner');
  const inventoryCount = document.getElementById('inventory-count');

  if (inventoryBanner && inventoryCount) {
    fetch('/api/get-inventory')
      .then((response) => {
        if (!response.ok) throw new Error('Respuesta no válida');
        return response.json();
      })
      .then((data) => {
        if (typeof data.available !== 'number') throw new Error('Payload inválido');
        inventoryCount.textContent = data.available;
        inventoryBanner.hidden = false;
        document.body.classList.add('has-inventory-banner');
      })
      .catch(() => {
        inventoryBanner.hidden = true;
      });
  }

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

    submitButton.disabled = true;
    submitButton.textContent = 'Enviando...';

    try {
      const response = await fetch('/api/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, telefono, direccion, ciudad })
      });

      const data = await response.json();

      if (data.success) {
        showResult('success', data.orderNumber);
        form.reset();
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
