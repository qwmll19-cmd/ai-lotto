import { initMenu } from './menu.js';
import { initForm } from './form.js';

async function loadComponents() {
  const placeholders = document.querySelectorAll('[data-component]');
  await Promise.all(
    Array.from(placeholders).map(async (el) => {
      const path = el.getAttribute('data-component');
      if (!path) return;
      const res = await fetch(path);
      if (!res.ok) return;
      el.innerHTML = await res.text();
    })
  );
}

function initScroll() {
  document.querySelectorAll('[data-scroll]').forEach((button) => {
    button.addEventListener('click', () => {
      const target = button.getAttribute('data-scroll');
      if (!target) return;
      const el = document.querySelector(target);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });
}

async function init() {
  await loadComponents();
  initMenu();
  initScroll();
  initForm();

  const logo = document.getElementById('logo-home');
  if (logo) {
    logo.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  document.querySelectorAll('.why-card').forEach((card) => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.why-card').forEach((item) => {
        if (item === card) {
          item.classList.toggle('open');
        } else {
          item.classList.remove('open');
        }
      });
    });
  });
}

init();
