const STORAGE_KEY = "overthinking-adhs:v1";

const state = {
  completed: new Set(),
  notes: {},
  currentDay: null,
  saveTimer: null,
};

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const obj = JSON.parse(raw);
    state.completed = new Set(obj.completed || []);
    state.notes = obj.notes || {};
  } catch (e) { console.warn("State konnte nicht geladen werden", e); }
}
function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      completed: [...state.completed],
      notes: state.notes
    }));
  } catch (e) { console.warn("Speichern fehlgeschlagen", e); }
}

const $ = (sel, root = document) => root.querySelector(sel);

function getDay(n) { return DAYS.find(d => d.day === n); }
function isDone(n) { return state.completed.has(n); }
function firstOpenDay() {
  for (let i = 1; i <= 21; i++) if (!state.completed.has(i)) return i;
  return 21;
}
function weekOfDay(n) {
  if (n <= 7) return 1;
  if (n <= 14) return 2;
  return 3;
}

function renderProgress() {
  const n = state.completed.size;
  $("#doneN").textContent = n;
  $("#barFill").style.width = (n / 21) * 100 + "%";
  $(".bar-track").setAttribute("aria-valuenow", n);
  const today = firstOpenDay();
  const lbl = $("#progressLabel");
  if (n === 0) lbl.textContent = "Start: Tag 1";
  else if (n === 21) lbl.textContent = "Alle 21 Tage geschafft 🎉";
  else lbl.textContent = "Heute: Tag " + today;
}

function renderWeeks() {
  const root = $("#weeks");
  root.innerHTML = "";
  const today = firstOpenDay();

  WEEKS.forEach((wk) => {
    const days = DAYS.filter(d => weekOfDay(d.day) === wk.num);
    const sec = document.createElement("section");
    sec.className = "week";
    sec.innerHTML = `
      <div class="week-head">
        <div class="nbox">W${wk.num}</div>
        <div class="titles">
          <div class="wk">Woche ${wk.num}</div>
          <div class="ti">${wk.title}</div>
        </div>
      </div>
      <div class="days-grid"></div>
    `;
    const grid = $(".days-grid", sec);

    days.forEach(d => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "day-tile";
      btn.setAttribute("aria-label", `Tag ${d.day} öffnen`);
      btn.dataset.day = d.day;

      const done = isDone(d.day);
      const isToday = (d.day === today) && !done && state.completed.size < 21;
      const locked = !done && !isToday && d.day > today;

      if (done) btn.classList.add("done");
      else if (isToday) btn.classList.add("today");
      else if (locked) btn.classList.add("locked");
      if (d.placeholder) btn.classList.add("placeholder");

      btn.innerHTML = `
        <span class="n">${d.day}</span>
        <span class="t">${done ? "fertig" : isToday ? "heute" : "Tag"}</span>
      `;
      btn.addEventListener("click", () => openDay(d.day));
      grid.appendChild(btn);
    });

    root.appendChild(sec);
  });
}

function openDay(n) {
  state.currentDay = n;
  const d = getDay(n);
  if (!d) return;

  $("#dayHeaderLabel").textContent = `Tag ${n} von 21 · Woche ${weekOfDay(n)}`;

  const view = $("#dayView");
  const done = isDone(n);
  const note = state.notes[n] || "";
  const placeholder = !!d.placeholder;

  view.innerHTML = `
    <div class="num-display"><span>Tag</span> <b>${n}</b> <span>·</span> <span>Werkzeug</span></div>
    <h2>${escapeHTML(d.tool || "—")}</h2>
    ${placeholder
      ? `<div class="placeholder-badge">⚠ Inhalt aus dem Buch noch eintragen</div>`
      : (d.page ? `<div class="page-ref">Seite ${d.page}</div>` : "")}
    ${d.exercise ? `
      <div class="field-block">
        <div class="ti">Übung</div>
        <div class="bod">${escapeHTML(d.exercise)}</div>
      </div>` : (placeholder ? `
      <div class="field-block">
        <div class="ti">Übung</div>
        <div class="bod" style="color:var(--text-mute);font-style:italic">Hier kommt die Übung aus dem Buch (Datei <code>data.js</code>).</div>
      </div>` : "")}
    ${d.situation ? `
      <div class="field-block">
        <div class="ti">Alltagssituation</div>
        <div class="bod">${escapeHTML(d.situation)}</div>
      </div>` : ""}
    ${d.why ? `
      <div class="field-block why">
        <div class="ti">Warum das funktioniert</div>
        <div class="bod">${escapeHTML(d.why)}</div>
      </div>` : ""}
    <div class="notes-block">
      <div class="ti">
        <span class="l">Meine Notiz zum Tag</span>
        <span class="saved" id="savedHint">Gespeichert ✓</span>
      </div>
      <textarea id="dayNote" placeholder="Was hast du beobachtet? Was war heute anders?">${escapeHTML(note)}</textarea>
    </div>
    <div class="day-actions">
      <button class="nav-btn" id="prevBtn" ${n === 1 ? "disabled" : ""}>← Zurück</button>
      <button class="complete-btn ${done ? "is-done" : ""}" id="completeBtn">
        ${done ? "✓ Erledigt — rückgängig" : "Als erledigt markieren"}
      </button>
      <button class="nav-btn" id="nextBtn" ${n === 21 ? "disabled" : ""}>Weiter →</button>
    </div>
  `;

  $("#dayOverlay").classList.add("open");
  document.body.style.overflow = "hidden";

  $("#dayNote").addEventListener("input", onNoteInput);
  $("#completeBtn").addEventListener("click", () => toggleComplete(n));
  if (!$("#prevBtn").disabled) $("#prevBtn").addEventListener("click", () => openDay(n - 1));
  if (!$("#nextBtn").disabled) $("#nextBtn").addEventListener("click", () => openDay(n + 1));

  $(".overlay").scrollTo({ top: 0, behavior: "instant" });
}

