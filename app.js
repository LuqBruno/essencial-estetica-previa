// Essencial Estética Integrada — prévia conceitual (Bruno Luque).
// "Integrada começa na mesa": o vapor da xícara vira os caminhos até cada área.
// Motion 11 (vanilla) para coreografia/rolagem; Lenis só na roda do mouse. Sem JS, todo o conteúdo fica visível.
//
// Camadas de motion
//  - Assinatura: vapor do hero (desenho + deriva com mola pelo ponteiro) e cena presa
//    "Escolha por onde começar" (máscara orgânica que nasce da xícara, vapor até a área ativa).
//  - Narrativa: títulos por máscara de linha; fotos do espaço que assentam (zoom ligado à rolagem);
//    círculos tangentes na rede; vapor que se desenha ao entrar no contato.
//  - Interface: pressão dos botões, copiar com troca de ícone/texto, topo sólido, foco.

const root = document.documentElement;
const reduceMQ = matchMedia('(prefers-reduced-motion: reduce)');
const fineMQ = matchMedia('(hover: hover) and (pointer: fine)');
const wideMQ = matchMedia('(min-width: 900px)');
const pinMQ = matchMedia('(min-width: 1000px) and (min-height: 640px)');
const reduce = reduceMQ.matches;
if (reduce) root.classList.add('reduce');

// tokens de motion (espelham style.css)
const EASE_OUT = [0.23, 1, 0.32, 1];
const EASE_IN_OUT = [0.77, 0, 0.175, 1];
const DUR = { press: 0.13, control: 0.2, panel: 0.32 };
const SPRING_DRIFT = { stiffness: 55, damping: 12 };   // vapor seguindo o ponteiro
const SPRING_END = { stiffness: 140, damping: 20 };    // vapor trocando de área

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const NS = 'http://www.w3.org/2000/svg';
const svgEl = (tag, attrs = {}, parent) => { const n = document.createElementNS(NS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); if (parent) parent.appendChild(n); return n; };
const r1 = (n) => Math.round(n * 10) / 10;

// ponto da xícara na foto 027 (fração da imagem inteira): superfície do café
const CUP = { x: 0.795, y: 0.288 };

/* ------------------------------------------------------------------ */
/* Mola 2D interrompível (preserva velocidade; para quando assenta)   */
/* ------------------------------------------------------------------ */
function spring2(apply, { stiffness = 170, damping = 20 } = {}) {
  const s = { x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0, raf: 0, last: 0 };
  const tick = (t) => {
    const dt = Math.min(0.032, (t - (s.last || t)) / 1000 || 0.016); s.last = t;
    for (const k of ['x', 'y']) { const v = 'v' + k, tk = 't' + k; s[v] += (-stiffness * (s[k] - s[tk]) - damping * s[v]) * dt; s[k] += s[v] * dt; }
    apply(s.x, s.y);
    if (Math.abs(s.x - s.tx) + Math.abs(s.y - s.ty) + Math.abs(s.vx) + Math.abs(s.vy) > 0.02) s.raf = requestAnimationFrame(tick);
    else { s.raf = 0; s.last = 0; s.x = s.tx; s.y = s.ty; apply(s.x, s.y); }
  };
  return {
    to(x, y) { s.tx = x; s.ty = y; if (!s.raf) s.raf = requestAnimationFrame(tick); },
    set(x, y) { cancelAnimationFrame(s.raf); s.raf = 0; s.last = 0; s.x = s.tx = x; s.y = s.ty = y; s.vx = s.vy = 0; apply(x, y); },
    get value() { return [s.x, s.y]; },
    stop() { cancelAnimationFrame(s.raf); s.raf = 0; },
  };
}

