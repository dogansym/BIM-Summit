/* ═══════════════════════════════════════════
   Symetri BIM Summit – AI Workshop 2026
   ═══════════════════════════════════════════ */

const STORAGE_KEY = "symetri_workshop_state_v3";
const STORAGE_TTL_MS = 1000 * 60 * 60 * 24 * 14;

const state = {
  score: 0,
  solved: { 1: false, 2: false },
  hintsUsed: { 1: false, 2: false },
  subtasks: { 1: { a: true, b: true }, 2: { a: false, b: false, c: false, d: false } },
  gates: { 2: false },
  updatedAt: 0,
};

const hints = {
  1: "Try to find the critical rooms in the report",
  2: "Ask AI to answer all questions at once by uploading the excel sheet or copy/paste",
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
  state.subtasks = { 1: { a: true, b: true }, 2: { a: false, b: false, c: false, d: false } };
  state.gates = { 2: false };
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
    const hasGateState = !!s.gates && typeof s.gates === "object";
    state.score = Number(s.score) || 0;
    state.solved = { 1: !!s.solved?.[1], 2: hasGateState ? !!s.solved?.[2] : false };
    state.hintsUsed = { 1: !!s.hintsUsed?.[1], 2: hasGateState ? !!s.hintsUsed?.[2] : false };
    state.subtasks = {
      1: { a: true, b: true },
      2: hasGateState
        ? {
            a: !!s.subtasks?.[2]?.a,
            b: !!s.subtasks?.[2]?.b,
            c: !!s.subtasks?.[2]?.c,
            d: !!s.subtasks?.[2]?.d,
          }
        : { a: false, b: false, c: false, d: false },
    };
    state.gates = { 2: !!s.gates?.[2] };
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

  const l3Nav = document.querySelector('.nav-item[data-target="level-3"]');
  if (state.solved[2] && l3Nav) {
    l3Nav.classList.remove("locked");
    l3Nav.querySelector(".nav-icon").textContent = "3";
  }

  updateHintButtonsUI();
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
    : "Solve the checks to reveal all code fragments.";
}

function renderSubtaskState() {
  Object.entries({ 1: ["a", "b"], 2: ["a", "b", "c", "d"] }).forEach(([level, keys]) => {
    keys.forEach((key) => updateSubtaskUI(Number(level), key));
  });
  renderTask2CheckState();
}

function setSubtaskFeedback(level, key, ok, msg) {
  const el = document.getElementById(`subFeedback${level}${key}`);
  if (!el) return;
  el.textContent = msg;
  el.style.color = ok ? "#3fb950" : "#f85149";
}

function getTask2SuccessMessage(key) {
  if (key === "a") return "15 individual job rows";
  if (key === "b") return "Room 8 – Kitchen (92,300 CNY)";
  if (key === "c") return "Room: 14 — Main Entrance (入口)";
  if (key === "d") return "Kitchen – Waterproofing: gap 48";
  return "Correct";
}

function setFeedback(level, ok, msg) {
  const el = document.getElementById(`feedback${level}`);
  el.textContent = msg;
  el.classList.remove("ok", "bad");
  el.classList.add(ok ? "ok" : "bad");
}

function updateHintButtonsUI() {
  document.querySelectorAll(".hint-btn").forEach((btn) => {
    const level = Number(btn.dataset.level);
    const locked = !!state.solved[level];
    btn.dataset.defaultLabel = btn.dataset.defaultLabel || btn.textContent.trim();
    btn.disabled = locked;
    btn.setAttribute("aria-disabled", locked ? "true" : "false");
    btn.title = locked
      ? "Hint unavailable after this task is solved."
      : "Reveal a hint for this task.";
    btn.textContent = locked ? "Hint locked" : btn.dataset.defaultLabel;
  });
}

function renderTaskEstimates() {
  document.querySelectorAll('.view[id^="level-"]').forEach((section) => {
    const host = section.querySelector(".task-estimate");
    if (!host) return;

    const withoutAI = section.dataset.timeWithoutAi?.trim();
    const withAI = section.dataset.timeWithAi?.trim();
    if (!withoutAI || !withAI) {
      host.hidden = true;
      host.replaceChildren();
      return;
    }

    const kicker = document.createElement("span");
    kicker.className = "task-estimate-kicker";
    kicker.textContent = "Estimated time";

    const grid = document.createElement("div");
    grid.className = "task-estimate-grid";

    [
      { label: "Without AI", value: withoutAI, className: "" },
      { label: "With AI", value: withAI, className: " task-estimate-item-ai" },
    ].forEach(({ label, value, className }) => {
      const row = document.createElement("div");
      row.className = `task-estimate-item${className}`;

      const rowLabel = document.createElement("span");
      rowLabel.textContent = label;

      const rowValue = document.createElement("strong");
      rowValue.textContent = value;

      row.append(rowLabel, rowValue);
      grid.append(row);
    });

    host.replaceChildren(kicker, grid);
    host.hidden = false;
  });
}