function closeDay() {
  $("#dayOverlay").classList.remove("open");
  document.body.style.overflow = "";
  state.currentDay = null;
}

function onNoteInput(e) {
  const n = state.currentDay;
  if (!n) return;
  state.notes[n] = e.target.value;
  if (state.saveTimer) clearTimeout(state.saveTimer);
  state.saveTimer = setTimeout(() => {
    saveState();
    const hint = $("#savedHint");
    if (hint) {
      hint.classList.add("show");
      setTimeout(() => hint.classList.remove("show"), 1400);
    }
  }, 350);
}

function toggleComplete(n) {
  if (state.completed.has(n)) state.completed.delete(n);
  else state.completed.add(n);
  saveState();
  renderProgress();
  renderWeeks();
  renderCompletion();
  if (state.currentDay === n) openDay(n);
}

function renderCompletion() {
  const mount = $("#completionMount");
  if (state.completed.size < 21) { mount.innerHTML = ""; return; }
  mount.innerHTML = `
    <div class="completion">
      <div class="emoji">🎉</div>
      <h2>Du hast alle 21 Tage geschafft.</h2>
      <p>
        Das ist <span class="serif">keine Kleinigkeit.</span><br>
        Gerade mit ADHS ist Durchhalten schwer — du hast dir 21 Mal bewusst Zeit für dich genommen.
        Dein Gehirn hat neue Wege kennengelernt.
      </p>
      <p style="font-size:14px">
        Schau dir deine Notizen an. Welche Tools haben dir am meisten geholfen?
        Die bleiben bei dir — auch nach diesen 21 Tagen.
      </p>
    </div>
  `;
}

function renderSOS() {
  $("#sosBody").innerHTML = SOS_TOOLS.map(t => `
    <div class="sos-item">
      <div class="head">
        <div class="name">${escapeHTML(t.name)}</div>
        <div class="page">S. ${t.page}</div>
      </div>
      <p class="desc">${escapeHTML(t.desc)}</p>
    </div>
  `).join("");
}
function openSOS() { $("#sosOverlay").classList.add("open"); document.body.style.overflow = "hidden"; }
function closeSOS() { $("#sosOverlay").classList.remove("open"); document.body.style.overflow = state.currentDay ? "hidden" : ""; }

function resetProgress() {
  if (!confirm("Wirklich allen Fortschritt und alle Notizen löschen? Das kann nicht rückgängig gemacht werden.")) return;
  state.completed.clear();
  state.notes = {};
  saveState();
  renderProgress(); renderWeeks(); renderCompletion();
}

function escapeHTML(str) {
  if (str == null) return "";
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function init() {
  loadState();
  renderSOS(); renderProgress(); renderWeeks(); renderCompletion();

  $("#sosOpen").addEventListener("click", openSOS);
  $("#sosClose").addEventListener("click", closeSOS);
  $("#sosCloseBtn").addEventListener("click", closeSOS);
  $("#dayClose").addEventListener("click", closeDay);
  $("#resetBtn").addEventListener("click", resetProgress);

  $("#dayOverlay").addEventListener("click", (e) => { if (e.target === $("#dayOverlay")) closeDay(); });
  $("#sosOverlay").addEventListener("click", (e) => { if (e.target === $("#sosOverlay")) closeSOS(); });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if ($("#sosOverlay").classList.contains("open")) closeSOS();
      else if ($("#dayOverlay").classList.contains("open")) closeDay();
    }
    if ($("#dayOverlay").classList.contains("open")) {
      if (e.key === "ArrowLeft" && state.currentDay > 1) openDay(state.currentDay - 1);
      if (e.key === "ArrowRight" && state.currentDay < 21) openDay(state.currentDay + 1);
    }
  });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
else init();