/* ------------------------------------------------------------------ */
/* Geometria do vapor: sobe da xícara ondulando e desliza até a área   */
/* ------------------------------------------------------------------ */
function steamD(x0, y0, x1, y1, { rise = 110, sway = 14, dx = 0, dy = 0 } = {}) {
  const p1x = x0 + sway * 0.4 + dx * 0.8, p1y = y0 - rise + dy * 0.5;
  const c1x = x0 - sway, c1y = y0 - rise * 0.32;
  const c2x = x0 + sway * 1.3 + dx * 0.4, c2y = y0 - rise * 0.66 + dy * 0.2;
  const c4x = x1 - Math.max(40, (x1 - p1x) * 0.42) + dx * 0.3, c4y = y1 + dy * 0.15;
  return `M${r1(x0)},${r1(y0)} C${r1(c1x)},${r1(c1y)} ${r1(c2x)},${r1(c2y)} ${r1(p1x)},${r1(p1y)} S${r1(c4x)},${r1(c4y)} ${r1(x1)},${r1(y1)}`;
}
// medido pela geometria de layout (ignora o zoom/translate animados da foto)
function cupPoint(img, host) {
  const f = img.parentElement.getBoundingClientRect(), h = host.getBoundingClientRect();
  const w = img.offsetWidth, ih = w * (+img.getAttribute('height') / +img.getAttribute('width'));
  const mt = parseFloat(getComputedStyle(img).marginTop) || 0;
  return { x: f.left - h.left + CUP.x * w, y: f.top - h.top + mt + CUP.y * ih };
}

/* ------------------------------------------------------------------ */
/* Topo                                                                 */
/* ------------------------------------------------------------------ */
const top = $('[data-top]');
const onScrollTop = () => top.classList.toggle('is-solid', scrollY > 24);
addEventListener('scroll', onScrollTop, { passive: true }); onScrollTop();

/* ------------------------------------------------------------------ */
/* Lenis: só roda do mouse/trackpad; toque nativo                       */
/* ------------------------------------------------------------------ */
let lenis = null;
function startLenis() {
  if (reduce || !fineMQ.matches || !window.Lenis || lenis) return;
  lenis = new window.Lenis({ lerp: 0.09, smoothWheel: true, wheelMultiplier: 0.95 });
  const raf = (t) => { if (!lenis) return; lenis.raf(t); requestAnimationFrame(raf); };
  requestAnimationFrame(raf);
}
if (window.Lenis) startLenis(); else addEventListener('load', startLenis, { once: true });
reduceMQ.addEventListener('change', () => { if (reduceMQ.matches && lenis) { lenis.destroy(); lenis = null; } });

function goTo(y) {
  if (lenis) lenis.scrollTo(y, { duration: 1.3, easing: (t) => 1 - Math.pow(1 - t, 4) });
  else scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' });
}

/* ------------------------------------------------------------------ */
/* HERO: vapor até o cardápio de áreas                                  */
/* ------------------------------------------------------------------ */
const hero = $('[data-hero]');
const heroImg = $('[data-cup-img]');
const heroSvg = $('[data-hero-steam]');
const labels = $$('[data-label]');
const H = { mains: [], wisps: [], flows: [], cap: null, geo: null, drift: [0, 0], drawn: false };

