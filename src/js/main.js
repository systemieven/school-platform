// Main JavaScript file
import './polyfills.js';
import { browserSupport, dom } from './utils.js';

// Initialize application
document.addEventListener('DOMContentLoaded', () => {
  // Initialize Lucide icons
  if (window.lucide) {
    window.lucide.createIcons();
  }

  // Initialize scroll animations
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    initScrollAnimations();
  }

  // Initialize mobile menu
  initMobileMenu();

  // Initialize cookie consent
  initCookieConsent();

  // Initialize smooth scroll
  initSmoothScroll();

  // Initialize navigation shadow
  initNavShadow();
});

// Initialize scroll animations
function initScrollAnimations() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('active');
      }
    });
  }, {
    threshold: 0.1
  });

  document.querySelectorAll('.scroll-animate').forEach((element) => {
    observer.observe(element);
  });
}

// Initialize mobile menu
function initMobileMenu() {
  const button = document.querySelector('[aria-controls="mobile-menu"]');
  const menu = document.getElementById('mobile-menu');

  if (button && menu) {
    button.addEventListener('click', () => {
      const isExpanded = button.getAttribute('aria-expanded') === 'true';
      button.setAttribute('aria-expanded', !isExpanded);
      menu.classList.toggle('hidden');
    });
  }
}

// Initialize cookie consent
function initCookieConsent() {
  const banner = document.getElementById('cookieConsent');
  if (!banner) return;

  if (!window.Cookies?.get('cookieConsent')) {
    banner.classList.remove('translate-y-full');
  }

  window.acceptCookies = () => {
    window.Cookies?.set('cookieConsent', 'accepted', { expires: 365 });
    banner.classList.add('translate-y-full');
  };

  window.rejectCookies = () => {
    window.Cookies?.set('cookieConsent', 'rejected', { expires: 7 });
    banner.classList.add('translate-y-full');
  };
}

// Initialize smooth scroll
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        target.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    });
  });
}

// Initialize navigation shadow
function initNavShadow() {
  const mainNav = document.getElementById('mainNav');
  if (!mainNav) return;

  window.addEventListener('scroll', () => {
    if (window.scrollY > 0) {
      mainNav.classList.add('shadow-lg');
    } else {
      mainNav.classList.remove('shadow-lg');
    }
  });
}

// Export for global access
window.app = {
  browserSupport,
  dom
};