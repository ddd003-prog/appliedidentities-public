/*
  ai-core.v1.js
  Applied Identities web estate: shared motion.
  IntersectionObserver scroll reveals, SVG rail draw, and the fixed left rail
  progress indicator, ported from the two comps. prefers-reduced-motion
  disables everything (content is shown immediately, no observers attached).
*/
(function () {
  'use strict';

  var reduce = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (reduce) {
    // Reveal everything up front; freeze SVG SMIL (pulses, moving dots).
    // CSS animation:none cannot stop SMIL, so pause it here.
    document.querySelectorAll('.reveal,.draw').forEach(function (el) {
      el.classList.add('in');
    });
    document.querySelectorAll('svg').forEach(function (s) {
      if (s.pauseAnimations) {
        try { s.setCurrentTime(0); } catch (e) {}
        s.pauseAnimations();
      }
    });
    return;
  }

  // ---- scroll reveals + rail draw ----
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) {
        e.target.classList.add('in');
      }
    });
  }, { threshold: 0.2 });
  document.querySelectorAll('.reveal,.draw').forEach(function (el) {
    io.observe(el);
  });

  // ---- rail progress indicator (optional: needs #rn1/#rn2/#rn3) ----
  var rn = [
    document.getElementById('rn1'),
    document.getElementById('rn2'),
    document.getElementById('rn3')
  ];
  if (rn[0] && rn[1] && rn[2]) {
    var cls = ['lit-slate', 'lit-paper', 'lit-amber'];
    var pio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          var n = +e.target.dataset.rail;
          for (var i = 0; i < 3; i++) {
            rn[i].classList.toggle(cls[i], i < n);
          }
        }
      });
    }, { threshold: 0.5 });
    document.querySelectorAll('[data-rail]').forEach(function (el) {
      pio.observe(el);
    });
  }
})();