function buildHeroPaths() {
  heroSvg.replaceChildren();
  H.mains = []; H.wisps = []; H.flows = [];
  for (let i = 0; i < 3; i++) {
    H.wisps.push(svgEl('path', { class: 'steam__wisp', pathLength: 1 }, heroSvg));
    H.mains.push(svgEl('path', { pathLength: 1 }, heroSvg));
  }
  if (!reduce) for (let i = 0; i < 3; i++) H.flows.push(svgEl('path', { class: 'steam__flow', pathLength: 1 }, heroSvg));
  H.cap = svgEl('circle', { r: 3 }, heroSvg);
}
function measureHero() {
  const hr = hero.getBoundingClientRect();
  heroSvg.setAttribute('viewBox', `0 0 ${r1(hr.width)} ${r1(hr.height)}`);
  const cup = cupPoint(heroImg, hero);
  const wide = wideMQ.matches;
  const ends = labels.map((a, i) => {
    if (!wide) return { x: cup.x - 16 + i * 14, y: cup.y - 62 - (i === 1 ? 8 : 0), short: true };
    const d = $('.menu__dot', a).getBoundingClientRect();
    return { x: d.left - hr.left - 3, y: d.top - hr.top + d.height / 2 };
  });
  H.geo = { cup, ends, wide };
}
function drawHero() {
  if (!H.geo) return;
  const { cup, ends, wide } = H.geo;
  const [dx, dy] = H.drift;
  ends.forEach((e, i) => {
    const k = [-1, 0, 1][i];
    // a pluma sobe acima da área e se curva até ela (no celular: só plumas curtas)
    const opt = wide
      ? { rise: Math.max(60, cup.y - e.y + 44 + i * 10), sway: 10 + i * 5, dx: dx * (0.7 + i * 0.25), dy: dy * (0.6 + i * 0.2) }
      : { rise: 40 + i * 6, sway: 6 + i * 2, dx: 0, dy: 0 };
    const d = steamD(cup.x + k * 5, cup.y, e.x, e.y, opt);
    H.mains[i].setAttribute('d', d);
    if (H.flows[i]) H.flows[i].setAttribute('d', d);
    // fios livres: vapor que só sobe e se desfaz
    const wx = cup.x - 22 + i * 20 + dx * 0.5, wy = cup.y - (wide ? 70 + i * 26 : 40 + i * 8) + dy * 0.4;
    if (!wide) { H.wisps[i].setAttribute('d', ''); return; }
    H.wisps[i].setAttribute('d', steamD(cup.x + k * 8, cup.y + 2, wx, wy, { rise: (cup.y - wy) * 0.7, sway: -(8 + i * 3) }));
  });
  H.cap.setAttribute('cx', r1(cup.x)); H.cap.setAttribute('cy', r1(cup.y));
}
buildHeroPaths();
const layoutHero = () => { measureHero(); drawHero(); };
if (heroImg.complete) layoutHero(); else heroImg.addEventListener('load', layoutHero, { once: true });
document.fonts?.ready.then(layoutHero);
new ResizeObserver(layoutHero).observe(hero);

// realce do caminho ao passar/focar uma área
labels.forEach((a, i) => {
  const on = (v) => { H.mains[i]?.classList.toggle('is-hot', v); a.classList.toggle('is-hot', v); };
  a.addEventListener('pointerenter', () => on(true));
  a.addEventListener('pointerleave', () => on(false));
  a.addEventListener('focus', () => on(true));
  a.addEventListener('blur', () => on(false));
});

// deriva do vapor com o ponteiro (só desktop com ponteiro fino, sem movimento reduzido)
let heroVisible = true;
new IntersectionObserver(([e]) => { heroVisible = e.isIntersecting; toggleFlow(); }, { threshold: 0 }).observe(hero);
if (!reduce && fineMQ.matches) {
  const drift = spring2((x, y) => { H.drift = [x, y]; drawHero(); }, SPRING_DRIFT);
  hero.addEventListener('pointermove', (e) => {
    if (!wideMQ.matches || !heroVisible) return;
    const r = hero.getBoundingClientRect();
    drift.to(clamp((e.clientX - r.left) / r.width - 0.5, -0.5, 0.5) * 70, clamp((e.clientY - r.top) / r.height - 0.5, -0.5, 0.5) * 44);
  }, { passive: true });
  hero.addEventListener('pointerleave', () => drift.to(0, 0));
}

// fluxo dourado ao longo do vapor: laço lento, pausado fora da tela/aba oculta
let flowAnims = [];
function toggleFlow() {
  if (!flowAnims.length) return;
  const run = heroVisible && !document.hidden;
  flowAnims.forEach((a) => (run ? a.play() : a.pause()));
}
document.addEventListener('visibilitychange', toggleFlow);
function startFlow() {
  if (reduce) return;
  flowAnims = H.flows.map((p, i) => p.animate([{ strokeDashoffset: 0 }, { strokeDashoffset: -0.256 }], { duration: 5200 + i * 700, iterations: Infinity, easing: 'linear' }));
  toggleFlow();
}

/* ------------------------------------------------------------------ */
/* CENA: escolha por onde começar                                       */
/* ------------------------------------------------------------------ */
const scene = $('[data-scene]');
const pin = $('.scene__pin', scene);
const stage = $('[data-stage]');
const stageImg = $('[data-stage-cup]');
const layers = $$('[data-layer]');
const blobs = $$('[data-blob]');
const panels = $$('[data-step]');
const tabs = $$('[data-tab]');
const rail = $('[data-rail]');
const sceneSvg = $('[data-scene-steam]');
const S = { pinned: false, step: 0, p: 0, main: null, wisp: null, cap: null, cup: null, end: null };

