'use strict';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    let registration;
    let updateBanner;
    let reloading = false;

    const showUpdate = () => {
      if (updateBanner || !document.body) return;

      updateBanner = document.createElement('aside');
      updateBanner.setAttribute('role', 'status');
      updateBanner.setAttribute('aria-live', 'polite');
      updateBanner.style.cssText = [
        'position:fixed',
        'z-index:99999',
        'left:16px',
        'right:16px',
        'bottom:calc(16px + env(safe-area-inset-bottom, 0px))',
        'max-width:560px',
        'margin:0 auto',
        'padding:14px 16px',
        'display:flex',
        'align-items:center',
        'justify-content:space-between',
        'gap:14px',
        'background:#fffdf8',
        'color:#292629',
        'border:1px solid #d8c7a5',
        'border-radius:16px',
        'box-shadow:0 8px 30px rgba(35,25,20,.18)',
        'font:500 14px/1.45 Inter,Arial,sans-serif'
      ].join(';');

      const message = document.createElement('span');
      message.textContent = 'Hay una nueva versión de la aplicación disponible. Tus datos están a salvo.';
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = 'Actualizar ahora';
      button.style.cssText = 'flex:none;border:0;border-radius:10px;padding:11px 14px;background:#642d3b;color:#fff;font:600 13px Inter,Arial,sans-serif;cursor:pointer';

      button.addEventListener('click', () => {
        const confirmed = window.confirm('Antes de actualizar, guarda cualquier formulario o cambio que tengas en curso. La aplicación se recargará. ¿Quieres continuar?');
        if (!confirmed) return;
        button.disabled = true;
        button.textContent = 'Actualizando…';
        if (registration && registration.waiting) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        } else {
          window.location.reload();
        }
      });

      updateBanner.append(message, button);
      document.body.appendChild(updateBanner);
    };

    try {
      registration = await navigator.serviceWorker.register('/sw.js');

      if (registration.waiting && navigator.serviceWorker.controller) showUpdate();

      registration.addEventListener('updatefound', () => {
        const installing = registration.installing;
        if (!installing) return;
        installing.addEventListener('statechange', () => {
          if (installing.state === 'installed' && navigator.serviceWorker.controller) showUpdate();
        });
      });

      // Comprueba si hay una versión nueva al abrir la aplicación.
      registration.update().catch(() => {});
    } catch (_) {
      // La aplicación sigue funcionando aunque el registro PWA falle.
    }

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    });
  });
}
