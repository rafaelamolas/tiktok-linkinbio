/* ==========================================================================
   Link-in-bio — pequenos toques de interação
   ========================================================================== */

(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    var links = document.querySelectorAll('nav a.btn');
    links.forEach(function (link, idx) {
      link.style.opacity = '0';
      link.style.transform = 'translateY(8px)';
      link.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
      setTimeout(function () {
        link.style.opacity = '1';
        link.style.transform = 'translateY(0)';
      }, 80 * idx + 60);
    });
  });
})();
