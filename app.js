/* ═══════════════════════════════════════════
   Symetri BIM Summit – AI Workshop 2026
   ═══════════════════════════════════════════ */

const STORAGE_KEY = "symetri_workshop_state_v3";
const STORAGE_TTL_MS = 1000 * 60 * 60 * 24 * 14;

const state = {
  score: 0,
  solved: { 1: false, 2: false },
  hintsUsed: { 1: false, 2: false },
  subtasks: { 1: { a: true, b: true }, 2: { a: false, b: false } },
  updatedAt: 0,
};

const hints = {
  1: "Use this prompt and upload both files: \"I have attached a site inspection report and an architectural floor plan. The floor plan labels are in Chinese. Identify every room that has a critical defect in the report, then find the matching room on the floor plan and give me its number. List only the critical rooms and their numbers — nothing else.\"",
  2: "Extract only room IDs from notes, remove duplicates, then sort ascending.",
};

/* ─── helpers ─── */
function normalize(v) {
  return (v || "").toUpperCase().replace(/\s+/g, "").replace(/_/g, "-");
}

function parseRoomNumbers(v) {
  return [...new Set((v || "").match(/\d{3}/g) || [])].map(Number).sort((a, b) => a - b);
}

/* ─── persistence ─── */
function saveProgress() {
  state.updatedAt = Date.now();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function resetState() {
  state.score = 0;
  state.solved = { 1: false, 2: false };
  state.hintsUsed = { 1: false, 2: false };
  state.subtasks = { 1: { a: true, b: true }, 2: { a: false, b: false } };
  state.updatedAt = Date.now();
}

function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const s = JSON.parse(raw);
    if (!s || typeof s !== "object") return;
    if (!s.updatedAt || Date.now() - s.updatedAt > STORAGE_TTL_MS) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    state.score = Number(s.score) || 0;
    state.solved = { 1: !!s.solved?.[1], 2: !!s.solved?.[2] };
    state.hintsUsed = { 1: !!s.hintsUsed?.[1], 2: !!s.hintsUsed?.[2] };
    state.subtasks = {
      1: { a: true, b: true },
      2: { a: !!s.subtasks?.[2]?.a, b: !!s.subtasks?.[2]?.b },
    };
    state.updatedAt = s.updatedAt;
  } catch { resetState(); }
}

/* ─── UI updates ─── */
function updateStatsUI() {
  const solved = Number(state.solved[1]) + Number(state.solved[2]);
  document.getElementById("progressText").textContent = `${solved} / 2`;
  document.getElementById("scoreText").textContent = String(state.score);

  const l2Nav = document.querySelector('.nav-item[data-target="level-2"]');
  if (state.solved[1]) {
    l2Nav.classList.remove("locked");
    l2Nav.querySelector(".nav-icon").textContent = "2";
  }
}

function updateSubtaskUI(level, key) {
  const frag = document.getElementById(`fragment${level}${key}`);
  if (frag) frag.classList.toggle("hidden", !state.subtasks[level][key]);

  const guide = document.getElementById(`codeGuide${level}`);
  if (!guide) return;
  const done = state.subtasks[level].a && state.subtasks[level].b;
  guide.textContent = done
    ? level === 1
      ? "Fragments revealed: combine them into the 6-digit code."
      : "Fragments complete — build code: IMPACT-201-305-402"
    : "Solve subtasks to reveal all code fragments.";
}

function renderSubtaskState() {
  [1, 2].forEach((l) => ["a", "b"].forEach((k) => updateSubtaskUI(l, k)));
}

function setSubtaskFeedback(level, key, ok, msg) {
  const el = document.getElementById(`subFeedback${level}${key}`);
  if (!el) return;
  el.textContent = msg;
  el.style.color = ok ? "#3fb950" : "#f85149";
}

function setFeedback(level, ok, msg) {
  const el = document.getElementById(`feedback${level}`);
  el.textContent = msg;
  el.classList.remove("ok", "bad");
  el.classList.add(ok ? "ok" : "bad");
}