S.wisp = svgEl('path', { class: 'steam__wisp' }, sceneSvg);
S.main = svgEl('path', {}, sceneSvg);
S.cap = svgEl('circle', { r: 3 }, sceneSvg);

function blobTransform(i, reveal, origin) {
  const s = 0.03 + 0.97 * easeOut(reveal);
  const rot = (1 - reveal) * (i % 2 ? 7 : -7);
  // origem puxada para dentro da camada (a forma cresce do lado da xícara sem bater na borda)
  const x = clamp(origin.x, 0.22, 0.78), y = clamp(origin.y, 0.18, 0.82);
  blobs[i].setAttribute('transform', `translate(${x.toFixed(3)} ${y.toFixed(3)}) rotate(${rot.toFixed(2)}) scale(${s.toFixed(4)}) translate(${(-x).toFixed(3)} ${(-y).toFixed(3)})`);
}
function resetBlobs() { blobs.forEach((b) => b.removeAttribute('transform')); }

// origem das máscaras = xícara, nas coordenadas de cada camada (objectBoundingBox)
let layerOrigins = layers.map(() => ({ x: 0.5, y: 0.5 }));
function measureScene() {
  if (!S.pinned) return;
  const pr = pin.getBoundingClientRect();
  sceneSvg.setAttribute('viewBox', `0 0 ${r1(pr.width)} ${r1(pr.height)}`);
  S.cup = cupPoint(stageImg, pin);
  const cupAbs = { x: S.cup.x + pr.left, y: S.cup.y + pr.top };
  layerOrigins = layers.map((l) => {
    // medido sem transformação: as camadas não têm transform próprio
    const lr = l.getBoundingClientRect();
    return { x: (cupAbs.x - lr.left) / lr.width, y: (cupAbs.y - lr.top) / lr.height };
  });
  tabEnds = tabs.map((t) => {
    const d = $('.menu__dot', t).getBoundingClientRect();
    return { x: d.left - pr.left - 3, y: d.top - pr.top + d.height / 2 };
  });
}
let tabEnds = [];
const endSpring = spring2((x, y) => { S.end = { x, y }; drawSceneSteam(); }, SPRING_END);
function drawSceneSteam() {
  if (!S.pinned || !S.cup || !S.end) return;
  const { x, y } = S.cup;
  S.main.setAttribute('d', steamD(x, y, S.end.x, S.end.y, { rise: 90, sway: 14 }));
  S.wisp.setAttribute('d', steamD(x + 7, y + 2, S.end.x - 16, S.end.y + 12, { rise: 70, sway: -11 }));
  S.cap.setAttribute('cx', r1(x)); S.cap.setAttribute('cy', r1(y));
}

let animateFn = null; // preenchido quando o Motion carrega
function showStep(i, { instant = false } = {}) {
  if (i === S.step && !instant) return;
  const prev = panels[S.step], next = panels[i];
  const dir = i >= S.step ? 1 : -1;
  S.step = i;
  panels.forEach((p, k) => p.classList.toggle('is-active', k === i));
  tabs.forEach((t, k) => { t.classList.toggle('is-active', k === i); t.setAttribute('aria-current', k === i ? 'true' : 'false'); });
  if (tabEnds[i]) { if (instant || !S.end) endSpring.set(tabEnds[i].x, tabEnds[i].y); else endSpring.to(tabEnds[i].x, tabEnds[i].y); }
  if (!S.pinned || instant || !animateFn || prev === next) return;
  prev.style.visibility = 'visible';
  animateFn(prev, { opacity: [1, 0], transform: ['translateY(0px)', `translateY(${-12 * dir}px)`] }, { duration: 0.2, ease: EASE_OUT })
    .then(() => { if (panels[S.step] !== prev) { prev.style.visibility = ''; prev.style.opacity = ''; prev.style.transform = ''; } });
  animateFn(next, { opacity: [0, 1], transform: [`translateY(${16 * dir}px)`, 'translateY(0px)'] }, { duration: DUR.panel + 0.12, delay: 0.06, ease: EASE_OUT });
}

