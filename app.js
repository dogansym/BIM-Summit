const STORAGE_KEY = "aeco_ai_workshop_progress_v1";

const state = {
  solved: {
    1: false,
    2: false,
  },
};

const hints = {
  1: "Count the number of rooms, then add their area values: 24 + 18 + 6.",
  2: "Extract only unique room numbers from issue text, ignore non-room items, then sort ascending.",
};

function normalize(value) {
  return (value || "")
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/_/g, "-");
}

function saveProgress() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.solved));
}

function loadProgress() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && typeof saved === "object") {
      state.solved[1] = !!saved[1];
      state.solved[2] = !!saved[2];
    }
  } catch {
    state.solved = { 1: false, 2: false };
  }
}

function updateProgressUI() {
  const solvedCount = Number(state.solved[1]) + Number(state.solved[2]);
  document.getElementById("progressText").textContent = `Progress: ${solvedCount} / 2 solved`;

  const level2Nav = document.querySelector('.nav-link[data-target="level-2"]');
  level2Nav.disabled = !state.solved[1];
  level2Nav.title = state.solved[1] ? "" : "Solve Level 1 to unlock";

  if (state.solved[1]) {
    document.getElementById("workflow1").classList.remove("hidden");
  }
  if (state.solved[2]) {
    document.getElementById("workflow2").classList.remove("hidden");
  }
}

function setFeedback(level, ok, message) {
  const el = document.getElementById(`feedback${level}`);
  el.textContent = message;
  el.classList.remove("ok", "bad");
  el.classList.add(ok ? "ok" : "bad");
}

function showSection(sectionId) {
  const sections = ["start", "level-1", "level-2"];
  sections.forEach((id) => {
    document.getElementById(id).classList.toggle("hidden", id !== sectionId);
  });

  document.querySelectorAll(".nav-link").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.target === sectionId);
  });
}

function parseRoomNumbers(input) {
  const matches = (input || "").match(/\d{3}/g) || [];
  return [...new Set(matches)].map(Number).sort((a, b) => a - b);
}

function validateLevel1(rawInput) {
  const input = normalize(rawInput);

  if (input.includes("RC3") && input.includes("TA48")) {
    return true;
  }

  const compact = input.replace(/-/g, "");
  return compact === "RC3TA48" || compact === "3ROOM48";
}

function validateLevel2(rawInput) {
  const normalized = normalize(rawInput);
  const rooms = parseRoomNumbers(normalized);
  const expected = [201, 305, 402];

  const sameRooms =
    rooms.length === expected.length &&
    expected.every((value, index) => rooms[index] === value);

  if (!sameRooms) {
    return false;
  }

  return normalized.includes("IMPACT") || /201\D*305\D*402/.test(normalized);
}

function unlockLevel(level) {
  state.solved[level] = true;
  saveProgress();
  updateProgressUI();

  document.getElementById(`workflow${level}`).classList.remove("hidden");

  if (level === 1) {
    const level2Nav = document.querySelector('.nav-link[data-target="level-2"]');
    level2Nav.disabled = false;
  }
}

function submitLevel(level) {
  const answer = document.getElementById(`answer${level}`).value;

  if (!answer.trim()) {
    setFeedback(level, false, "Please enter an answer first.");
    return;
  }

  const isValid = level === 1 ? validateLevel1(answer) : validateLevel2(answer);

  if (isValid) {
    unlockLevel(level);
    setFeedback(
      level,
      true,
      level === 1
        ? "Correct. You transformed unstructured drawing notes into structured data."
        : "Correct. You isolated affected rooms and formed a reliable impact code."
    );

    if (level === 1) {
      showSection("level-2");
    }
  } else {
    setFeedback(level, false, "Not quite. Re-check the scenario and formatting hints.");
  }
}

function attachEvents() {
  document.getElementById("startBtn").addEventListener("click", () => {
    showSection("level-1");
  });

  document.querySelectorAll(".nav-link").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.disabled) {
        return;
      }
      showSection(btn.dataset.target);
    });
  });

  document.querySelectorAll("[data-submit]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const level = Number(btn.dataset.submit);
      if (level === 2 && !state.solved[1]) {
        setFeedback(2, false, "Level 2 is locked. Solve Level 1 first.");
        return;
      }
      submitLevel(level);
    });
  });

  document.querySelectorAll(".hint-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const level = Number(btn.dataset.level);
      const hintEl = document.getElementById(`hint${level}`);
      hintEl.textContent = hints[level];
      hintEl.classList.remove("hidden");
    });
  });

  document.getElementById("resetProgressBtn").addEventListener("click", () => {
    state.solved[1] = false;
    state.solved[2] = false;

    [1, 2].forEach((level) => {
      document.getElementById(`workflow${level}`).classList.add("hidden");
      document.getElementById(`feedback${level}`).textContent = "";
      document.getElementById(`feedback${level}`).classList.remove("ok", "bad");
      document.getElementById(`hint${level}`).classList.add("hidden");
      document.getElementById(`answer${level}`).value = "";
    });

    saveProgress();
    updateProgressUI();
    showSection("start");
  });
}

function init() {
  loadProgress();
  updateProgressUI();
  attachEvents();

  if (state.solved[2]) {
    showSection("level-2");
  } else if (state.solved[1]) {
    showSection("level-1");
  } else {
    showSection("start");
  }
}

init();
