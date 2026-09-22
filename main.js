/* ═══════════════════════════════════════════════════════════════
   FORGE — motion engine
   GSAP 3.12 + ScrollTrigger + Lenis (smooth scroll).
   Under prefers-reduced-motion everything renders in its final
   state with no movement.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  if (!window.gsap || !window.ScrollTrigger) {
    document.documentElement.classList.remove('js');
    var l = document.getElementById('loader'); if (l) l.remove();
    return;
  }
  gsap.registerPlugin(ScrollTrigger);

  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var FINE = window.matchMedia('(pointer: fine)').matches;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return gsap.utils.toArray(s, c); };

  /* ── Smooth scroll ───────────────────────────────────────── */
  var lenis = null;
  if (window.Lenis && !REDUCED) {
    lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 1, smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);
    window.__lenis = lenis; // exposed for QA / deep-link tooling
  }
  function scrollToHash(hash) {
    var target = hash && hash !== '#' ? $(hash) : null;
    if (!target) return;
    if (lenis) lenis.scrollTo(target, { offset: -72, duration: 1.4, easing: function (t) { return 1 - Math.pow(1 - t, 4); } });
    else target.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'start' });
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href^="#"]');
    if (!a) return;
    var hash = a.getAttribute('href');
    if (hash.length < 2 || !$(hash)) return;
    e.preventDefault();
    scrollToHash(hash);
    history.replaceState(null, '', hash);
  });

  /* ── Helpers ─────────────────────────────────────────────── */
  function splitWords(el) {
    var text = el.textContent.replace(/\s+/g, ' ').trim();
    el.setAttribute('aria-label', text);
    el.innerHTML = text.split(' ').map(function (w) { return '<span class="w" aria-hidden="true">' + w + '</span>'; }).join(' ');
    return $$('.w', el);
  }
  function formatCount(el, v) {
    var d = parseInt(el.dataset.decimals || '0', 10);
    return v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) + (el.dataset.suffix || '');
  }
  function runCount(el, instant) {
    var target = parseFloat(el.dataset.count);
    if (instant) { el.textContent = formatCount(el, target); return; }
    var o = { v: 0 };
    gsap.to(o, { v: target, duration: 1.8, ease: 'power3.out', onUpdate: function () { el.textContent = formatCount(el, o.v); } });
  }
  function loopTrack(selector, setClass, animate, duration) {
    var track = $(selector);
    if (!track) return null;
    var set = document.createElement('div');
    set.className = setClass;
    while (track.firstChild) set.appendChild(track.firstChild);
    track.appendChild(set);
    var clone = set.cloneNode(true); clone.setAttribute('aria-hidden', 'true');
    track.appendChild(clone);
    if (!animate) return null;
    var tween = gsap.to(track, { xPercent: -50, ease: 'none', duration: duration, repeat: -1 });
    track.parentElement.addEventListener('pointerenter', function () { gsap.to(tween, { timeScale: 0.25, duration: 0.6 }); });
    track.parentElement.addEventListener('pointerleave', function () { gsap.to(tween, { timeScale: 1, duration: 0.6 }); });
    return tween;
  }
  function setMethod(i) {
    $$('[data-method-media] img').forEach(function (img, k) { img.classList.toggle('is-on', k === i); });
    $$('[data-chips]').forEach(function (c) { c.classList.toggle('is-on', parseInt(c.dataset.chips, 10) === i); });
    var idx = $('#methodIdx'); if (idx) idx.textContent = String(i + 1).padStart(2, '0');
  }

  var words = $$('[data-words]').map(function (el) { return { el: el, words: splitWords(el) }; });
  var routeEl = $('#route');
  var routeLen = routeEl ? routeEl.getTotalLength() : 0;

  /* ═════════════════════════════════════════════════════════
     REDUCED MOTION — final state, immediately
     ═════════════════════════════════════════════════════════ */
  if (REDUCED) {
    var ld = $('#loader'); if (ld) ld.remove();
    $$('[data-count]').forEach(function (el) { runCount(el, true); });
    $$('.step').forEach(function (s) { s.classList.add('is-active'); });
    setMethod(0);
    loopTrack('[data-marquee]', 'strip__set', false);
    loopTrack('[data-marquee-cities]', 'cities__set', false);
    var rdot = $('#routeDot');
    if (rdot && routeEl) { var rp = routeEl.getPointAtLength(routeLen); rdot.setAttribute('cx', rp.x); rdot.setAttribute('cy', rp.y); }
  }

  /* ═════════════════════════════════════════════════════════
     FULL MOTION
     ═════════════════════════════════════════════════════════ */
  else {

    /* 1. Loader → hero intro ---------------------------------- */
    var loader = $('#loader');
    var pctEl = $('#loaderPct');
    var heroMedia = $('.hero__media img');
    var heroLines = $$('.hero [data-line] > span');
    var heroFades = $$('.hero [data-fade]');

    gsap.set(heroMedia, { scale: 1.18 });
    gsap.set('.nav', { y: -16, opacity: 0 });

    var intro = gsap.timeline({ defaults: { ease: 'expo.out' } });
    if (loader) {
      var pct = { v: 0 };
      if (lenis) lenis.stop();
      intro
        .to('.loader__word i', { y: 0, duration: 0.9, stagger: 0.05 }, 0)
        .to(pct, { v: 100, duration: 1.15, ease: 'power2.inOut', onUpdate: function () { if (pctEl) pctEl.textContent = String(Math.round(pct.v)).padStart(2, '0'); } }, 0.1)
        .to('.loader__mark', { y: -30, opacity: 0, duration: 0.5, ease: 'power2.in' }, '-=0.15')
        .to(loader, { yPercent: -100, duration: 0.95, ease: 'expo.inOut', onComplete: function () { loader.remove(); if (lenis) lenis.start(); ScrollTrigger.refresh(); } }, '-=0.25');
    }
    intro
      .to(heroMedia, { scale: 1, duration: 2.2 }, loader ? '-=0.75' : 0)
      .to('.nav', { y: 0, opacity: 1, duration: 0.9 }, '<+0.1')
      .to(heroLines, { y: 0, duration: 1.2, stagger: 0.1 }, '<')
      .to(heroFades, { opacity: 1, y: 0, duration: 0.9, stagger: 0.08 }, '<+0.45');

    /* 2. Hero parallax ---------------------------------------- */
    gsap.to(heroMedia, { yPercent: 16, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
    gsap.to('.hero__title, .hero__foot, .hero__top', { y: -60, opacity: 0, ease: 'none', stagger: 0.02, scrollTrigger: { trigger: '.hero', start: '40% top', end: 'bottom top', scrub: true } });

    /* 3. Marquees --------------------------------------------- */
    loopTrack('[data-marquee]', 'strip__set', true, 28);
    loopTrack('[data-marquee-cities]', 'cities__set', true, 44);
    setMethod(0);

    /* 4. Headline line masks ---------------------------------- */
    $$('.h2, .h3, .final__title').forEach(function (h) {
      gsap.to($$('[data-line] > span', h), { y: 0, duration: 1.1, ease: 'expo.out', stagger: 0.09, scrollTrigger: { trigger: h, start: 'top 86%', once: true } });
    });

    /* 5. Fades ------------------------------------------------ */
    $$('[data-fade]').forEach(function (el) {
      if (el.closest('.hero')) return;
      gsap.to(el, { opacity: 1, y: 0, duration: 0.9, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 90%', once: true } });
    });

    /* 6. Image clip reveals (outside the horizontal pin) ----- */
    $$('[data-clip]').forEach(function (fig) {
      if (fig.closest('.bank')) return;
      gsap.to($('img', fig), { clipPath: 'inset(0% 0 0 0)', scale: 1, duration: 1.5, ease: 'expo.out', scrollTrigger: { trigger: fig, start: 'top 85%', once: true } });
    });

    /* 7. Word-by-word paragraphs ------------------------------ */
    words.forEach(function (w) {
      gsap.to(w.words, { opacity: 1, ease: 'none', stagger: 0.06, scrollTrigger: { trigger: w.el, start: 'top 80%', end: 'bottom 45%', scrub: 0.6 } });
    });

    /* 8. Counters --------------------------------------------- */
    $$('[data-count]').forEach(function (el) {
      ScrollTrigger.create({ trigger: el, start: 'top 90%', once: true, onEnter: function () { runCount(el); } });
    });

    /* 9. Pillars ghost image ---------------------------------- */
    var ghost = $('#rowsGhost'), ghostImg = $('#rowsGhostImg'), rows = $$('.row');
    if (ghost && FINE) {
      gsap.set(ghost, { xPercent: -50, yPercent: -50, scale: 0.85, opacity: 0 });
      var gx = gsap.quickTo(ghost, 'x', { duration: 0.6, ease: 'power3.out' });
      var gy = gsap.quickTo(ghost, 'y', { duration: 0.6, ease: 'power3.out' });
      rows.forEach(function (row) {
        row.addEventListener('pointerenter', function () {
          if (ghostImg.getAttribute('src') !== row.dataset.img) ghostImg.setAttribute('src', row.dataset.img);
          gsap.to(ghost, { opacity: 1, scale: 1, duration: 0.5, ease: 'power3.out', overwrite: true });
        });
        var pre = new Image(); pre.src = row.dataset.img;
      });
      var list = $('#rows');
      list.addEventListener('pointerleave', function () { gsap.to(ghost, { opacity: 0, scale: 0.85, duration: 0.4, ease: 'power2.in', overwrite: true }); });
      list.addEventListener('pointermove', function (e) { gx(e.clientX); gy(e.clientY); });
    }

    /* 10. Engine steps → pinned image + chips ----------------- */
    $$('.step').forEach(function (step) {
      var i = parseInt(step.dataset.step, 10);
      ScrollTrigger.create({
        trigger: step, start: 'top 62%', end: 'bottom 62%',
        onEnter: function () { step.classList.add('is-active'); setMethod(i); },
        onEnterBack: function () { step.classList.add('is-active'); setMethod(i); },
        onLeave: function () { step.classList.remove('is-active'); },
        onLeaveBack: function () { step.classList.remove('is-active'); }
      });
    });

    /* 11. Full-bleed parallax --------------------------------- */
    $$('[data-parallax]').forEach(function (layer) {
      var amt = parseFloat(layer.dataset.parallax || '-10');
      gsap.fromTo(layer, { yPercent: -amt }, { yPercent: amt, ease: 'none', scrollTrigger: { trigger: layer.parentElement, start: 'top bottom', end: 'bottom top', scrub: true } });
    });

    /* 12. Library dial : rotates with scroll, angle tabs cycle - */
    var dialDot = $('.dial__dot'), dialDeg = $('#dialDeg'), angles = $$('.ui__angles span');
    if (dialDot) {
      var deg = { v: 0 };
      gsap.to(deg, {
        v: 360, ease: 'none',
        scrollTrigger: { trigger: '#library', start: 'top 80%', end: 'bottom 20%', scrub: 0.4 },
        onUpdate: function () {
          gsap.set(dialDot, { rotation: deg.v });
          if (dialDeg) dialDeg.textContent = Math.round(deg.v) + '°';
          var k = Math.min(3, Math.floor(deg.v / 90));
          angles.forEach(function (a, i) { a.classList.toggle('is-on', i === k); });
        }
      });
    }

    /* 13. GPS route draws with scroll, dot rides it ----------- */
    if (routeEl && routeLen) {
      var dot = $('#routeDot');
      gsap.set(routeEl, { strokeDasharray: routeLen, strokeDashoffset: routeLen });
      var prog = { v: 0 };
      gsap.to(prog, {
        v: 1, ease: 'none',
        scrollTrigger: { trigger: '#gps', start: 'top 75%', end: 'bottom 35%', scrub: 0.5 },
        onUpdate: function () {
          gsap.set(routeEl, { strokeDashoffset: routeLen * (1 - prog.v) });
          var p = routeEl.getPointAtLength(routeLen * prog.v);
          if (dot) { dot.setAttribute('cx', p.x); dot.setAttribute('cy', p.y); }
        }
      });
      gsap.from('.split', { opacity: 0, y: 6, duration: 0.6, stagger: 0.25, ease: 'power2.out', scrollTrigger: { trigger: '#gps', start: 'top 60%', once: true } });
    }

    /* 14. Nutrition toasts cycle ------------------------------ */
    var toasts = $$('.toast');
    if (toasts.length) {
      var ti = 0;
      ScrollTrigger.create({
        trigger: '#nutrition', start: 'top 70%', once: true,
        onEnter: function () {
          (function next() {
            gsap.delayedCall(3.2, function () {
              toasts[ti].classList.remove('is-on');
              ti = (ti + 1) % toasts.length;
              toasts[ti].classList.add('is-on');
              next();
            });
          })();
        }
      });
    }

    /* 15. Level ring + XP bar --------------------------------- */
    var lvlFill = $('#lvlFill'), xpBar = $('#xpBar');
    if (lvlFill) {
      ScrollTrigger.create({
        trigger: '#game', start: 'top 70%', once: true,
        onEnter: function () {
          gsap.to(lvlFill, { strokeDashoffset: 553 * (1 - 0.81), duration: 1.8, ease: 'power3.out' });
          if (xpBar) gsap.to(xpBar, { width: '81%', duration: 1.8, ease: 'power3.out', delay: 0.2 });
          gsap.from('.badges li', { opacity: 0, y: 10, duration: 0.6, stagger: 0.07, ease: 'power2.out', delay: 0.4 });
        }
      });
    }

    /* 16. Real-life mode : chips + rewrite -------------------- */
    ScrollTrigger.create({
      trigger: '#life', start: 'top 70%', once: true,
      onEnter: function () {
        gsap.from('.life__chips span', { opacity: 0, y: 8, duration: 0.5, stagger: 0.08, ease: 'power2.out' });
        gsap.from('.life__diff .is-new', { opacity: 0, x: 16, duration: 0.8, ease: 'power3.out', delay: 0.6 });
      }
    });

    /* 17. The bank : pinned horizontal scroll ----------------- */
    var mmBank = gsap.matchMedia();
    mmBank.add('(min-width: 861px)', function () {
      var pin = $('[data-hscroll]'), track = $('#hTrack');
      if (!pin || !track) return;
      var dist = function () { return Math.max(0, track.scrollWidth - window.innerWidth); };
      var tween = gsap.to(track, {
        x: function () { return -dist(); }, ease: 'none',
        scrollTrigger: { trigger: pin, start: 'top top', pin: true, scrub: 0.8, end: function () { return '+=' + dist(); }, invalidateOnRefresh: true, anticipatePin: 1 }
      });
      gsap.to($$('.card img', track), {
        clipPath: 'inset(0% 0 0 0)', scale: 1, duration: 1.2, ease: 'expo.out', stagger: 0.12,
        scrollTrigger: { trigger: pin, start: 'top 70%', once: true }
      });
      return function () { tween.scrollTrigger && tween.scrollTrigger.kill(); tween.kill(); };
    });
    mmBank.add('(max-width: 860px)', function () {
      $$('.bank .card img').forEach(function (img) {
        gsap.to(img, { clipPath: 'inset(0% 0 0 0)', scale: 1, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: '#bank', start: 'top 80%', once: true } });
      });
    });

    /* 18. Magnetic pills -------------------------------------- */
    if (FINE) {
      $$('[data-magnetic]').forEach(function (el) {
        var xTo = gsap.quickTo(el, 'x', { duration: 0.5, ease: 'elastic.out(1, 0.45)' });
        var yTo = gsap.quickTo(el, 'y', { duration: 0.5, ease: 'elastic.out(1, 0.45)' });
        el.addEventListener('pointermove', function (e) {
          var r = el.getBoundingClientRect();
          xTo((e.clientX - r.left - r.width / 2) * 0.28);
          yTo((e.clientY - r.top - r.height / 2) * 0.28);
        });
        el.addEventListener('pointerleave', function () { xTo(0); yTo(0); });
      });
    }

    /* 19. Live counter ---------------------------------------- */
    var live = $('#liveCount');
    if (live) {
      var n = 31284;
      (function tick() {
        gsap.delayedCall(2.5 + Math.random() * 4, function () {
          n += Math.round((Math.random() - 0.4) * 12);
          live.textContent = n.toLocaleString('en-US');
          tick();
        });
      })();
    }
  }

  /* ── Always on : progress, nav, menu ─────────────────────── */
  var nav = $('#nav'), bar = $('#progressBar'), raf = false;
  function onScroll() {
    if (raf) return; raf = true;
    requestAnimationFrame(function () {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      if (bar) bar.style.width = (max > 0 ? (window.scrollY / max) * 100 : 0) + '%';
      if (nav) nav.classList.toggle('is-stuck', window.scrollY > 40);
      raf = false;
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  var burger = $('#burger'), links = $('#navLinks');
  function closeMenu() {
    links.classList.remove('is-open'); nav.classList.remove('is-open');
    burger.setAttribute('aria-expanded', 'false'); burger.setAttribute('aria-label', 'Open menu');
    if (lenis) lenis.start();
  }
  if (burger && links) {
    burger.addEventListener('click', function () {
      if (!links.classList.contains('is-open')) {
        links.classList.add('is-open'); nav.classList.add('is-open');
        burger.setAttribute('aria-expanded', 'true'); burger.setAttribute('aria-label', 'Close menu');
        if (lenis) lenis.stop();
      } else closeMenu();
    });
    links.addEventListener('click', function (e) { if (e.target.closest('a')) closeMenu(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && links.classList.contains('is-open')) { closeMenu(); burger.focus(); } });
  }

  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
  var rt;
  window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { ScrollTrigger.refresh(); }, 200); });
})();
