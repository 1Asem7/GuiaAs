/* GuíaAs · IEPS — app de estudio estática (sin backend). Progreso en localStorage. */
(() => {
  "use strict";

  // ---------- Utilidades ----------
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const icon = (n, cls = "") =>
    `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${(window.ICONS || {})[n] || ""}</svg>`;
  const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const fmt = (n) => Number(n).toLocaleString("es-MX", { maximumFractionDigits: 4 });
  const topicById = Object.fromEntries(DB.topics.map((t) => [t.id, t]));
  const tintFor = { suj: "violet", tas: "blue", def: "sage", acr: "green", pag: "amber", ena: "coral", imp: "blue", ser: "violet", obl: "sage", fac: "coral", par: "amber", reg: "green" };
  const LETTERS = ["a", "b", "c", "d"];
  // Base del reactivo: contexto del caso + pregunta final resaltada (estilo examen)
  function stem(text) {
    const k = text.lastIndexOf("¿");
    if (k <= 0) return `<p class="q-text">${esc(text)}</p>`;
    return `<p class="q-text"><span class="ctx">${esc(text.slice(0, k).trim())}</span> <span class="ask">${esc(text.slice(k))}</span></p>`;
  }

  // IDs estables por posición
  DB.quiz.forEach((x, i) => (x.id = "q" + i));
  DB.cards.forEach((x, i) => (x.id = "c" + i));
  DB.cloze.forEach((x, i) => (x.id = "z" + i));
  DB.tf.forEach((x, i) => (x.id = "v" + i));
  DB.calc.forEach((x, i) => (x.id = "k" + i));

  // ---------- Estado persistente ----------
  const KEY = "guiaIEPS.v1";
  const defaults = { theme: "dark", sound: true, xp: 0, best: 0, ok: 0, total: 0, res: {}, box: {}, sims: [] };
  let S;
  try { S = Object.assign({}, defaults, JSON.parse(localStorage.getItem(KEY) || "{}")); } catch (e) { S = { ...defaults }; }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };
  // res[id] = { c: aciertos, w: errores, last: 1|0 }
  const record = (id, good) => {
    const r = S.res[id] || { c: 0, w: 0, last: 0 };
    good ? r.c++ : r.w++; r.last = good ? 1 : 0; S.res[id] = r;
    S.total++; if (good) S.ok++; save();
  };
  const level = () => Math.floor(S.xp / 200) + 1;
  const lvlPct = () => ((S.xp % 200) / 200) * 100;

  // ---------- Sonido (Web Audio, sin archivos) ----------
  const Snd = {
    ctx: null,
    get() { if (!this.ctx) { const C = window.AudioContext || window.webkitAudioContext; if (C) this.ctx = new C(); } if (this.ctx && this.ctx.state === "suspended") this.ctx.resume(); return this.ctx; },
    tone(f, start, dur, type = "sine", vol = 0.18, slideTo) {
      const c = this.get(); if (!c || !S.sound) return;
      const t = c.currentTime + start, o = c.createOscillator(), g = c.createGain();
      o.type = type; o.frequency.setValueAtTime(f, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + 0.05);
    },
    good() { this.tone(880, 0, 0.18, "sine", 0.16); this.tone(1318.5, 0.09, 0.32, "sine", 0.16); this.tone(2637, 0.16, 0.12, "triangle", 0.05); },
    combo() { [1046.5, 1318.5, 1568, 2093].forEach((f, i) => this.tone(f, i * 0.07, 0.28, "sine", 0.14)); this.tone(3136, 0.3, 0.2, "triangle", 0.05); },
    bad() { this.tone(330, 0, 0.18, "triangle", 0.14, 247); this.tone(247, 0.14, 0.28, "triangle", 0.12, 196); },
    flip() { this.tone(1400, 0, 0.05, "triangle", 0.06, 900); },
    tap() { this.tone(660, 0, 0.05, "sine", 0.05); },
    win() { [523.25, 659.25, 784, 1046.5, 1318.5, 1568].forEach((f, i) => this.tone(f, i * 0.09, 0.4, "sine", 0.13)); this.tone(2093, 0.6, 0.6, "triangle", 0.06); }
  };

  // ---------- Efectos visuales ----------
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const PALETTE = ["#8f7cff", "#4c8dff", "#2fbf8a", "#ffb547", "#ff6b6b", "#ff6bd6"];
  function confettiAt(el, power = 1) {
    if (!window.confetti || reduce) return;
    let x = 0.5, y = 0.5;
    if (el) { const r = el.getBoundingClientRect(); x = (r.left + r.width / 2) / innerWidth; y = (r.top + r.height / 2) / innerHeight; }
    confetti({ particleCount: Math.round(45 * power), spread: 55 + 25 * power, startVelocity: 26 + 8 * power, origin: { x, y }, colors: PALETTE, scalar: 0.9, ticks: 160, disableForReducedMotion: true });
  }
  function bigCelebration() {
    if (!window.confetti || reduce) return;
    const end = Date.now() + 1200;
    (function frame() {
      confetti({ particleCount: 6, angle: 60, spread: 70, origin: { x: 0, y: 0.75 }, colors: PALETTE });
      confetti({ particleCount: 6, angle: 120, spread: 70, origin: { x: 1, y: 0.75 }, colors: PALETTE });
      if (Date.now() < end) requestAnimationFrame(frame);
    })();
  }
  let bannerT;
  function banner(kind, title, sub) {
    const b = $("#banner");
    b.className = "banner " + kind;
    b.innerHTML = `${esc(title)}${sub ? `<br><small>${esc(sub)}</small>` : ""}`;
    requestAnimationFrame(() => b.classList.add("show"));
    clearTimeout(bannerT); bannerT = setTimeout(() => b.classList.remove("show"), 1500);
  }
  function xpFloat(el, text) {
    const r = el ? el.getBoundingClientRect() : { left: innerWidth / 2, top: innerHeight / 2, width: 0 };
    const d = document.createElement("div");
    d.className = "xp-float"; d.textContent = text;
    d.style.left = r.left + r.width - 70 + "px"; d.style.top = r.top - 6 + "px";
    document.body.appendChild(d); setTimeout(() => d.remove(), 1200);
  }

  // ---------- Racha y XP ----------
  let run = 0;
  function onGood(el, base = 10) {
    run++;
    const bonus = run >= 3 ? Math.min(run, 10) : 0;
    const pts = base + bonus;
    S.xp += pts; if (run > S.best) S.best = run; save();
    if ([3, 5, 10, 15, 20, 30].includes(run)) {
      Snd.combo(); confettiAt(el, 1.8);
      banner("combo", `¡Racha x${run}!`, `+${pts} XP · vas imparable`);
    } else {
      Snd.good(); confettiAt(el, 0.8);
      banner("good", pick(["¡Correcto!", "¡Exacto!", "¡Bien hecho!", "¡Eso es!", "¡Perfecto!"]), `+${pts} XP`);
    }
    if (el) { el.classList.add("glow"); xpFloat(el, `+${pts}`); }
    updateStreak(true);
    return pts;
  }
  function onBad() {
    run = 0; Snd.bad();
    banner("bad", pick(["Casi…", "Uy, no era esa", "Sigue, lo tienes"]), "Lee la explicación");
    updateStreak(false);
    if (navigator.vibrate) navigator.vibrate(60);
  }
  const pick = (a) => a[(Math.random() * a.length) | 0];
  function updateStreak(bump) {
    const s = $("#streak"); if (!s) return;
    s.innerHTML = `${icon("flame", "sm")} ${run}`;
    s.classList.toggle("cold", run === 0);
    if (bump) { s.classList.remove("bump"); void s.offsetWidth; s.classList.add("bump"); }
  }
  const streakPill = () => `<span class="streak ${run ? "" : "cold"}" id="streak">${icon("flame", "sm")} ${run}</span>`;

  // ---------- Selección de reactivos (prioriza errores y no vistos) ----------
  function prioritize(items, n) {
    const w = (it) => { const r = S.res[it.id]; if (!r) return 1 + Math.random(); return r.last ? 2.2 + Math.random() : Math.random() * 0.9; };
    return shuffle(items.map((it) => [w(it), it]).sort((a, b) => a[0] - b[0]).slice(0, n).map((x) => x[1]));
  }
  const byTopics = (arr, topics) => (topics.length ? arr.filter((x) => topics.includes(x.t)) : arr);

  // Dominio por tema (quiz + V/F + completar)
  function mastery(topic) {
    const pool = [...DB.quiz, ...DB.tf, ...DB.cloze].filter((x) => !topic || x.t === topic);
    if (!pool.length) return 0;
    const got = pool.filter((x) => S.res[x.id] && S.res[x.id].last).length;
    return Math.round((got / pool.length) * 100);
  }

  // ---------- Router ----------
  let timers = [];
  let KB = null; // manejador de teclado de la vista activa
  const clearTimers = () => { timers.forEach(clearInterval); timers = []; };
  const view = () => $("#view");
  const setFocus = (on) => document.body.classList.toggle("focus", on);
  const routes = { home, cards, quiz, cloze, tf, match, calc, sim, review, settings };

  function route() {
    clearTimers(); KB = null; setFocus(false); run = 0;
    const r = (location.hash.replace(/^#\/?/, "").split("?")[0] || "home");
    (routes[r] || home)();
    $$("#nav a").forEach((a) => a.classList.toggle("on", a.dataset.r === r || (r === "home" && a.dataset.r === "home")));
    window.scrollTo(0, 0);
  }
  window.addEventListener("hashchange", route);
  document.addEventListener("keydown", (e) => {
    if (!KB || e.metaKey || e.ctrlKey || e.altKey) return;
    const tag = (document.activeElement || {}).tagName;
    if ((e.key === "Enter" || e.key === " ") && (tag === "BUTTON" || tag === "A")) return; // deja el clic nativo
    KB(e);
  });

  // ---------- Cabecera ----------
  function paintTop() {
    document.documentElement.dataset.theme = S.theme;
    $('meta[name="theme-color"]').setAttribute("content", S.theme === "dark" ? "#15112e" : "#e2e9f2");
    $("#btnTheme").innerHTML = icon(S.theme === "dark" ? "sun" : "moon");
    $("#btnSound").innerHTML = icon(S.sound ? "volume-2" : "volume-x");
  }
  $("#btnTheme").onclick = () => { S.theme = S.theme === "dark" ? "light" : "dark"; save(); paintTop(); };
  $("#btnSound").onclick = () => { S.sound = !S.sound; save(); paintTop(); if (S.sound) Snd.tap(); };
  $$("[data-icon]").forEach((el) => (el.innerHTML = icon(el.dataset.icon)));

  // ================= INICIO =================
  function home() {
    const accuracy = S.total ? Math.round((S.ok / S.total) * 100) : 0;
    const modes = [
      { r: "cards", ic: "layers", tint: "violet", h: "Tarjetas", p: `${DB.cards.length} conceptos con repaso espaciado` },
      { r: "quiz", ic: "brain-circuit", tint: "blue", h: "Quiz tipo examen", p: `${DB.quiz.length} casos prácticos con \"porque…\"` },
      { r: "cloze", ic: "pencil-line", tint: "amber", h: "Completa", p: `${DB.cloze.length} frases clave con pistas` },
      { r: "tf", ic: "circle-help", tint: "coral", h: "Verdadero o falso", p: `${DB.tf.length} afirmaciones trampa` },
      { r: "match", ic: "shapes", tint: "sage", h: "Relaciona", p: "Tasas, artículos y plazos" },
      { r: "calc", ic: "calculator", tint: "green", h: "Casos numéricos", p: "Extra: no vienen en el examen" }
    ];
    view().innerHTML = `
      <section class="hero-wrap enter">
        <div class="hero">
          <div class="eyebrow">Ley del IEPS y su Reglamento</div>
          <h1 id="heroTitle">Prepárate para tu examen</h1>
          <p id="heroSub">Concéntrate en lo que más se te dificulta.</p>
          <div class="countdown" id="cd"></div>
        </div>
        <a class="hero-fab" href="#/sim" aria-label="Iniciar simulacro">${icon("timer", "lg")}</a>
        <div class="float-card">${chip("flame", "amber")} Racha récord: ${S.best} · Nivel ${level()}</div>
      </section>

      <section class="stats enter-2">
        <div class="stat"><b>${S.xp}</b><small>XP · nivel ${level()}</small><div class="lvl-bar"><i style="width:${lvlPct()}%"></i></div></div>
        <div class="stat"><b>${accuracy}%</b><small>Aciertos (${S.ok}/${S.total})</small></div>
        <div class="stat"><b>${mastery()}%</b><small>Dominio total</small></div>
      </section>

      <div class="section-title enter-2">Modos de estudio <span>elige uno</span></div>
      <section class="modes enter-3">
        ${modes.map((m) => `<a class="mode" href="#/${m.r}" style="color:inherit;text-decoration:none">
            ${chip(m.ic, m.tint)}<span class="go">${icon("chevron-right")}</span>
            <div><h3>${m.h}</h3><p>${m.p}</p></div></a>`).join("")}
        <a class="mode wide" href="#/sim" style="color:inherit;text-decoration:none">${chip("timer", "violet")}
          <div><h3>Simulacro de examen</h3><p>30 reactivos al azar, con tiempo y calificación al final</p></div><span class="go">${icon("chevron-right")}</span></a>
        <a class="mode wide" href="#/review" style="color:inherit;text-decoration:none">${chip("rotate-ccw", "coral")}
          <div><h3>Repasa tus errores</h3><p>${countWrong()} reactivos pendientes de dominar</p></div><span class="go">${icon("chevron-right")}</span></a>
      </section>

      <div class="section-title">Dominio por tema <span>toca un tema para practicarlo</span></div>
      <section class="card" style="padding:8px 16px">
        ${DB.topics.map((t) => `<a class="topic-row" href="#/quiz?t=${t.id}" style="color:inherit;text-decoration:none">
            ${chip(t.icon, tintFor[t.id])}
            <div class="info"><b>${t.name}</b><small>${t.arts}</small><div class="bar"><i style="width:${mastery(t.id)}%"></i></div></div>
            <span class="pct">${mastery(t.id)}%</span></a>`).join("")}
      </section>`;
    tickCountdown(); timers.push(setInterval(tickCountdown, 1000));
  }
  const chip = (ic, tint) => `<span class="chip-icon tint-${tint}">${icon(ic)}</span>`;
  const countWrong = () => Object.entries(S.res).filter(([, r]) => !r.last).length;

  function tickCountdown() {
    const cd = $("#cd"); if (!cd) return;
    const diff = new Date(DB.examDate) - new Date();
    if (diff <= 0) {
      $("#heroTitle").textContent = "¡Mucho éxito en tu examen!";
      $("#heroSub").textContent = "Repasa las tarjetas una última vez y confía en lo que estudiaste.";
      cd.innerHTML = ""; return;
    }
    const d = Math.floor(diff / 864e5), h = Math.floor(diff / 36e5) % 24, m = Math.floor(diff / 6e4) % 60, s = Math.floor(diff / 1e3) % 60;
    $("#heroTitle").textContent = d >= 1 ? `Tu examen es en ${d} día${d > 1 ? "s" : ""}` : "Tu examen es muy pronto";
    $("#heroSub").textContent = "Simulacro, tarjetas y repaso de errores: en ese orden rinde más.";
    const box = (v, l) => `<div class="cd-box"><b>${String(v).padStart(2, "0")}</b><small>${l}</small></div>`;
    cd.innerHTML = (d ? box(d, "días") : "") + box(h, "horas") + box(m, "min") + box(s, "seg");
  }

  // ================= Pantalla de configuración reutilizable =================
  function setup({ title, desc, ic, tint, pool, sizes = [10, 20, 0], onStart, extra = "" }) {
    const pre = new URLSearchParams(location.hash.split("?")[1] || "").get("t");
    let sel = pre ? [pre] : [];
    let size = sizes[0];
    const draw = () => {
      const avail = byTopics(pool, sel).length;
      view().innerHTML = `
        <section class="card setup enter">
          <div class="row" style="margin-bottom:12px">${chip(ic, tint)}<div><h2>${title}</h2><div class="muted" style="font-size:14px">${desc}</div></div></div>
          <div class="label">Temas</div>
          <div class="chips" id="chips">
            <button class="chip ${sel.length ? "" : "on"}" data-t="">Todos</button>
            ${DB.topics.filter((t) => pool.some((x) => x.t === t.id)).map((t) => `<button class="chip ${sel.includes(t.id) ? "on" : ""}" data-t="${t.id}">${t.name}</button>`).join("")}
          </div>
          ${sizes.length > 1 ? `<div class="label">Cantidad</div>
          <div class="seg" id="seg" style="margin-top:10px">${sizes.map((n) => `<button class="${n === size ? "on" : ""}" data-n="${n}">${n || "Todos"}</button>`).join("")}</div>` : ""}
          ${extra}
          <div style="margin-top:22px"><button class="btn block" id="go" ${avail ? "" : "disabled"}>${icon("sparkles")} Comenzar · ${size && size < avail ? size : avail} reactivos</button></div>
        </section>`;
      $$("#chips .chip").forEach((b) => (b.onclick = () => {
        const t = b.dataset.t; Snd.tap();
        if (!t) sel = []; else sel = sel.includes(t) ? sel.filter((x) => x !== t) : [...sel, t];
        draw();
      }));
      $$("#seg button").forEach((b) => (b.onclick = () => { size = +b.dataset.n; Snd.tap(); draw(); }));
      $("#go").onclick = () => { Snd.get(); const items = byTopics(pool, sel); onStart(prioritize(items, size || items.length)); };
    };
    draw();
  }

  const sessTop = (i, n, extra = "") => `
    <div class="sess-top">
      <a class="icon-btn" href="#/" aria-label="Salir">${icon("x")}</a>
      <div class="progress"><i style="width:${(i / n) * 100}%"></i></div>
      ${extra}${streakPill()}<span class="counter">${i + 1}/${n}</span>
    </div>`;

  // ================= RESULTADO =================
  function result({ ok, n, xp, again, review = "" }) {
    setFocus(false); window.scrollTo(0, 0);
    const p = n ? Math.round((ok / n) * 100) : 0;
    const stars = p >= 90 ? 3 : p >= 75 ? 2 : p >= 50 ? 1 : 0;
    const msg = p >= 90 ? "¡Dominado!" : p >= 75 ? "¡Muy bien!" : p >= 50 ? "Vas por buen camino" : "A repasar, tú puedes";
    view().innerHTML = `
      <section class="card result enter">
        <div class="ring" id="ring" style="--p:0"><div><b>${p}%</b><small>${ok} de ${n}</small></div></div>
        <div class="stars">${[1, 2, 3].map((i) => icon("star", i <= stars ? "s" + i : "")).join("")}</div>
        <h2>${msg}</h2>
        <div class="muted">Ganaste <b style="color:var(--ok)">+${xp} XP</b> · Nivel ${level()}</div>
        <div class="res-grid">
          <div class="stat"><b>${ok}</b><small>Correctas</small></div>
          <div class="stat"><b>${n - ok}</b><small>Por repasar</small></div>
          <div class="stat"><b>${S.best}</b><small>Racha récord</small></div>
        </div>
        <div class="row wrap" style="justify-content:center">
          <button class="btn" id="again">${icon("rotate-ccw")} Otra ronda</button>
          <a class="btn ghost" href="#/">${icon("home")} Inicio</a>
        </div>
        ${review}
      </section>`;
    $("#again").onclick = again;
    let v = 0; const ring = $("#ring");
    const t = setInterval(() => { v += 2; ring.style.setProperty("--p", Math.min(v, p)); if (v >= p) clearInterval(t); }, 14);
    timers.push(t);
    setTimeout(() => $$(".stars .icon").forEach((s, i) => i < stars && setTimeout(() => { s.classList.add("on"); Snd.tone(880 + i * 220, 0, 0.2, "sine", 0.1); }, i * 220)), 500);
    if (p >= 50) { Snd.win(); bigCelebration(); }
  }

  // ================= QUIZ =================
  function quiz() {
    setup({ title: "Quiz tipo examen", desc: "Casos prácticos con opciones que se justifican con un \"porque…\", como los de tu profesora.", ic: "brain-circuit", tint: "blue", pool: DB.quiz, onStart: (items) => runQuiz(items, quiz) });
  }
  function runQuiz(items, again) {
    setFocus(true); run = 0;
    let i = 0, ok = 0, xp = 0;
    const show = () => { window.scrollTo(0, 0);
      if (i >= items.length) return result({ ok, n: items.length, xp, again: () => runQuiz(prioritize(items, items.length), again) });
      const q = items[i], order = shuffle([0, 1, 2, 3]);
      let usedHint = false, done = false;
      view().innerHTML = `${sessTop(i, items.length)}
        <section class="q-card enter">
          <div class="q-badge">${String(i + 1).padStart(2, "0")}</div>
          <div class="q-meta"><span class="tag">${icon(topicById[q.t].icon, "sm")} ${topicById[q.t].name}</span>
            <button class="hint-btn" id="hint">${icon("lightbulb", "sm")} Pista</button></div>
          ${stem(q.q)}
          <div id="hintBox"></div>
        </section>
        <div class="opts" id="opts">${order.map((k, j) => `<button class="opt" data-k="${k}"><span class="letter">${LETTERS[j]}</span><span>${esc(q.o[k])}</span><span class="mark"></span></button>`).join("")}</div>
        <div id="after"></div>`;
      $("#hint").onclick = () => {
        if (usedHint || done) return; usedHint = true; Snd.flip();
        $("#hintBox").innerHTML = `<div class="hint-box">${icon("lightbulb")}${esc(q.hint)}</div>`; $("#hint").disabled = true;
      };
      const choose = (btn) => {
        if (done) return; done = true;
        const k = +btn.dataset.k, good = k === q.a;
        $$("#opts .opt").forEach((b) => {
          b.disabled = true;
          const kk = +b.dataset.k;
          if (kk === q.a) { b.classList.add("correct"); b.querySelector(".mark").innerHTML = icon("check", "sm"); }
          else if (b === btn) { b.classList.add("wrong"); b.querySelector(".mark").innerHTML = icon("x", "sm"); }
          else b.classList.add("dim");
        });
        record(q.id, good);
        if (good) { ok++; const c = $("#opts .correct"); c.classList.add("pop"); xp += onGood(c, usedHint ? 5 : 10); }
        else onBad();
        $("#after").innerHTML = `
          <div class="explain ${good ? "good" : "bad"}">
            <h4>${icon(good ? "check" : "book-open")} ${good ? "¿Por qué es correcta?" : "Respuesta correcta: " + LETTERS[order.indexOf(q.a)] + ")"}</h4>
            <p>${esc(q.why)}</p><span class="art">${icon("scale", "sm")} ${esc(q.art)}</span>
          </div>
          <div class="next-bar"><button class="btn block" id="next">${i + 1 < items.length ? "Siguiente" : "Ver resultado"} ${icon("chevron-right")}</button></div>`;
        $("#next").onclick = () => { i++; show(); };
        $("#next").focus({ preventScroll: true });
        setTimeout(() => { const a = $("#after"); if (a) a.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, 250);
      };
      $$("#opts .opt").forEach((b) => (b.onclick = () => choose(b)));
      KB = (e) => {
        const n = "1234abcd".indexOf(e.key.toLowerCase());
        if (!done && n >= 0) { e.preventDefault(); choose($$("#opts .opt")[n % 4]); }
        else if (!done && e.key.toLowerCase() === "h") $("#hint").click();
        else if (done && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); $("#next").click(); }
      };
    };
    show();
  }

  // ================= TARJETAS =================
  function cards() {
    setup({ title: "Tarjetas de concepto", desc: "Intenta responder en voz alta antes de voltearla. Las que no sepas volverán más seguido.", ic: "layers", tint: "violet", pool: DB.cards, sizes: [15, 30, 0],
      onStart: (items) => {
        const sorted = items.slice().sort((a, b) => (S.box[a.id] || 0) - (S.box[b.id] || 0));
        runCards(sorted);
      } });
  }
  function runCards(queue) {
    setFocus(true); run = 0;
    const total = queue.length; let seen = 0, known = 0, xp = 0;
    const show = () => { window.scrollTo(0, 0);
      if (!queue.length) return result({ ok: known, n: total, xp, again: cards });
      const c = queue[0], box = S.box[c.id] || 0;
      view().innerHTML = `${sessTop(Math.min(seen, total - 1), total)}
        <div class="flip enter" id="flip">
          <div class="flip-inner">
            <div class="face front">
              <div class="foot"><span class="tag">${icon(topicById[c.t].icon, "sm")} ${topicById[c.t].name}</span><span class="boxes">${[1, 2, 3, 4, 5].map((n) => `<i class="${n <= box ? "on" : ""}"></i>`).join("")}</span></div>
              <div class="big">${esc(c.f)}</div>
              <div class="foot"><span>Toca para voltear</span>${icon("rotate-ccw", "sm")}</div>
            </div>
            <div class="face back">
              <div class="foot"><span>Respuesta</span><span>${esc(c.art)}</span></div>
              <div class="big">${esc(c.b)}</div>
              <div class="foot"><span>¿Qué tan bien lo sabías?</span></div>
            </div>
          </div>
        </div>
        <div class="rate" id="rate" style="visibility:hidden">
          <button class="r1" data-v="1">${icon("x")}No lo sabía</button>
          <button class="r2" data-v="2">${icon("circle-help")}Dudé</button>
          <button class="r3" data-v="3">${icon("check")}Lo sabía</button>
        </div>`;
      const flip = () => { $("#flip").classList.toggle("on"); Snd.flip(); $("#rate").style.visibility = "visible"; };
      $("#flip").onclick = flip;
      const rate = (v) => {
        if ($("#rate").style.visibility !== "visible") return;
        queue.shift(); seen++;
        if (v === 3) { S.box[c.id] = Math.min(5, box + 1); known++; xp += onGood($("#rate .r3"), 4); }
        else if (v === 2) { S.box[c.id] = Math.max(1, box); Snd.tap(); queue.splice(Math.min(queue.length, 3), 0, c); seen--; }
        else { S.box[c.id] = 1; onBad(); queue.splice(Math.min(queue.length, 2), 0, c); seen--; }
        save(); setTimeout(show, v === 3 ? 380 : 150);
      };
      $$("#rate button").forEach((b) => (b.onclick = (e) => { e.stopPropagation(); rate(+b.dataset.v); }));
      KB = (e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); flip(); } else if ("123".includes(e.key)) rate(+e.key); };
    };
    show();
  }

  // ================= COMPLETAR =================
  const norm = (s) => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[\s%$,]/g, "").replace(/\.$/, "");
  const same = (a, b) => { const x = norm(a), y = norm(b); if (x === y) return true; const nx = parseFloat(x), ny = parseFloat(y); return /^[\d.]+$/.test(x) && /^[\d.]+$/.test(y) && !isNaN(nx) && Math.abs(nx - ny) < 1e-9; };
  function cloze() {
    setup({ title: "Completa con pistas", desc: "Escribe la palabra o cifra clave. Pide pistas sólo si de verdad las necesitas: cada una resta puntos.", ic: "pencil-line", tint: "amber", pool: DB.cloze, onStart: (items) => runCloze(items) });
  }
  function runCloze(items) {
    setFocus(true); run = 0; let i = 0, ok = 0, xp = 0;
    const show = () => { window.scrollTo(0, 0);
      if (i >= items.length) return result({ ok, n: items.length, xp, again: cloze });
      const z = items[i], parts = z.s.split(/\{\{(.*?)\}\}/);
      const answers = parts.filter((_, k) => k % 2).map((a) => a.split("|"));
      let lvl = 0, done = false;
      const html = parts.map((p, k) => k % 2 ? `<input class="blank" data-b="${(k - 1) / 2}" autocomplete="off" autocapitalize="off" spellcheck="false" style="width:${Math.max(4, answers[(k - 1) / 2][0].length + 2)}ch" aria-label="Espacio ${(k + 1) / 2}">` : esc(p)).join("");
      view().innerHTML = `${sessTop(i, items.length)}
        <section class="q-card enter">
          <div class="q-badge">${String(i + 1).padStart(2, "0")}</div>
          <div class="q-meta"><span class="tag">${icon(topicById[z.t].icon, "sm")} ${esc(z.art)}</span>
            <button class="hint-btn" id="hint">${icon("lightbulb", "sm")} Pista <span id="hl">0/3</span></button></div>
          <div class="cloze-text">${html}</div>
          <div class="hint-steps"><i></i><i></i><i></i></div>
          <div id="hintBox"></div>
        </section>
        <div id="after"><div class="next-bar"><button class="btn block" id="check">${icon("check")} Comprobar</button></div></div>`;
      const inputs = $$(".blank");
      inputs[0].focus({ preventScroll: true });
      inputs.forEach((inp, k) => inp.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); k < inputs.length - 1 && !inputs[k + 1].value ? inputs[k + 1].focus() : $("#check") && $("#check").click(); } }));
      $("#hint").onclick = () => {
        if (done || lvl >= 3) return; lvl++; Snd.flip();
        $$(".hint-steps i").forEach((s, k) => s.classList.toggle("on", k < lvl)); $("#hl").textContent = lvl + "/3";
        if (lvl === 1) $("#hintBox").innerHTML = `<div class="hint-box">${icon("lightbulb")}${esc(z.h)}</div>`;
        if (lvl === 2) inputs.forEach((inp, k) => (inp.placeholder = answers[k][0][0] + "…" + " (" + answers[k][0].length + ")"));
        if (lvl === 3) inputs.forEach((inp, k) => { const a = answers[k][0]; inp.placeholder = a.slice(0, Math.ceil(a.length / 2)) + "·".repeat(a.length - Math.ceil(a.length / 2)); });
        if (lvl === 3) $("#hint").disabled = true;
      };
      $("#check").onclick = () => {
        if (done) return;
        if (inputs.every((x) => !x.value.trim())) { inputs[0].focus(); inputs[0].classList.remove("no"); void inputs[0].offsetWidth; inputs[0].classList.add("no"); return; }
        done = true;
        let all = true;
        inputs.forEach((inp, k) => {
          const good = answers[k].some((a) => same(inp.value, a));
          inp.classList.add(good ? "ok" : "no"); inp.readOnly = true;
          if (!good) { all = false; inp.insertAdjacentHTML("afterend", `<span class="fix">${esc(answers[k][0])}</span>`); }
        });
        record(z.id, all);
        if (all) { ok++; xp += onGood($(".cloze-text"), Math.max(3, 12 - lvl * 3)); } else onBad();
        $("#after").innerHTML = `<div class="explain ${all ? "good" : "bad"}"><h4>${icon(all ? "check" : "book-open")} ${all ? (lvl ? "¡Bien! Con " + lvl + " pista" + (lvl > 1 ? "s" : "") : "¡Sin pistas, excelente!") : "Repasa esta idea"}</h4>
            <p>${esc(z.s.replace(/\{\{(.*?)(\|.*?)?\}\}/g, "$1"))}</p><span class="art">${icon("scale", "sm")} ${esc(z.art)}</span></div>
          <div class="next-bar"><button class="btn block" id="next">${i + 1 < items.length ? "Siguiente" : "Ver resultado"} ${icon("chevron-right")}</button></div>`;
        $("#next").onclick = () => { i++; show(); };
        setTimeout(() => $("#next").focus({ preventScroll: true }), 50);
      };
      KB = (e) => { if (done && e.key === "Enter" && document.activeElement.id !== "next") { e.preventDefault(); $("#next").click(); } };
    };
    show();
  }

  // ================= VERDADERO / FALSO =================
  function tf() {
    setup({ title: "Verdadero o falso", desc: "Afirmaciones con trampas típicas: tasas, plazos y excepciones.", ic: "circle-help", tint: "coral", pool: DB.tf, onStart: (items) => runTF(items) });
  }
  function runTF(items) {
    setFocus(true); run = 0; let i = 0, ok = 0, xp = 0;
    const show = () => { window.scrollTo(0, 0);
      if (i >= items.length) return result({ ok, n: items.length, xp, again: tf });
      const v = items[i]; let done = false;
      view().innerHTML = `${sessTop(i, items.length)}
        <section class="q-card enter"><div class="q-badge">${String(i + 1).padStart(2, "0")}</div>
          <div class="q-meta"><span class="tag">${icon(topicById[v.t].icon, "sm")} ${topicById[v.t].name}</span></div>
          <p class="q-text tf-text">${esc(v.s)}</p></section>
        <div class="tf"><button class="v" data-v="1">${icon("check", "lg")}Verdadero</button><button class="f" data-v="0">${icon("x", "lg")}Falso</button></div>
        <div id="after"></div>`;
      const choose = (b) => {
        if (done) return; done = true;
        const good = (b.dataset.v === "1") === v.v;
        $$(".tf button").forEach((x) => x.classList.add(x === b ? "pick" : "dim"));
        record(v.id, good);
        if (good) { ok++; xp += onGood(b, 8); } else onBad();
        $("#after").innerHTML = `<div class="explain ${good ? "good" : "bad"}"><h4>${icon(good ? "check" : "book-open")} Es ${v.v ? "VERDADERO" : "FALSO"}</h4><p>${esc(v.why)}</p></div>
          <div class="next-bar"><button class="btn block" id="next">${i + 1 < items.length ? "Siguiente" : "Ver resultado"} ${icon("chevron-right")}</button></div>`;
        $("#next").onclick = () => { i++; show(); };
      };
      $$(".tf button").forEach((b) => (b.onclick = () => choose(b)));
      KB = (e) => { const k = e.key.toLowerCase(); if (!done && (k === "v" || k === "1")) choose($(".tf .v")); else if (!done && (k === "f" || k === "2")) choose($(".tf .f")); else if (done && e.key === "Enter") $("#next").click(); };
    };
    show();
  }

  // ================= RELACIONA =================
  function match() {
    view().innerHTML = `<section class="card setup enter">
        <div class="row" style="margin-bottom:12px">${chip("shapes", "sage")}<div><h2>Relaciona</h2><div class="muted" style="font-size:14px">Toca un concepto y luego su pareja. Cada error resta puntos.</div></div></div>
        <div class="modes" style="margin-top:14px">
          ${DB.match.map((m, k) => `<button class="mode" data-k="${k}">${chip("link-2", ["violet", "blue", "green", "amber", "coral", "sage"][k % 6])}<div><h3>${esc(m.title)}</h3><p>${m.pairs.length} parejas</p></div></button>`).join("")}
          <button class="mode" data-k="mix">${chip("shuffle", "violet")}<div><h3>Mezcla aleatoria</h3><p>6 parejas de todos los juegos</p></div></button>
        </div></section>`;
    $$(".mode[data-k]").forEach((b) => (b.onclick = () => {
      Snd.get();
      if (b.dataset.k !== "mix") return runMatch(DB.match[+b.dataset.k]);
      const used = new Set(), pairs = [];
      for (const p of shuffle(DB.match.flatMap((m) => m.pairs))) { if (!used.has(p[1]) && !used.has(p[0])) { used.add(p[1]); used.add(p[0]); pairs.push(p); } if (pairs.length === 6) break; }
      runMatch({ title: "Mezcla aleatoria", pairs });
    }));
  }
  function runMatch(set) {
    setFocus(true); run = 0;
    const L = shuffle(set.pairs.map((p, k) => ({ k, s: p[0] }))), R = shuffle(set.pairs.map((p, k) => ({ k, s: p[1] })));
    let selL = null, matched = 0, errors = 0, xp = 0;
    view().innerHTML = `${sessTop(0, 1).replace(/<span class="counter">.*?<\/span>/, `<span class="counter" id="mc">0/${set.pairs.length}</span>`)}
      <section class="card enter"><h3 style="margin:0">${esc(set.title)}</h3><div class="muted" style="font-size:13.5px">Toca un elemento de la izquierda y después su pareja.</div></section>
      <div class="match"><div class="col">${L.map((x) => `<button class="m-item" data-side="L" data-k="${x.k}">${esc(x.s)}</button>`).join("")}</div>
      <div class="col">${R.map((x) => `<button class="m-item" data-side="R" data-k="${x.k}">${esc(x.s)}</button>`).join("")}</div></div>`;
    $$(".m-item").forEach((b) => (b.onclick = () => {
      if (b.dataset.side === "L") { $$(".m-item[data-side=L]").forEach((x) => x.classList.remove("sel")); b.classList.add("sel"); selL = b; Snd.tap(); return; }
      if (!selL) { b.classList.remove("err"); void b.offsetWidth; b.classList.add("err"); return; }
      if (selL.dataset.k === b.dataset.k) {
        [selL, b].forEach((x) => { x.classList.remove("sel"); x.classList.add("done"); });
        matched++; xp += onGood(b, 6); selL = null;
        $("#mc").textContent = `${matched}/${set.pairs.length}`;
        $(".progress i").style.width = (matched / set.pairs.length) * 100 + "%";
        if (matched === set.pairs.length) setTimeout(() => result({ ok: Math.max(0, set.pairs.length - errors), n: set.pairs.length, xp, again: () => runMatch(set) }), 700);
      } else {
        errors++; onBad();
        [selL, b].forEach((x) => { x.classList.remove("err"); void x.offsetWidth; x.classList.add("err"); });
      }
    }));
  }

  // ================= CASOS NUMÉRICOS =================
  function calc() {
    setup({ title: "Casos numéricos", desc: "Extra para entender las tasas y cuotas. Tu profesora indicó que no vienen en el examen; úsalos para fijar conceptos.", ic: "calculator", tint: "green", pool: DB.calc, sizes: [0], onStart: (items) => runCalc(items) });
  }
  function runCalc(items) {
    setFocus(true); run = 0; let i = 0, ok = 0, xp = 0;
    const show = () => { window.scrollTo(0, 0);
      if (i >= items.length) return result({ ok, n: items.length, xp, again: calc });
      const k = items[i]; let done = false;
      view().innerHTML = `${sessTop(i, items.length)}
        <section class="q-card enter"><div class="q-badge">${String(i + 1).padStart(2, "0")}</div>
          <div class="q-meta"><span class="tag">${icon("scale", "sm")} ${esc(k.art)}</span><button class="hint-btn" id="sol">${icon("eye", "sm")} Ver solución</button></div>
          <p class="q-text">${esc(k.q)}</p>
          <div style="margin-top:16px"><input class="num-in" id="num" inputmode="decimal" placeholder="$ 0.00" autocomplete="off"></div>
        </section>
        <div id="after"><div class="next-bar"><button class="btn block" id="check">${icon("check")} Comprobar</button></div></div>`;
      $("#num").focus({ preventScroll: true });
      const finish = (good, gave) => {
        done = true; record(k.id, good);
        if (good) { ok++; xp += onGood($("#num"), 12); } else if (!gave) onBad(); else { run = 0; updateStreak(false); }
        $("#num").readOnly = true; $("#num").style.borderColor = good ? "var(--ok)" : "var(--bad)";
        $("#after").innerHTML = `<div class="explain ${good ? "good" : "bad"}"><h4>${icon(good ? "check" : "calculator")} Resultado: $${fmt(k.ans)}</h4>
          <ol class="steps">${k.steps.map((s, n) => `<li style="animation-delay:${n * 0.25}s">${esc(s)}</li>`).join("")}</ol></div>
          <div class="next-bar"><button class="btn block" id="next">${i + 1 < items.length ? "Siguiente" : "Ver resultado"} ${icon("chevron-right")}</button></div>`;
        $("#next").onclick = () => { i++; show(); };
      };
      $("#check").onclick = () => {
        if (done) return; const v = parseFloat($("#num").value.replace(/[$,\s]/g, ""));
        if (isNaN(v)) { $("#num").focus(); return; }
        finish(Math.abs(v - k.ans) <= Math.max(0.05, Math.abs(k.ans) * 0.0005), false);
      };
      $("#sol").onclick = () => !done && finish(false, true);
      KB = (e) => { if (e.key === "Enter") { e.preventDefault(); done ? $("#next").click() : $("#check").click(); } };
    };
    show();
  }

  // ================= SIMULACRO =================
  function sim() {
    const last = S.sims.slice(-5).reverse();
    view().innerHTML = `<section class="card setup enter">
        <div class="row" style="margin-bottom:12px">${chip("timer", "violet")}<div><h2>Simulacro de examen</h2><div class="muted" style="font-size:14px">30 reactivos al azar de todos los temas, como el parcial. Sin retroalimentación hasta entregar.</div></div></div>
        <div class="label">Tiempo</div>
        <div class="seg" id="seg" style="margin-top:10px"><button data-m="30">30 min</button><button class="on" data-m="45">45 min</button><button data-m="60">60 min</button><button data-m="0">Sin límite</button></div>
        <div style="margin-top:22px"><button class="btn block" id="go">${icon("timer")} Iniciar simulacro</button></div>
        ${last.length ? `<div class="label">Intentos recientes</div>${last.map((s) => `<div class="set-row"><div class="info"><b>${s.ok}/30 · ${Math.round((s.ok / 30) * 100)}%</b><small>${new Date(s.d).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })}</small></div><span class="pct" style="color:${s.ok >= 24 ? "var(--ok)" : s.ok >= 18 ? "var(--c-amber)" : "var(--bad)"}">${s.ok >= 18 ? "Aprobado" : "Repasar"}</span></div>`).join("")}` : ""}
      </section>`;
    let mins = 45;
    $$("#seg button").forEach((b) => (b.onclick = () => { mins = +b.dataset.m; $$("#seg button").forEach((x) => x.classList.toggle("on", x === b)); Snd.tap(); }));
    $("#go").onclick = () => { Snd.get(); runSim(shuffle(DB.quiz).slice(0, 30), mins); };
  }
  function runSim(items, mins) {
    setFocus(true);
    const ans = new Array(items.length).fill(null), orders = items.map(() => shuffle([0, 1, 2, 3]));
    let i = 0, left = mins * 60, confirmT = 0;
    const end = () => {
      clearTimers();
      let ok = 0; items.forEach((q, k) => { const g = ans[k] === q.a; if (g) ok++; record(q.id, g); });
      const xp = ok * 6; S.xp += xp; S.sims.push({ d: Date.now(), ok }); save();
      const wrong = items.map((q, k) => ({ q, k })).filter(({ q, k }) => ans[k] !== q.a);
      result({ ok, n: items.length, xp, again: sim,
        review: wrong.length ? `<div class="label" style="text-align:left">Revisa tus errores (${wrong.length})</div>${wrong.map(({ q, k }) => `
          <div class="review-item"><b>${k + 1}. ${esc(q.q)}</b>
            ${ans[k] !== null ? `<div style="color:var(--bad)">${icon("x", "sm")} Tu respuesta: ${esc(q.o[ans[k]])}</div>` : `<div class="faint">Sin responder</div>`}
            <div style="color:var(--ok)">${icon("check", "sm")} ${esc(q.o[q.a])}</div>
            <div class="muted" style="margin-top:6px">${esc(q.why)} <b style="color:var(--primary)">${esc(q.art)}</b></div></div>`).join("")}` : "" });
    };
    const timerHtml = () => mins ? `<span class="timer-pill ${left < 300 ? "warn" : ""}" id="tp">${icon("timer", "sm")} ${String((left / 60) | 0).padStart(2, "0")}:${String(left % 60).padStart(2, "0")}</span>` : "";
    if (mins) timers.push(setInterval(() => { left--; const tp = $("#tp"); if (tp) tp.outerHTML = timerHtml(); if (left <= 0) { banner("bad", "¡Tiempo!", "Se entregó tu simulacro"); end(); } }, 1000));
    const show = () => { window.scrollTo(0, 0);
      const q = items[i], order = orders[i];
      view().innerHTML = `
        <div class="sess-top"><a class="icon-btn" href="#/" aria-label="Salir">${icon("x")}</a>
          <div class="progress"><i style="width:${(ans.filter((a) => a !== null).length / items.length) * 100}%"></i></div>${timerHtml()}<span class="counter">${i + 1}/${items.length}</span></div>
        <section class="q-card enter"><div class="q-badge">${String(i + 1).padStart(2, "0")}</div>
          <div class="q-meta"><span class="tag">${icon(topicById[q.t].icon, "sm")} ${topicById[q.t].name}</span></div>
          ${stem(q.q)}</section>
        <div class="opts" id="opts">${order.map((k, j) => `<button class="opt ${ans[i] === k ? "picked" : ""}" data-k="${k}"><span class="letter">${LETTERS[j]}</span><span>${esc(q.o[k])}</span><span class="mark">${ans[i] === k ? icon("check", "sm") : ""}</span></button>`).join("")}</div>
        <div class="row" style="margin-top:16px">
          <button class="btn ghost sm" id="prev" ${i ? "" : "disabled"}>${icon("chevron-left")} Anterior</button><span class="spacer"></span>
          ${i + 1 < items.length ? `<button class="btn sm" id="nx">Siguiente ${icon("chevron-right")}</button>` : ""}</div>
        <section class="card" style="margin-top:16px;padding:16px">
          <div class="row"><b style="font-size:14px">Mapa del examen</b><span class="spacer"></span><span class="muted" style="font-size:12.5px">${ans.filter((a) => a !== null).length} respondidas</span></div>
          <div class="sim-nav">${items.map((_, k) => `<button class="${ans[k] !== null ? "ans" : ""} ${k === i ? "cur" : ""}" data-j="${k}">${k + 1}</button>`).join("")}</div>
          <button class="btn ok block" id="submit" style="margin-top:14px">${icon("check")} Entregar examen</button>
        </section>`;
      $$("#opts .opt").forEach((b) => (b.onclick = () => {
        ans[i] = +b.dataset.k; Snd.tap();
        $$("#opts .opt").forEach((x) => { x.classList.toggle("picked", x === b); x.querySelector(".mark").innerHTML = x === b ? icon("check", "sm") : ""; });
        setTimeout(() => { if (i + 1 < items.length) { i++; show(); } else show(); }, 260);
      }));
      $("#prev").onclick = () => { i--; show(); };
      if ($("#nx")) $("#nx").onclick = () => { i++; show(); };
      $$(".sim-nav button").forEach((b) => (b.onclick = () => { i = +b.dataset.j; show(); }));
      $("#submit").onclick = () => {
        const pending = ans.filter((a) => a === null).length;
        if (Date.now() - confirmT > 3000) { confirmT = Date.now(); $("#submit").innerHTML = `${icon("circle-help")} ${pending ? `Faltan ${pending}. ` : ""}Toca otra vez para entregar`; return; }
        end();
      };
      KB = (e) => { const n = "1234abcd".indexOf(e.key.toLowerCase()); if (n >= 0) $$("#opts .opt")[n % 4].click(); else if (e.key === "ArrowRight" && i + 1 < items.length) { i++; show(); } else if (e.key === "ArrowLeft" && i) { i--; show(); } };
    };
    show();
  }

  // ================= REPASO DE ERRORES =================
  function review() {
    const wrong = (arr) => arr.filter((x) => S.res[x.id] && !S.res[x.id].last);
    const q = wrong(DB.quiz), v = wrong(DB.tf), z = wrong(DB.cloze), k = wrong(DB.calc);
    const total = q.length + v.length + z.length + k.length;
    view().innerHTML = `<section class="card setup enter">
      <div class="row" style="margin-bottom:12px">${chip("rotate-ccw", "coral")}<div><h2>Repasa tus errores</h2><div class="muted" style="font-size:14px">Reactivos cuya última respuesta fue incorrecta. Al acertarlos salen de esta lista.</div></div></div>
      ${total ? `<div class="modes" style="margin-top:14px">
        ${q.length ? `<button class="mode" id="rq">${chip("brain-circuit", "blue")}<div><h3>Quiz</h3><p>${q.length} por repasar</p></div></button>` : ""}
        ${v.length ? `<button class="mode" id="rv">${chip("circle-help", "coral")}<div><h3>Verdadero o falso</h3><p>${v.length} por repasar</p></div></button>` : ""}
        ${z.length ? `<button class="mode" id="rz">${chip("pencil-line", "amber")}<div><h3>Completa</h3><p>${z.length} por repasar</p></div></button>` : ""}
        ${k.length ? `<button class="mode" id="rk">${chip("calculator", "green")}<div><h3>Casos numéricos</h3><p>${k.length} por repasar</p></div></button>` : ""}
      </div>` : `<div class="empty">${chip("trophy", "green")}<h3>¡Sin errores pendientes!</h3><p class="muted">Haz un quiz o un simulacro y aquí aparecerá lo que debas reforzar.</p><a class="btn" href="#/quiz">Ir al quiz</a></div>`}
    </section>`;
    if ($("#rq")) $("#rq").onclick = () => runQuiz(shuffle(q), review);
    if ($("#rv")) $("#rv").onclick = () => runTF(shuffle(v));
    if ($("#rz")) $("#rz").onclick = () => runCloze(shuffle(z));
    if ($("#rk")) $("#rk").onclick = () => runCalc(shuffle(k));
  }

  // ================= AJUSTES =================
  function settings() {
    view().innerHTML = `<section class="card enter">
      <h2 style="margin:0 0 6px;letter-spacing:-.02em">Ajustes</h2>
      <div class="set-row">${chip(S.theme === "dark" ? "moon" : "sun", "violet")}<div class="info"><b>Modo oscuro</b><small>Morado profundo con vidrio, o claro azul grisáceo</small></div><button class="toggle ${S.theme === "dark" ? "on" : ""}" id="tTheme" aria-label="Modo oscuro"></button></div>
      <div class="set-row">${chip("volume-2", "blue")}<div class="info"><b>Sonidos</b><small>Efectos al acertar, fallar y completar</small></div><button class="toggle ${S.sound ? "on" : ""}" id="tSound" aria-label="Sonidos"></button></div>
      <div class="set-row">${chip("download", "green")}<div class="info"><b>Exportar progreso</b><small>Descarga un archivo para pasarlo a otro dispositivo</small></div><button class="btn ghost sm" id="exp">Exportar</button></div>
      <div class="set-row">${chip("upload", "amber")}<div class="info"><b>Importar progreso</b><small>Carga un archivo exportado antes</small></div><label class="btn ghost sm" style="cursor:pointer">Importar<input type="file" id="imp" accept="application/json" hidden></label></div>
      <div class="set-row">${chip("trash-2", "coral")}<div class="info"><b>Reiniciar progreso</b><small>Borra XP, rachas y resultados de este navegador</small></div><button class="btn ghost sm" id="rst">Reiniciar</button></div>
    </section>
    <section class="card enter-2" style="margin-top:14px">
      <b>Sobre esta guía</b>
      <p class="muted" style="font-size:13.5px;margin:6px 0 0">Basada en el texto vigente de la LIEPS (última reforma DOF 07-11-2025, cuotas actualizadas DOF 22-12-2025) y en el RLIEPS. Reactivos construidos con el estilo de caso práctico + justificación. Atajos de teclado: 1–4 o a–d para responder, H para pista, Enter para continuar, espacio para voltear tarjetas.</p>
      <p class="faint" style="font-size:12.5px;margin:10px 0 0">${DB.quiz.length} reactivos · ${DB.cards.length} tarjetas · ${DB.cloze.length} para completar · ${DB.tf.length} V/F · ${DB.match.length} juegos · ${DB.calc.length} casos</p>
    </section>`;
    $("#tTheme").onclick = () => { S.theme = S.theme === "dark" ? "light" : "dark"; save(); paintTop(); settings(); };
    $("#tSound").onclick = () => { S.sound = !S.sound; save(); paintTop(); settings(); if (S.sound) Snd.good(); };
    $("#exp").onclick = () => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([JSON.stringify(S, null, 1)], { type: "application/json" }));
      a.download = "progreso-ieps.json"; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    };
    $("#imp").onchange = (e) => {
      const f = e.target.files[0]; if (!f) return;
      f.text().then((t) => { try { S = Object.assign({}, defaults, JSON.parse(t)); save(); paintTop(); banner("good", "Progreso importado", `${S.xp} XP`); settings(); } catch (err) { banner("bad", "Archivo no válido"); } });
    };
    let armed = 0;
    $("#rst").onclick = () => {
      if (Date.now() - armed > 3000) { armed = Date.now(); $("#rst").textContent = "¿Seguro? Toca otra vez"; return; }
      const keep = { theme: S.theme, sound: S.sound }; S = Object.assign({}, defaults, keep); save(); banner("good", "Progreso reiniciado"); settings();
    };
  }

  // ---------- Inicio ----------
  paintTop();
  route();
})();
