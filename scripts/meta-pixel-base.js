// TODO: reemplazar con el Pixel ID real de INTACTO si cambia.
var META_PIXEL_ID = '2177392419686177';

!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
document,'script','https://connect.facebook.net/en_US/fbevents.js');

fbq('init', META_PIXEL_ID);
fbq('track', 'PageView');

// Datos del producto único, compartidos por los eventos de Meta Pixel tanto
// en la landing como en la página de checkout.
var INTACTO_PRODUCT = {
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
