import './v-scroll.js';

const list = document.querySelector('.list');
if (list) {
  for (let i = 1; i <= 100; i++) {
    const p = document.createElement('p');
    p.textContent = `Welcome to vibe ${i}`;
    list.appendChild(p);
  }
}