function getGateAnswer(level) {
  return Number(document.getElementById(`level-${level}`)?.dataset.gateAnswer);
}

function setGateFeedback(level, ok, msg) {
  const el = document.getElementById(`gateFeedback${level}`);
  if (!el) return;
  el.textContent = msg;
  el.classList.remove("ok", "bad");
  if (msg) el.classList.add(ok ? "ok" : "bad");
}

function renderGateState(level) {
  const answer = getGateAnswer(level);
  if (!answer) return;

  const open = !!state.gates[level];
  const content = document.getElementById(`task${level}UnlockedContent`);
  if (content) content.classList.toggle("hidden", !open);

  const feedback = document.getElementById(`gateFeedback${level}`);
  if (open && feedback && !feedback.textContent.trim()) {
    setGateFeedback(level, true, `Correct — Room ${answer} opens the gate.`);
  }

  document.querySelectorAll(`[data-gate-level="${level}"]`).forEach((btn) => {
    const room = Number(btn.dataset.gateRoom);
    btn.disabled = open;
    btn.classList.toggle("is-correct", open && room === answer);
    if (open) btn.classList.remove("is-wrong");
  });
}

function renderGateStates() {
  document.querySelectorAll('.view[data-gate-answer]').forEach((section) => {
    const level = Number(section.id.split("-")[1]);
    if (level) renderGateState(level);
  });
}

function renderTask2CheckState() {
  ["a", "b", "c", "d"].forEach((key) => {
    if (state.subtasks[2][key]) {
      setSubtaskFeedback(2, key, true, getTask2SuccessMessage(key));
    }
  });

  const roomButtons = document.querySelectorAll('[data-choice-subtask="2b"]');
  roomButtons.forEach((btn) => {
    const isCorrect = btn.dataset.choiceValue === "8";
    btn.classList.toggle("is-correct", state.subtasks[2].b && isCorrect);
    if (!state.subtasks[2].b) btn.classList.remove("is-correct");
    btn.classList.remove("is-wrong");
    btn.disabled = state.subtasks[2].b;
  });

  const roomInput = document.getElementById("l2Sub2");
  if (roomInput && state.subtasks[2].b) roomInput.value = "8";

  renderTask2CompletionState();
}

function chooseTask2Room(value) {
  const input = document.getElementById("l2Sub2");
  if (input) input.value = value;

  const buttons = [...document.querySelectorAll('[data-choice-subtask="2b"]')];
  buttons.forEach((btn) => {
    const selected = btn.dataset.choiceValue === String(value);
    btn.classList.toggle("is-wrong", selected && String(value) !== "8");
  });

  checkSubtask(2, "b");
}

function renderTask2CompletionState() {
  const allDone = ["a", "b", "c", "d"].every((key) => state.subtasks[2][key]);
  const nextBtn = document.getElementById("nextTask2");

  if (allDone && !state.solved[2]) {
    unlockLevel(2);
  }

  if (state.solved[2]) {
    setFeedback(2, true, "Correct — you've solved this task! Task 3 is unlocked.");
    if (nextBtn) nextBtn.classList.remove("hidden");
  } else if (nextBtn) {
    nextBtn.classList.add("hidden");
  }
}