function renderScene(p) {
  S.p = p;
  if (!S.pinned) return;
  const t = p * 3;
  const rev = (i) => (i === 0 ? clamp((t + 0.12) / 0.42) : clamp((t - i + 0.28) / 0.5));
  layers.forEach((l, i) => {
    const reveal = rev(i);
    blobTransform(i, reveal, layerOrigins[i]);
    // a área anterior se desfaz quando a próxima termina de abrir (sem franjas sobrepostas)
    const o = i < layers.length - 1 ? (1 - clamp((rev(i + 1) - 0.55) / 0.45)).toFixed(3) : '1';
    if (l._o !== o) { l._o = o; l.style.opacity = o; }
    const img = l.firstElementChild;
    const z = (1.18 - 0.18 * easeOut(reveal)).toFixed(4);
    if (img._z !== z) { img._z = z; img.style.transform = `scale(${z})`; }
  });
  stageImg.style.transform = `scale(${(1 + p * 0.07).toFixed(4)})`;
  rail.style.transform = `scaleY(${p.toFixed(4)})`;
  showStep(Math.min(2, Math.floor(clamp(p, 0, 0.999) * 3)));
}

let modeSet = false;
function setMode() {
  const want = !reduce && !!window.Motion && pinMQ.matches;
  if (!modeSet) { modeSet = true; if (!want) { revealPanelsOnView(); return; } }
  if (want === S.pinned) { measureScene(); if (S.pinned) { endSpring.set(tabEnds[S.step].x, tabEnds[S.step].y); renderScene(S.p); } return; }
  S.pinned = want;
  scene.classList.toggle('is-pinned', want);
  panels.forEach((p) => { p.style.opacity = ''; p.style.transform = ''; p.style.visibility = ''; });
  if (want) {
    measureScene();
    showStep(S.step, { instant: true });
    const r = scene.getBoundingClientRect();
    renderScene(clamp(-r.top / Math.max(1, scene.offsetHeight - innerHeight)));
  } else {
    resetBlobs();
    layers.forEach((l) => (l.firstElementChild.style.transform = ''));
    panels.forEach((p) => p.classList.add('is-active'));
    revealPanelsOnView();
  }
}

// botões de área da cena presa: rolam até a etapa
function stepY(i) { return scene.offsetTop + ((i + 0.5) / 3) * (scene.offsetHeight - innerHeight); }
tabs.forEach((t, i) => t.addEventListener('click', () => goTo(stepY(i))));

// âncoras (inclui #area-*: na cena presa vão para a etapa certa)
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#"]');
  if (!a) return;
  const id = a.getAttribute('href');
  if (id.length < 2) return;
  const target = $(id);
  if (!target) return;
  e.preventDefault();
  const panelIdx = panels.indexOf(target);
  let y;
  if (panelIdx >= 0 && S.pinned) y = stepY(panelIdx);
  else if (id === '#inicio') y = 0;
  else y = target.getBoundingClientRect().top + scrollY - (top.offsetHeight + 8);
  goTo(y);
  history.replaceState(null, '', id);
  const focusEl = panelIdx >= 0 ? panels[panelIdx] : target;
  if (id !== '#inicio') { focusEl.setAttribute('tabindex', '-1'); setTimeout(() => focusEl.focus({ preventScroll: true }), S.pinned && panelIdx >= 0 ? 700 : 0); }
});

// celular/tablet com movimento: a máscara orgânica se abre quando a área entra
let panelRevealDone = false;
function revealPanelsOnView() {
  if (reduce || !window.Motion || panelRevealDone) return;
  panelRevealDone = true;
  const { inView, animate } = window.Motion;
  panels.forEach((panel, i) => {
    const fig = $('.panel__img', panel);
    if (fig.getBoundingClientRect().top < innerHeight * 0.9) return;
    blobTransform(i, 0.25, { x: 0.8, y: 0.15 });
    inView(fig, () => {
      if (S.pinned) return;
      animate(0.25, 1, { duration: 1.1, ease: EASE_OUT, onUpdate: (v) => !S.pinned && blobTransform(i, v, { x: 0.8, y: 0.15 }) });
      animate($('img', fig), { transform: ['scale(1.12)', 'scale(1)'] }, { duration: 1.3, ease: EASE_OUT });
    }, { amount: 0.3 });
  });
}