/* ─── navigation ─── */
function showSection(id) {
  document.querySelectorAll(".view").forEach((s) => s.classList.toggle("hidden", s.id !== id));
  document.querySelectorAll(".nav-item").forEach((b) => b.classList.toggle("active", b.dataset.target === id));

  // toggle right-panel fact boxes
  document.querySelectorAll(".fact").forEach((f) => f.classList.toggle("visible", f.dataset.for === id));

  // close mobile sidebar
  document.getElementById("sidebar").classList.remove("open");
}

/* ─── validation ─── */
function validateSubtask(level, key, raw) {
  const v = normalize(raw);
  if (level === 1 && key === "a") {
    return v === "5" || v === "5F" || v === "5TH" || v === "FLOOR5" || v === "5THFLOOR";
  }
  if (level === 1 && key === "b") return Number(v) === 4;
  if (level === 2 && key === "a") {
    const r = parseRoomNumbers(raw);
    return r.length === 3 && [201, 305, 402].every((x, i) => x === r[i]);
  }
  if (level === 2 && key === "b") return Number(v) === 3;
  return false;
}

function validateFinal(level, raw) {
  const v = normalize(raw);
  if (level === 1) return v === "581114";
  const r = parseRoomNumbers(v);
  return r.length === 3 && [201, 305, 402].every((x, i) => x === r[i]) && v.includes("IMPACT");
}

/* ─── scoring ─── */
function unlockLevel(level) {
  if (!state.solved[level]) {
    state.score += 10;
    state.solved[level] = true;
  }
  if (level === 1) {
    const nav = document.querySelector('.nav-item[data-target="level-2"]');
    nav.classList.remove("locked");
    nav.querySelector(".nav-icon").textContent = "2";
  }
  updateStatsUI();
  saveProgress();
}

function useHint(level) {
  const el = document.getElementById(`hint${level}`);
  el.textContent = hints[level];
  el.classList.remove("hidden");
  if (!state.hintsUsed[level] && !state.solved[level]) {
    state.hintsUsed[level] = true;
    state.score -= 3;
    updateStatsUI();
    saveProgress();
  }
}

/* ─── actions ─── */
function checkSubtask(level, key) {
  if (level === 2 && !state.solved[1]) {
    setSubtaskFeedback(level, key, false, "Solve Task 1 first.");
    return;
  }
  const inputId = level === 1
    ? key === "a" ? "l1Sub1" : "l1Sub2"
    : key === "a" ? "l2Sub1" : "l2Sub2";
  const ok = validateSubtask(level, key, document.getElementById(inputId).value);
  if (ok) {
    state.subtasks[level][key] = true;
    setSubtaskFeedback(level, key, true, "Correct — fragment unlocked.");
  } else {
    setSubtaskFeedback(level, key, false, "Not correct yet.");
  }
  updateSubtaskUI(level, key);
  saveProgress();
}

function submitLevel(level) {
  if (!(state.subtasks[level].a && state.subtasks[level].b)) {
    setFeedback(level, false, "Complete both subtasks first.");
    return;
  }
  const answer = document.getElementById(`answer${level}`).value;
  if (!answer.trim()) { setFeedback(level, false, "Enter the unlock code."); return; }
  if (validateFinal(level, answer)) {
    unlockLevel(level);
    setFeedback(level, true,
      level === 1 ? "Correct — Task 2 unlocked!" : "Correct — Task 3 unlocked!");
    const nextBtn = document.getElementById(`nextTask${level}`);
    if (nextBtn) nextBtn.classList.remove("hidden");
  } else {
    setFeedback(level, false, "Not correct. Recheck fragments and format.");
  }
}

/* ─── Pyodide (client-side Python) ─── */
let pyodideReady = null;

function ensurePyodide() {
  if (pyodideReady) return pyodideReady;
  if (typeof loadPyodide !== "function") {
    return Promise.reject(new Error("Pyodide not loaded yet. Try again in a moment."));
  }
  pyodideReady = loadPyodide();
  return pyodideReady;
}