function tryGate(level, room) {
  const answer = getGateAnswer(level);
  if (!answer || state.gates[level]) return;

  const buttons = [...document.querySelectorAll(`[data-gate-level="${level}"]`)];
  buttons.forEach((btn) => btn.classList.remove("is-wrong"));

  const chosen = buttons.find((btn) => Number(btn.dataset.gateRoom) === room);
  if (room === answer) {
    state.gates[level] = true;
    setGateFeedback(level, true, `Correct — Room ${room} opens the gate.`);
    renderGateState(level);
    saveProgress();
    return;
  }

  if (chosen) chosen.classList.add("is-wrong");
  setGateFeedback(level, false, "That room does not open the gate. Read the riddle again.");
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
  if (level === 2 && key === "a") return Number(v) === 15;
  if (level === 2 && key === "b") return Number(v) === 8;
  if (level === 2 && key === "c") return Number(v) === 14;
  if (level === 2 && key === "d") return Number(v) === 48;
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
  if (level === 2) {
    const nav = document.querySelector('.nav-item[data-target="level-3"]');
    if (nav) {
      nav.classList.remove("locked");
      nav.querySelector(".nav-icon").textContent = "3";
    }
  }
  updateStatsUI();
  saveProgress();
}

function useHint(level) {
  if (state.solved[level]) return;
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
  const inputIds = {
    1: { a: "l1Sub1", b: "l1Sub2" },
    2: { a: "l2Sub1", b: "l2Sub2", c: "l2Sub3", d: "l2Sub4" },
  };
  const inputId = inputIds[level]?.[key];
  if (!inputId) return;
  const ok = validateSubtask(level, key, document.getElementById(inputId).value);
  if (ok) {
    state.subtasks[level][key] = true;
    setSubtaskFeedback(
      level,
      key,
      true,
      level === 2 ? getTask2SuccessMessage(key) : "Correct — fragment unlocked.",
    );
  } else {
    setSubtaskFeedback(
      level,
      key,
      false,
      level === 2 ? "Not correct yet. Recheck the quote data." : "Not correct yet.",
    );
  }
  updateSubtaskUI(level, key);
  if (level === 2) renderTask2CheckState();
  saveProgress();
}

function submitLevel(level) {
  if (!(state.subtasks[level].a && state.subtasks[level].b)) {
    setFeedback(level, false, "Complete both checks first.");
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

  // Gate choices
  document.querySelectorAll("[data-gate-room]").forEach((btn) => {
    btn.addEventListener("click", () => {
      tryGate(Number(btn.dataset.gateLevel), Number(btn.dataset.gateRoom));
    });
  });

  // Task 2 room choices
  document.querySelectorAll("[data-choice-subtask]").forEach((btn) => {
    btn.addEventListener("click", () => {
      chooseTask2Room(btn.dataset.choiceValue);
    });
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

    Object.entries({ 1: ["a", "b"], 2: ["a", "b", "c", "d"] }).forEach(([level, keys]) => {
      const l = Number(level);
      keys.forEach((k) => {
        setSubtaskFeedback(l, k, false, "");
        const frag = document.getElementById(`fragment${l}${k}`);
        if (frag) frag.classList.add("hidden");
      });
      const hint = document.getElementById(`hint${l}`);
      if (hint) hint.classList.add("hidden");
      const fb = document.getElementById(`feedback${l}`);
      if (fb) {
        fb.classList.remove("ok", "bad");
        fb.textContent = "";
      }
      const answer = document.getElementById(`answer${l}`);
      if (answer) answer.value = "";
      const nextBtn = document.getElementById(`nextTask${l}`);
      if (nextBtn) nextBtn.classList.add("hidden");
    });
    ["l1Sub1", "l1Sub2", "l2Sub1", "l2Sub2", "l2Sub3", "l2Sub4"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });

    const gateFeedback = document.getElementById("gateFeedback2");
    if (gateFeedback) {
      gateFeedback.classList.remove("ok", "bad");
      gateFeedback.textContent = "";
    }
    document.querySelectorAll('[data-gate-level="2"]').forEach((btn) => {
      btn.classList.remove("is-correct", "is-wrong");
    });
    document.querySelectorAll('[data-choice-subtask="2b"]').forEach((btn) => {
      btn.classList.remove("is-correct", "is-wrong");
      btn.disabled = false;
    });

    const l2Nav = document.querySelector('.nav-item[data-target="level-2"]');
    l2Nav.classList.add("locked");
    l2Nav.querySelector(".nav-icon").textContent = "2";

    renderSubtaskState();
    renderGateStates();
    updateStatsUI();
    showSection("start");
  });
}

/* ─── init ─── */
function init() {
  loadProgress();
  renderTaskEstimates();
  renderSubtaskState();
  renderGateStates();
  updateStatsUI();
  attachEvents();

  if (state.solved[2]) showSection("level-2");
  else if (state.solved[1]) showSection("level-1");
  else showSection("start");
}

init();