/* ------------------------------------------------------------------ */
/* Copiar mensagem (troca de ícone e texto) — o Direct não aceita texto */
/* ------------------------------------------------------------------ */
const status = $('[data-copy-status]');
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* segue para o plano B */ }
  try {
    const ta = Object.assign(document.createElement('textarea'), { value: text });
    ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;opacity:0;left:-9999px';
    document.body.appendChild(ta); ta.select(); const ok = document.execCommand('copy'); ta.remove(); return ok;
  } catch { return false; }
}
$$('[data-copy]').forEach((btn) => {
  const label = $('.copy__label', btn);
  let timer = 0;
  btn.addEventListener('click', async () => {
    const text = document.getElementById(btn.dataset.copy).textContent.trim();
    const ok = await copyText(text);
    clearTimeout(timer);
    btn.classList.toggle('is-done', ok);
    label.textContent = ok ? 'Mensagem copiada' : 'Selecione e copie';
    status.textContent = ok ? 'Mensagem copiada. Abra o Direct e cole.' : 'Não foi possível copiar automaticamente; selecione o texto da mensagem.';
    if (!ok) { const r = document.createRange(); r.selectNodeContents(document.getElementById(btn.dataset.copy)); getSelection().removeAllRanges(); getSelection().addRange(r); }
    timer = setTimeout(() => { btn.classList.remove('is-done'); label.textContent = 'Copiar mensagem'; }, 2600);
  });
});

/* ------------------------------------------------------------------ */
/* Motion: coreografia                                                  */
/* ------------------------------------------------------------------ */
const M = window.Motion || null;
if (!M) console.warn('Motion indisponível; página segue estática.');

