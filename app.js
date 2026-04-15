const STORAGE_KEY = "symetri_workshop_state_v2";
const STORAGE_TTL_MS = 1000 * 60 * 60 * 24 * 14;

const state = {
  score: 0,
  solved: { 1: false, 2: false },
  hintsUsed: { 1: false, 2: false },
  subtasks: {
    1: { a: false, b: false },
    2: { a: false, b: false },
  },
  updatedAt: 0,
};

const hints = {
  1: "Count rooms first, then sum areas: 24 + 18 + 6.",
  2: "Extract only room IDs from notes, remove duplicates, then sort ascending.",
};

function normalize(value) {
  return (value || "").toUpperCase().replace(/\s+/g, "").replace(/_/g, "-");
}

function parseRoomNumbers(input) {
  const matches = (input || "").match(/\d{3}/g) || [];
  return [...new Set(matches)].map(Number).sort((a, b) => a - b);
}

function saveProgress() {
  state.updatedAt = Date.now();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function resetState() {
  state.score = 0;
  state.solved = { 1: false, 2: false };
  state.hintsUsed = { 1: false, 2: false };
  state.subtasks = {
    1: { a: false, b: false },
    2: { a: false, b: false },
  };
  state.updatedAt = Date.now();
}

function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    const saved = JSON.parse(raw);
    if (!saved || typeof saved !== "object") return;

    if (!saved.updatedAt || Date.now() - saved.updatedAt > STORAGE_TTL_MS) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }

    state.score = Number(saved.score) || 0;
    state.solved = {
      1: !!saved?.solved?.[1],
      2: !!saved?.solved?.[2],
    };
    state.hintsUsed = {
      1: !!saved?.hintsUsed?.[1],
      2: !!saved?.hintsUsed?.[2],
    };
    state.subtasks = {
      1: {
        a: !!saved?.subtasks?.[1]?.a,
        b: !!saved?.subtasks?.[1]?.b,
      },
      2: {
        a: !!saved?.subtasks?.[2]?.a,
        b: !!saved?.subtasks?.[2]?.b,
      },
    };
    state.updatedAt = saved.updatedAt;
  } catch {
    resetState();
  }
}

function updateStatsUI() {
  const solvedCount = Number(state.solved[1]) + Number(state.solved[2]);
  document.getElementById("progressText").textContent = `${solvedCount} / 2`;
  document.getElementById("scoreText").textContent = String(state.score);

  const level2Tab = document.querySelector('.tab[data-target="level-2"]');
  level2Tab.disabled = !state.solved[1];

  if (state.solved[1]) document.getElementById("workflow1").classList.remove("hidden");
  if (state.solved[2]) document.getElementById("workflow2").classList.remove("hidden");
}

function updateSubtaskUI(level, key) {
  const isDone = state.subtasks[level][key];
  const fragmentEl = document.getElementById(`fragment${level}${key}`);
  if (fragmentEl) {
    fragmentEl.classList.toggle("hidden", !isDone);
  }

  const allDone = state.subtasks[level].a && state.subtasks[level].b;
  const guide = document.getElementById(`codeGuide${level}`);

  if (!guide) return;

  if (!allDone) {
    guide.textContent = "Solve subtasks to reveal all code fragments.";
    return;
  }

  guide.textContent = level === 1
    ? "Fragments complete. Build final code: RC3-TA48"
    : "Fragments complete. Build final code: IMPACT-201-305-402";
}

function renderSubtaskState() {
  [1, 2].forEach((level) => {
    ["a", "b"].forEach((key) => {
      updateSubtaskUI(level, key);
    });
  });
}

function setSubtaskFeedback(level, key, ok, message) {
  const el = document.getElementById(`subFeedback${level}${key}`);
  if (!el) return;
  el.textContent = message;
  el.style.color = ok ? "#047857" : "#b91c1c";
}

function setFeedback(level, ok, message) {
  const el = document.getElementById(`feedback${level}`);
  el.textContent = message;
  el.classList.remove("ok", "bad");
  el.classList.add(ok ? "ok" : "bad");
}

function showSection(sectionId) {
  ["start", "level-1", "level-2"].forEach((id) => {
    document.getElementById(id).classList.toggle("hidden", id !== sectionId);
  });

  document.querySelectorAll(".tab").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.target === sectionId);
  });
}

function validateSubtask(level, key, rawInput) {
  const input = normalize(rawInput);

  if (level === 1 && key === "a") {
    return Number(input) === 3;
  }

  if (level === 1 && key === "b") {
    return Number(input) === 48;
  }

  if (level === 2 && key === "a") {
    const expected = [201, 305, 402];
    const rooms = parseRoomNumbers(rawInput);
    return rooms.length === 3 && expected.every((x, i) => x === rooms[i]);
  }

  if (level === 2 && key === "b") {
    return Number(input) === 3;
  }

  return false;
}