async function runPython(editorId, outputId) {
  const outEl = document.getElementById(outputId);
  const code = document.getElementById(editorId).value;
  outEl.textContent = "Loading Python…";
  try {
    const py = await ensurePyodide();
    py.setStdout({ batched: (t) => { outEl.textContent += t + "\n"; } });
    outEl.textContent = "";
    await py.runPythonAsync(code);
  } catch (err) {
    outEl.textContent = String(err);
  }
}

/* ─── event wiring ─── */
function attachEvents() {
  // Start button
  document.getElementById("startBtn").addEventListener("click", () => showSection("level-1"));

  // Left nav
  document.querySelectorAll(".nav-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.classList.contains("locked")) return;
      showSection(btn.dataset.target);
    });
  });

  // Subtask checks
  document.querySelectorAll("[data-check-subtask]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.checkSubtask;
      checkSubtask(Number(id[0]), id[1]);
    });
  });

  // Final submit
  document.querySelectorAll("[data-submit]").forEach((btn) => {
    btn.addEventListener("click", () => submitLevel(Number(btn.dataset.submit)));
  });

  // Hints
  document.querySelectorAll(".hint-btn").forEach((btn) => {
    btn.addEventListener("click", () => useHint(Number(btn.dataset.level)));
  });

  // Next-task buttons
  document.querySelectorAll(".btn-next").forEach((btn) => {
    btn.addEventListener("click", () => showSection(btn.dataset.next));
  });

  // Python runners
  document.querySelectorAll("[data-run-py]").forEach((btn) => {
    btn.addEventListener("click", () => runPython(btn.dataset.runPy, btn.dataset.output));
  });

  // Mobile menu toggle
  document.getElementById("menuToggle").addEventListener("click", () => {
    document.getElementById("sidebar").classList.toggle("open");
  });

  // Lightbox (floor plan expand)
  const lightbox = document.getElementById("lightbox");
  const thumb = document.getElementById("floorplanThumb");
  const lbClose = document.getElementById("lightboxClose");
  if (thumb && lightbox) {
    thumb.addEventListener("click", () => lightbox.classList.remove("hidden"));
    lbClose.addEventListener("click", () => lightbox.classList.add("hidden"));
    lightbox.addEventListener("click", (e) => {
      if (e.target === lightbox) lightbox.classList.add("hidden");
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !lightbox.classList.contains("hidden")) {
        lightbox.classList.add("hidden");
      }
    });
  }

  // Reset (requires admin code)
  document.getElementById("resetProgressBtn").addEventListener("click", () => {
    const code = prompt("Enter admin code to reset progress:");
    if (code !== "symadmin") return;

    resetState();
    localStorage.removeItem(STORAGE_KEY);

    [1, 2].forEach((l) => {
      ["a", "b"].forEach((k) => {
        setSubtaskFeedback(l, k, false, "");
        const frag = document.getElementById(`fragment${l}${k}`);
        if (frag) frag.classList.add("hidden");
      });
      document.getElementById(`hint${l}`).classList.add("hidden");
      const fb = document.getElementById(`feedback${l}`);
      fb.classList.remove("ok", "bad");
      fb.textContent = "";
      document.getElementById(`answer${l}`).value = "";
      const nextBtn = document.getElementById(`nextTask${l}`);
      if (nextBtn) nextBtn.classList.add("hidden");
    });
    ["l1Sub1", "l1Sub2", "l2Sub1", "l2Sub2"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });

    const l2Nav = document.querySelector('.nav-item[data-target="level-2"]');
    l2Nav.classList.add("locked");
    l2Nav.querySelector(".nav-icon").textContent = "2";

    renderSubtaskState();
    updateStatsUI();
    showSection("start");
  });
}

/* ─── init ─── */
function init() {
  loadProgress();
  renderSubtaskState();
  updateStatsUI();
  attachEvents();

  if (state.solved[2]) showSection("level-2");
  else if (state.solved[1]) showSection("level-1");
  else showSection("start");
}

init();