if (M) {
  const { animate, scroll, inView, stagger } = M;
  animateFn = (...a) => animate(...a);
  const prog = (p) => (typeof p === 'number' ? p : p?.y?.progress ?? 0);
  root.classList.add('motion-ready');

  // cena: um único ouvinte de rolagem; só desenha quando presa
  scroll((p) => renderScene(prog(p)), { target: scene, offset: ['start start', 'end end'] });
  setMode();
  pinMQ.addEventListener('change', setMode);
  new ResizeObserver(() => { if (S.pinned) setMode(); }).observe(pin);

  if (reduce) {
    // movimento reduzido: vapor já desenhado, sem laço; tudo aceso
  } else {
    /* ---- HERO: entrada (o texto e o CTA não esperam a cena) ---- */
    animate('.hero__title .line > span', { transform: ['translateY(108%)', 'translateY(0%)'] }, { duration: 1, delay: stagger(0.08), ease: EASE_OUT });
    animate('.hero__lead, .hero__actions', { opacity: [0, 1], transform: ['translateY(12px)', 'translateY(0px)'] }, { duration: 0.7, delay: stagger(0.08, { startDelay: 0.3 }), ease: EASE_OUT });
    animate('.hero__table', { clipPath: ['inset(10% 10% 0% 10% round 30px)', 'inset(0% 0% 0% 0% round 30px)'] }, { duration: 1.2, delay: 0.1, ease: EASE_IN_OUT });
    animate('.hero__table img', { transform: ['scale(1.12)', 'scale(1)'] }, { duration: 1.6, delay: 0.1, ease: EASE_OUT });

    // vapor: desenha da xícara até cada área (WAAPI direto nos paths SVG)
    const eo = 'cubic-bezier(0.23, 1, 0.32, 1)';
    const base = 700;
    [...H.mains, ...H.wisps, ...H.flows].forEach((p) => { p.style.strokeDasharray = p.classList.contains('steam__flow') ? '' : '1'; });
    H.mains.forEach((p, i) => p.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 1500, delay: base + i * 220, easing: eo, fill: 'backwards' }));
    H.wisps.forEach((p, i) => p.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 1700, delay: base + 120 + i * 220, easing: eo, fill: 'backwards' }));
    H.flows.forEach((p) => p.animate([{ opacity: 0 }, { opacity: 0.9 }], { duration: 800, delay: base + 1500, fill: 'backwards' }));
    H.cap.style.transformBox = 'fill-box'; H.cap.style.transformOrigin = 'center';
    H.cap.animate([{ opacity: 0, transform: 'scale(0)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 400, delay: base - 100, fill: 'backwards', easing: eo });
    animate('.menu__head', { opacity: [0, 1] }, { duration: 0.5, delay: 0.6 });
    animate('.menu__list li', { opacity: [0, 1], transform: ['translateX(-8px)', 'translateX(0px)'] }, { duration: 0.6, delay: stagger(0.22, { startDelay: 1.45 }), ease: EASE_OUT });
    animate('.menu__more', { opacity: [0, 1] }, { duration: 0.6, delay: 2.2 });
    setTimeout(startFlow, base + 1600);

    // saída do hero ligada à rolagem: a mesa se afasta um pouco
    scroll((p) => {
      const t = prog(p);
      heroImg.style.translate = `0 ${(t * 6).toFixed(2)}%`;
      heroSvg.style.opacity = (1 - t * 1.4).toFixed(3);
    }, { target: hero, offset: ['start start', 'end start'] });

    /* ---- NARRATIVA: títulos por máscara de linha ---- */
    $$('[data-mask]').forEach((h) => {
      if (h.getBoundingClientRect().top < innerHeight && !h.closest('.scene')) return;
      h.style.clipPath = 'inset(0% 0% 100% 0%)';
      h.style.transform = 'translateY(22px)';
      inView(h.parentElement, () => { animate(h, { clipPath: ['inset(0% 0% 100% 0%)', 'inset(-10% 0% -14% 0%)'], transform: 'translateY(0px)' }, { duration: 0.95, ease: EASE_OUT }); }, { amount: 0.2 });
    });

    /* ---- NARRATIVA: círculos que encontram a tangente (rede) ---- */
    $$('[data-tangent]').forEach((card, i) => {
      if (card.getBoundingClientRect().top < innerHeight) return;
      const dot = $('.card__dot', card), ring = $('.card__ring', card);
      dot.style.transform = 'translateX(42px) scale(.5)'; dot.style.opacity = 0;
      ring.style.transform = 'scale(.86)'; ring.style.opacity = 0;
      inView(card, () => {
        animate(ring, { transform: 'scale(1)', opacity: 1 }, { duration: 0.6, delay: i * 0.08, ease: EASE_OUT });
        animate(dot, { transform: 'translateX(0px) scale(1)', opacity: 1 }, { type: 'spring', bounce: 0.28, duration: 0.8, delay: 0.25 + i * 0.08 });
      }, { amount: 0.4 });
    });

    /* ---- NARRATIVA: fotos do espaço assentam com a rolagem ---- */
    const shots = $$('[data-zoom]');
    const drift = [-26, 34, -14];
    shots.forEach((fig, i) => {
      const img = $('img', fig), frame = $('.shot__frame', fig);
      scroll((p) => {
        const t = prog(p);
        img.style.transform = `scale(${(1.16 - 0.16 * clamp(t * 1.7)).toFixed(4)})`;
        if (wideMQ.matches) frame.style.transform = `translateY(${((0.5 - t) * drift[i] * 2).toFixed(1)}px)`;
        else frame.style.transform = '';
      }, { target: fig, offset: ['start end', 'end start'] });
    });

    /* ---- NARRATIVA: vapor desce para o contato ---- */
    const cSteam = $$('[data-contact-steam]');
    cSteam.forEach((p) => { p.style.strokeDasharray = '1'; p.style.strokeDashoffset = '1'; });
    scroll((p) => {
      const t = prog(p);
      cSteam.forEach((path, i) => { path.style.strokeDashoffset = String((1 - clamp(t * (1.1 - i * 0.15))).toFixed(4)); });
    }, { target: $('[data-contact]'), offset: ['start end', 'start 0.3'] });
  }
} else {
  // sem Motion: a cena fica em lista; nada escondido
  panels.forEach((p) => p.classList.add('is-active'));
}
