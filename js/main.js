// Applied Identities — Site JavaScript
// Lightweight: nav toggle + scroll animations

(function() {
  'use strict';

  // Mobile nav toggle
  const toggle = document.querySelector('.nav-toggle');
  const nav = document.querySelector('.site-nav');
  
  if (toggle && nav) {
    toggle.addEventListener('click', function() {
      nav.classList.toggle('active');
      const expanded = nav.classList.contains('active');
      toggle.setAttribute('aria-expanded', expanded);
    });
  }

  // Scroll-triggered fade-in for elements below the fold
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('animate-in');
          observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.1,
      rootMargin: '0px 0px -40px 0px'
    });

    // Observe framework cards and evidence blocks
    document.querySelectorAll('.framework-card, .evidence-block').forEach(function(el) {
      el.style.opacity = '0';
      el.style.transform = 'translateY(16px)';
      observer.observe(el);
    });
  }

  // Header background on scroll
  const header = document.querySelector('.site-header');
  if (header) {
    window.addEventListener('scroll', function() {
      if (window.scrollY > 20) {
        header.style.background = 'rgba(247, 245, 242, 0.97)';
      } else {
        header.style.background = 'rgba(247, 245, 242, 0.92)';
      }
    }, { passive: true });
  }
})();
