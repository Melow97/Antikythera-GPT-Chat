const params = new URLSearchParams(location.search);
const error = params.get('error');
if (error) {
  const banner = document.getElementById('errorBanner');
  banner.textContent = error;
  banner.classList.remove('hidden');
}

document.querySelectorAll('.nav-item').forEach((item) => {
  const link = item.querySelector('.nav-link');
  link.addEventListener('click', (e) => {
    e.stopPropagation();
    const wasOpen = item.classList.contains('open');
    document.querySelectorAll('.nav-item.open').forEach((el) => el.classList.remove('open'));
    if (!wasOpen) item.classList.add('open');
  });
});

document.addEventListener('click', () => {
  document.querySelectorAll('.nav-item.open').forEach((el) => el.classList.remove('open'));
});

document.querySelectorAll('.nav-dropdown a').forEach((link) => {
  link.addEventListener('click', () => {
    document.querySelectorAll('.nav-item.open').forEach((el) => el.classList.remove('open'));
  });
});

// --- Feature tab-switcher ("What's inside") ---
document.querySelectorAll('.feature-tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    const key = tab.dataset.feature;
    document.querySelectorAll('.feature-tab').forEach((t) => {
      t.classList.toggle('active', t === tab);
      t.setAttribute('aria-selected', t === tab ? 'true' : 'false');
    });
    document.querySelectorAll('.feature-panel-content').forEach((panel) => {
      panel.classList.toggle('active', panel.dataset.feature === key);
    });
  });
});

// ============================================================
// Antikythera mechanism — continuous gear rotation + scroll tie-in
// ============================================================
(function () {
  const gearLarge = document.getElementById('gearLarge');
  const gearMedium = document.getElementById('gearMedium');
  const gearSmall = document.getElementById('gearSmall');
  const orbitSatellites = document.getElementById('orbitSatellites');
  const mechanismStage = document.getElementById('mechanismStage');
  const heroSection = document.getElementById('top');

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (gearLarge && gearMedium && gearSmall && !prefersReducedMotion) {
    let lastTime = performance.now();
    let largeAngle = 0;
    let mediumAngle = 0;
    let smallAngle = 0;

    function tick(now) {
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      const scrollY = window.scrollY || window.pageYOffset;
      // Extra rotation speed tied to how fast the page is being scrolled, so the
      // mechanism visibly reacts as you scroll, on top of a slow constant idle spin.
      const scrollFactor = 1 + Math.min(scrollY / 400, 3);

      // Real meshing gears spin opposite directions, and smaller gears spin faster —
      // mirrored here for an authentic mechanical feel rather than three gears just
      // spinning identically.
      largeAngle += dt * 6 * scrollFactor;
      mediumAngle -= dt * 9 * scrollFactor;
      smallAngle += dt * 14 * scrollFactor;

      gearLarge.style.transform = `rotate(${largeAngle}deg)`;
      gearMedium.style.transform = `rotate(${mediumAngle}deg)`;
      gearSmall.style.transform = `rotate(${smallAngle}deg)`;

      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  // Orbital rings "align" as the hero scrolls past — start slightly rotated/loose,
  // snap toward a locked, aligned position as you scroll down through it.
  if (orbitSatellites && heroSection) {
    orbitSatellites.style.transform = 'rotate(22deg)';

    function updateAlignment() {
      const heroHeight = heroSection.offsetHeight || 1;
      const scrollY = window.scrollY || window.pageYOffset;
      const progress = Math.max(0, Math.min(1, scrollY / heroHeight));
      const angle = (1 - progress) * 22;
      orbitSatellites.style.transform = `rotate(${angle}deg)`;
      if (mechanismStage) {
        mechanismStage.classList.toggle('aligned', progress > 0.4);
      }
    }
    updateAlignment();
    window.addEventListener('scroll', updateAlignment, { passive: true });
  }

  // Reveal UI panels as mechanical components clicking into place while scrolling.
  const revealEls = document.querySelectorAll('.reveal');
  if (revealEls.length && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('reveal-in');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    revealEls.forEach((el) => observer.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add('reveal-in'));
  }

  // "Start Chat" — the central gear opens (iris wipe from the button's position)
  // before actually navigating to the real Google sign-in route.
  const startChatBtn = document.getElementById('startChatBtn');
  const irisOverlay = document.getElementById('irisOverlay');
  if (startChatBtn && irisOverlay) {
    startChatBtn.addEventListener('click', () => {
      const href = startChatBtn.dataset.href;
      const rect = startChatBtn.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      irisOverlay.style.setProperty('--iris-x', `${cx}px`);
      irisOverlay.style.setProperty('--iris-y', `${cy}px`);
      irisOverlay.classList.add('opening');

      const navigate = () => {
        window.location.href = href;
      };
      let navigated = false;
      const onEnd = () => {
        if (navigated) return;
        navigated = true;
        navigate();
      };
      irisOverlay.addEventListener('transitionend', onEnd, { once: true });
      // Fallback in case transitionend doesn't fire (e.g. reduced motion, zero duration)
      setTimeout(onEnd, 900);
    });
  }
})();