function allSubtasksDone(level) {
  return state.subtasks[level].a && state.subtasks[level].b;
}

function validateFinal(level, rawInput) {
  const input = normalize(rawInput);

  if (level === 1) {
    const compact = input.replace(/-/g, "");
    return compact === "RC3TA48";
  }

  const rooms = parseRoomNumbers(input);
  const expected = [201, 305, 402];
  const sameRooms = rooms.length === 3 && expected.every((value, index) => value === rooms[index]);
  return sameRooms && input.includes("IMPACT");
}

function awardTaskPoints(level) {
  if (state.solved[level]) return;
  state.score += 10;
}

function useHint(level) {
  const hintEl = document.getElementById(`hint${level}`);
  hintEl.textContent = hints[level];
  hintEl.classList.remove("hidden");

  if (!state.hintsUsed[level] && !state.solved[level]) {
    state.hintsUsed[level] = true;
    state.score = Math.max(0, state.score - 3);
    updateStatsUI();
    saveProgress();
  }
}

function unlockLevel(level) {
  if (!state.solved[level]) {
    awardTaskPoints(level);
    state.solved[level] = true;
  }

  document.getElementById(`workflow${level}`).classList.remove("hidden");

  if (level === 1) {
    document.querySelector('.tab[data-target="level-2"]').disabled = false;
  }

  updateStatsUI();
  saveProgress();
}

function submitLevel(level) {
  const answer = document.getElementById(`answer${level}`).value;

  if (!allSubtasksDone(level)) {
    setFeedback(level, false, "Complete both subtasks first to assemble the code.");
    return;
  }

  if (!answer.trim()) {
    setFeedback(level, false, "Enter final unlock code.");
    return;
  }

  if (validateFinal(level, answer)) {
    unlockLevel(level);
    setFeedback(
      level,
      true,
      level === 1
        ? "Correct. Task 1 unlocked. Structured extraction complete."
        : "Correct. Task 2 unlocked. Coordination triage complete."
    );

    if (level === 1) showSection("level-2");
  } else {
    setFeedback(level, false, "Code is not correct yet. Recheck fragments and format.");
  }
}

function checkSubtask(level, key) {
  if (level === 2 && !state.solved[1]) {
    setSubtaskFeedback(level, key, false, "Task 2 is locked. Solve Task 1 first.");
    return;
  }

  const inputId = level === 1
    ? key === "a" ? "l1Sub1" : "l1Sub2"
    : key === "a" ? "l2Sub1" : "l2Sub2";

  const value = document.getElementById(inputId).value;
  const ok = validateSubtask(level, key, value);

  if (ok) {
    state.subtasks[level][key] = true;
    setSubtaskFeedback(level, key, true, "Correct. Fragment unlocked.");
  } else {
    setSubtaskFeedback(level, key, false, "Not correct yet. Try again.");
  }

  updateSubtaskUI(level, key);
  saveProgress();
}

function attachEvents() {
  document.getElementById("startBtn").addEventListener("click", () => {
    showSection("level-1");
  });

  document.querySelectorAll(".tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.disabled) return;
      showSection(btn.dataset.target);
    });
  });

  document.querySelectorAll("[data-check-subtask]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.checkSubtask;
      const level = Number(id[0]);
      const key = id[1];
      checkSubtask(level, key);
    });
  });

  document.querySelectorAll("[data-submit]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const level = Number(btn.dataset.submit);
      submitLevel(level);
    });
  });

  document.querySelectorAll(".hint-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const level = Number(btn.dataset.level);
      useHint(level);
    });
  });

  document.getElementById("resetProgressBtn").addEventListener("click", () => {
    resetState();
    localStorage.removeItem(STORAGE_KEY);

    [1, 2].forEach((level) => {
      ["a", "b"].forEach((key) => {
        setSubtaskFeedback(level, key, false, "");
        document.getElementById(`fragment${level}${key}`).classList.add("hidden");
      });

      document.getElementById(`hint${level}`).classList.add("hidden");
      document.getElementById(`feedback${level}`).classList.remove("ok", "bad");
      document.getElementById(`feedback${level}`).textContent = "";
      document.getElementById(`workflow${level}`).classList.add("hidden");
      document.getElementById(`answer${level}`).value = "";
    });

    ["l1Sub1", "l1Sub2", "l2Sub1", "l2Sub2"].forEach((id) => {
      document.getElementById(id).value = "";
    });

    renderSubtaskState();
    updateStatsUI();
    showSection("start");
  });
}

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
