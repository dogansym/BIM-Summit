/* ═══════════════════════════════════════════
   Symetri BIM Summit – AI Workshop 2026
   ═══════════════════════════════════════════ */

const STORAGE_KEY = "symetri_workshop_state_v3";
const STORAGE_TTL_MS = 1000 * 60 * 60 * 24 * 14;

const state = {
  score: 0,
  solved: { 1: false, 2: false, 3: false, 4: false },
  hintsUsed: { 1: false, 2: false, 3: false, 4: false },
  subtasks: {
    1: { a: true, b: true },
    2: { a: false, b: false, c: false, d: false },
    3: { a: false, b: false, c: false, d: false },
  },
  audits: { 3: false },
  gates: { 2: false, 4: false },
  task4: { decoded: { 1: false, 2: false, 3: false, 4: false, 5: false, 6: false } },
  updatedAt: 0,
};

const hints = {
  1: "Try to find the critical rooms in the report",
  2: "Ask AI to answer all questions at once by uploading the excel sheet or copy/paste",
  3: "I am building a Cost Agent. I have provided the Contractor's Quotes and the Approved Budget for four rooms. Write a compact Python script that stores these two datasets, calculates the overcharge (Contractor - Approved) for each room, and allows a user to input a room number to see the specific overcharge for that room. If the room is not found, print 'No overcharge detected'.",
  4: "Decode the assignees first. Then look for the person tied to both Kitchen and Main Entrance, and compare that with the 02:47 low-confidence log entry.",
};

const TASK3_ROOM_OVERCHARGES = {
  5: 8800,
  8: 26080,
  11: 8360,
  14: 24480,
};

const TASK4_GATE_ANSWER = "A-2";
const TASK4_DECODE_ANSWERS = {
  1: "VIKTOR",
  2: "MARCUS",
  3: "LENA",
  4: "OMAR",
  5: "YUKI",
  6: "SARA",
};
const TASK4_ISSUES = [
  { id: "IFS-001", location: "Workshop", type: "Safety · PPE", assignee: "VIKTOR", confidence: 94 },
  { id: "IFS-002", location: "Courtyard", type: "Access", assignee: "MARCUS", confidence: 87 },
  { id: "IFS-003", location: "Entrance corridor", type: "Safety · PPE", assignee: "LENA", confidence: 91 },
  { id: "IFS-004", location: "Exterior grounds", type: "Hazard", assignee: "OMAR", confidence: 68 },
  { id: "IFS-005", location: "Rooftop", type: "Fire", assignee: "YUKI", confidence: 82 },
  { id: "IFS-006", location: "Main Entrance", type: "Safety · PPE", assignee: "VIKTOR", confidence: 96 },
  { id: "IFS-007", location: "Courtyard", type: "Access", assignee: "SARA", confidence: 89 },
  { id: "IFS-008", location: "Construction yard", type: "Safety · PPE", assignee: "MARCUS", confidence: 65 },
  { id: "IFS-009", location: "Kitchen", type: "Hazard", assignee: "VIKTOR", confidence: 34 },
  { id: "IFS-010", location: "Rooftop", type: "Structural", assignee: "YUKI", confidence: 91 },
];

/* ─── helpers ─── */
function normalize(v) {
  return (v || "").toUpperCase().replace(/\s+/g, "").replace(/_/g, "-");
}

function normalizeNameToken(v) {
  return String(v || "").toUpperCase().replace(/[^A-Z]/g, "");
}

function parseRoomNumbers(v) {
  return [...new Set((v || "").match(/\d{3}/g) || [])].map(Number).sort((a, b) => a - b);
}

function emptyTask4Decoded() {
  return { 1: false, 2: false, 3: false, 4: false, 5: false, 6: false };
}

/* ─── persistence ─── */
function saveProgress() {
  state.updatedAt = Date.now();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function resetState() {
  state.score = 0;
  state.solved = { 1: false, 2: false, 3: false, 4: false };
  state.hintsUsed = { 1: false, 2: false, 3: false, 4: false };
  state.subtasks = {
    1: { a: true, b: true },
    2: { a: false, b: false, c: false, d: false },
    3: { a: false, b: false, c: false, d: false },
  };
  state.audits = { 3: false };
  state.gates = { 2: false, 4: false };
  state.task4 = { decoded: emptyTask4Decoded() };
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
    const hasAuditState = !!s.audits && typeof s.audits === "object";
    state.score = Number(s.score) || 0;
    state.solved = {
      1: !!s.solved?.[1],
      2: hasGateState ? !!s.solved?.[2] : false,
      3: hasAuditState ? !!s.solved?.[3] : false,
      4: !!s.solved?.[4],
    };
    state.hintsUsed = {
      1: !!s.hintsUsed?.[1],
      2: hasGateState ? !!s.hintsUsed?.[2] : false,
      3: !!s.hintsUsed?.[3],
      4: !!s.hintsUsed?.[4],
    };
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
      3: {
        a: !!s.subtasks?.[3]?.a,
        b: !!s.subtasks?.[3]?.b,
        c: !!s.subtasks?.[3]?.c,
        d: !!s.subtasks?.[3]?.d,
      },
    };
    state.audits = { 3: hasAuditState ? !!s.audits?.[3] : false };
    state.gates = { 2: !!s.gates?.[2], 4: !!s.gates?.[4] };
    state.task4 = {
      decoded: {
        1: !!s.task4?.decoded?.[1],
        2: !!s.task4?.decoded?.[2],
        3: !!s.task4?.decoded?.[3],
        4: !!s.task4?.decoded?.[4],
        5: !!s.task4?.decoded?.[5],
        6: !!s.task4?.decoded?.[6],
      },
    };
    state.score =
      (Number(state.solved[1]) + Number(state.solved[2]) + Number(state.solved[3]) + Number(state.solved[4])) * 10
      - (Number(state.hintsUsed[1]) + Number(state.hintsUsed[2]) + Number(state.hintsUsed[3]) + Number(state.hintsUsed[4])) * 3;
    state.updatedAt = s.updatedAt;
  } catch { resetState(); }
}

/* ─── UI updates ─── */
function updateStatsUI() {
  const solved = Number(state.solved[1]) + Number(state.solved[2]) + Number(state.solved[3]) + Number(state.solved[4]);
  document.getElementById("progressText").textContent = `${solved} / 4`;
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

  const l4Nav = document.querySelector('.nav-item[data-target="level-4"]');
  if (state.solved[3] && l4Nav) {
    l4Nav.classList.remove("locked");
    l4Nav.querySelector(".nav-icon").textContent = "4";
  }

  updateHintButtonsUI();
}

function updateSubtaskUI(level, key) {
  const frag = document.getElementById(`fragment${level}${key}`);
  if (frag) frag.classList.toggle("hidden", !state.subtasks[level][key]);

  const guide = document.getElementById(`codeGuide${level}`);
  if (!guide) return;
  const done = Object.values(state.subtasks[level]).every(Boolean);
  guide.textContent = done
    ? level === 1
      ? "Fragments revealed: combine them into the 6-digit code."
      : level === 2
        ? "Quote audit complete — Task 2 is ready."
        : "Protocol Stack online — the Cost Agent is live."
    : level === 3
      ? "Unlock Box 1-3, then compile your agent to bring the console online."
      : "Solve the checks to reveal all code fragments.";
}

function renderSubtaskState() {
  Object.entries({ 1: ["a", "b"], 2: ["a", "b", "c", "d"], 3: ["a", "b", "c", "d"] }).forEach(([level, keys]) => {
    keys.forEach((key) => updateSubtaskUI(Number(level), key));
  });
  renderTask2CheckState();
  renderTask3CheckState();
  renderTask4DecodeState();
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

function getTask3SuccessMessage(key) {
  if (key === "a") return "Correct — the path forms the letter N.";
  if (key === "b") return "Correct — 1989 in binary is 11111000101.";
  if (key === "c") return "Correct — the Main Entrance, Room 14, is the target.";
  if (key === "d") return "Correct — your agent compiles and the live prompt console is unlocked.";
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
  renderTask4GateState();
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

function renderTask3CheckState() {
  ["a", "b", "c", "d"].forEach((key) => {
    if (state.subtasks[3][key]) {
      setSubtaskFeedback(3, key, true, getTask3SuccessMessage(key));
    }
  });

  const prerequisitesReady = state.subtasks[3].a && state.subtasks[3].b && state.subtasks[3].c;
  const compileBtn = document.getElementById("compileAgent3");
  if (compileBtn) compileBtn.disabled = !prerequisitesReady;

  const agentStatus = document.getElementById("agentStatus3");
  if (agentStatus) {
    agentStatus.classList.toggle("is-ready", state.subtasks[3].d);
    agentStatus.textContent = state.subtasks[3].d
      ? "Green light: the Cost Agent compiled successfully. Test it below with room numbers."
      : prerequisitesReady
        ? "All datasets are unlocked. Compile the Python agent to activate the prompt console."
        : "Unlock Box 1-3 first, then compile the agent to bring the prompt console online.";
  }

  const agentConsole = document.getElementById("agentConsole3");
  if (agentConsole) agentConsole.classList.toggle("hidden", !state.subtasks[3].d);

  renderTask3AuditInputs();
  updateTask3StackDiagram();
  renderTask3CompletionState();
}

function renderTask3AuditInputs() {
  Object.entries(TASK3_ROOM_OVERCHARGES).forEach(([room, amount]) => {
    const input = document.getElementById(`l3Room${room}`);
    if (!input) return;
    if (state.audits[3]) input.value = String(amount);
  });
}

function updateTask3StackDiagram() {
  const prerequisitesReady = state.subtasks[3].a && state.subtasks[3].b && state.subtasks[3].c;
  const nodeMap = {
    "3a": state.subtasks[3].a,
    "3b": state.subtasks[3].b,
    "3c": state.subtasks[3].c,
    "3run": prerequisitesReady,
    "3d": state.subtasks[3].d,
  };

  Object.entries(nodeMap).forEach(([nodeId, unlocked]) => {
    const node = document.querySelector(`[data-stack-node="${nodeId}"]`);
    if (!node) return;
    node.classList.toggle("is-unlocked", unlocked && nodeId !== "3d");
    node.classList.toggle("is-ready", nodeId === "3run" && unlocked && !state.subtasks[3].d);
    node.classList.toggle("is-complete", nodeId === "3d" && unlocked);
  });

  const labels = {
    "3a": state.subtasks[3].a ? "Unlocked" : "Locked",
    "3b": state.subtasks[3].b ? "Unlocked" : "Locked",
    "3c": state.subtasks[3].c ? "Unlocked" : "Locked",
    "3run": state.subtasks[3].a && state.subtasks[3].b && state.subtasks[3].c
      ? state.subtasks[3].d ? "Executed" : "Ready"
      : "Waiting",
    "3d": state.subtasks[3].d ? "Online" : "Locked",
  };

  Object.entries(labels).forEach(([nodeId, label]) => {
    const stateEl = document.querySelector(`[data-stack-state="${nodeId}"]`);
    if (stateEl) stateEl.textContent = label;
  });

  const laneStates = {
    top: state.subtasks[3].a,
    left: state.subtasks[3].b,
    center: state.subtasks[3].c,
    right: prerequisitesReady,
    bottom: prerequisitesReady,
    output: state.subtasks[3].d,
  };

  Object.entries(laneStates).forEach(([laneId, active]) => {
    const lane = document.querySelector(`[data-stack-lane="${laneId}"]`);
    if (!lane) return;
    lane.classList.toggle("is-active", active);
    lane.classList.toggle("is-ready", laneId === "bottom" && prerequisitesReady && !state.subtasks[3].d);
  });
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

function renderTask3CompletionState() {
  const allDone = ["a", "b", "c", "d"].every((key) => state.subtasks[3][key]) && state.audits[3];
  const nextBtn = document.getElementById("nextTask3");

  if (allDone && !state.solved[3]) {
    unlockLevel(3);
  }

  if (state.solved[3]) {
    setFeedback(3, true, "Correct — the Cost Agent is compiled and all four room overcharges are logged.");
    if (nextBtn) nextBtn.classList.remove("hidden");
  } else if (nextBtn) {
    nextBtn.classList.add("hidden");
  }
}

function setDecodeFeedback(index, ok, msg) {
  const el = document.getElementById(`decodeFeedback4${index}`);
  if (!el) return;
  el.textContent = msg;
  el.style.color = ok ? "#3fb950" : msg ? "#f0c66e" : "";
}

function getTask4DecodedCount() {
  return Object.values(state.task4.decoded).filter(Boolean).length;
}

function renderTask4GateState() {
  const open = !!state.gates[4];
  const content = document.getElementById("task4UnlockedContent");
  const input = document.getElementById("gateInput4");
  const button = document.querySelector('[data-check-gate-text="4"]');

  if (content) content.classList.toggle("hidden", !open);
  if (input) {
    if (open) input.value = TASK4_GATE_ANSWER;
    input.disabled = open;
  }
  if (button) button.disabled = open;

  const feedback = document.getElementById("gateFeedback4");
  if (open && feedback && !feedback.textContent.trim()) {
    setGateFeedback(4, true, `Correct — ${TASK4_GATE_ANSWER} opens the gate.`);
  }
  if (open) updateTask4Graph();
}

function getTask4GraphData() {
  const decodedNames = Object.entries(TASK4_DECODE_ANSWERS)
    .filter(([key]) => state.task4.decoded[key])
    .map(([, name]) => name);
  const visibleIssues = TASK4_ISSUES.filter((issue) => decodedNames.includes(issue.assignee));
  const nodes = new Map();
  const links = new Map();

  const addNode = (id, data) => {
    if (!nodes.has(id)) nodes.set(id, { id, ...data });
  };
  const addLink = (source, target) => {
    const key = `${source}|${target}`;
    if (!links.has(key)) links.set(key, { source, target });
  };

  visibleIssues.forEach((issue) => {
    const personId = `person-${issue.assignee}`;
    const issueId = `issue-${issue.id}`;
    const locationId = `location-${issue.location}`;
    const typeId = `type-${issue.type}`;

    addNode(personId, { type: "person", label: issue.assignee, sublabel: "Assignee" });
    addNode(issueId, { type: "issue", label: issue.id, sublabel: `${issue.confidence}%` });
    addNode(locationId, { type: "location", label: issue.location, sublabel: "Location" });
    addNode(typeId, { type: "issueType", label: issue.type, sublabel: "Issue type" });

    addLink(personId, issueId);
    addLink(issueId, locationId);
    addLink(issueId, typeId);
  });

  return { nodes: [...nodes.values()], links: [...links.values()] };
}

function updateTask4Graph() {
  const mount = document.getElementById("task4Graph");
  if (!mount) return;

  if (typeof d3 === "undefined") {
    mount.innerHTML = '<div class="task4-graph-empty">Graph library is still loading. Try again in a moment.</div>';
    return;
  }

  const { nodes, links } = getTask4GraphData();
  if (!nodes.length) {
    mount.innerHTML = '<div class="task4-graph-empty">Decode a name to reveal the first part of the network.</div>';
    return;
  }

  const width = Math.max(mount.clientWidth || 0, 720);
  const height = 500;
  mount.innerHTML = "";

  const grouped = d3.group(nodes, (d) => d.type);
  grouped.forEach((list) => {
    list.sort((a, b) => a.label.localeCompare(b.label)).forEach((n, index) => {
      n.order = index;
      n.total = list.length;
    });
  });

  const targetX = {
    person: width * 0.18,
    issue: width * 0.45,
    location: width * 0.72,
    issueType: width * 0.88,
  };
  const nodeRadius = (d) => {
    if (d.type === "issue") return 18;
    if (d.type === "issueType") return 22;
    return 28;
  };
  const targetY = (d) => {
    const total = Math.max(d.total || 1, 1);
    return 70 + ((d.order + 1) * (height - 140)) / (total + 1);
  };

  const svg = d3.select(mount)
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("preserveAspectRatio", "xMidYMid meet")
    .style("cursor", "grab");

  // zoom hint overlay
  const hintEl = document.createElement("div");
  hintEl.className = "task4-graph-hint";
  hintEl.textContent = "Scroll to zoom · Click a node to highlight · Click background to reset";
  mount.appendChild(hintEl);

  const container = svg.append("g").attr("class", "task4-graph-container");

  // zoom behaviour
  const zoom = d3.zoom()
    .scaleExtent([0.3, 4])
    .on("zoom", (event) => {
      container.attr("transform", event.transform);
      svg.style("cursor", event.transform.k !== 1 ? "grabbing" : "grab");
    });
  svg.call(zoom);

  const link = container.append("g")
    .selectAll("line")
    .data(links)
    .join("line")
    .attr("class", "task4-link")
    .attr("stroke", "rgba(92, 214, 135, 0.35)")
    .attr("stroke-width", 1.6);

  const node = container.append("g")
    .selectAll("g")
    .data(nodes, (d) => d.id)
    .join((enter) => {
      const g = enter.append("g").attr("class", (d) => `task4-node task4-node-${d.type}`);
      g.append("circle");
      g.append("text").attr("class", "task4-node-label").attr("text-anchor", "middle");
      g.append("text").attr("class", "task4-node-sub").attr("text-anchor", "middle");
      return g;
    });

  node.select("circle")
    .attr("r", (d) => nodeRadius(d))
    .attr("fill", (d) => {
      if (d.type === "person") return "#123c24";
      if (d.type === "issue") return "#173042";
      if (d.type === "location") return "#16394d";
      return "#334015";
    })
    .attr("stroke", (d) => {
      if (d.type === "person") return "#5be37d";
      if (d.type === "issue") return "#7fd2ff";
      if (d.type === "location") return "#8fd7ff";
      return "#d9ef7a";
    })
    .attr("stroke-width", 1.8)
    .style("cursor", "pointer");

  node.select(".task4-node-label")
    .attr("dy", (d) => nodeRadius(d) + 15)
    .attr("fill", "#dbe8f4")
    .attr("font-size", 11)
    .attr("font-weight", 700)
    .text((d) => d.label);

  node.select(".task4-node-sub")
    .attr("dy", (d) => nodeRadius(d) + 29)
    .attr("fill", "#8fa5b8")
    .attr("font-size", 10)
    .text((d) => d.sublabel);

  // click on a node — highlight its direct connections
  node.on("click", (event, d) => {
    event.stopPropagation();
    const connectedNodeIds = new Set([d.id]);
    links.forEach((l) => {
      const srcId = typeof l.source === "object" ? l.source.id : l.source;
      const tgtId = typeof l.target === "object" ? l.target.id : l.target;
      if (srcId === d.id) connectedNodeIds.add(tgtId);
      if (tgtId === d.id) connectedNodeIds.add(srcId);
    });

    node.classed("task4-node-dimmed", (n) => !connectedNodeIds.has(n.id));
    node.classed("task4-node-highlighted", (n) => n.id === d.id);
    link.classed("task4-link-dimmed", (l) => {
      const srcId = typeof l.source === "object" ? l.source.id : l.source;
      const tgtId = typeof l.target === "object" ? l.target.id : l.target;
      return srcId !== d.id && tgtId !== d.id;
    });
    link.classed("task4-link-highlighted", (l) => {
      const srcId = typeof l.source === "object" ? l.source.id : l.source;
      const tgtId = typeof l.target === "object" ? l.target.id : l.target;
      return srcId === d.id || tgtId === d.id;
    });
  });

  // click on svg background — reset highlight
  svg.on("click", () => {
    node.classed("task4-node-dimmed", false).classed("task4-node-highlighted", false);
    link.classed("task4-link-dimmed", false).classed("task4-link-highlighted", false);
  });

  const simulation = d3.forceSimulation(nodes)
    .force("link", d3.forceLink(links).id((d) => d.id).distance(100).strength(0.82))
    .force("charge", d3.forceManyBody().strength(-300))
    .force("collide", d3.forceCollide().radius((d) => nodeRadius(d) + 24))
    .force("x", d3.forceX((d) => targetX[d.type]).strength(0.34))
    .force("y", d3.forceY((d) => targetY(d)).strength(0.24))
    .on("tick", () => {
      link
        .attr("x1", (d) => d.source.x)
        .attr("y1", (d) => d.source.y)
        .attr("x2", (d) => d.target.x)
        .attr("y2", (d) => d.target.y);

      node.attr("transform", (d) => `translate(${d.x},${d.y})`);
    });

  window.setTimeout(() => simulation.stop(), 1400);
}

function renderTask4DecodeState() {
  Object.entries(TASK4_DECODE_ANSWERS).forEach(([key, answer]) => {
    const input = document.getElementById(`l4Decode${key}`);
    const card = input?.closest(".decode-card");
    if (!input || !card) return;

    if (state.task4.decoded[key]) {
      input.value = answer;
      input.disabled = true;
      card.classList.add("is-decoded");
      setDecodeFeedback(key, true, "Decoded");
    } else {
      input.disabled = false;
      card.classList.remove("is-decoded");
      if (!input.value.trim()) setDecodeFeedback(key, false, "");
    }
  });

  const counter = document.getElementById("decodeCounter4");
  if (counter) counter.textContent = `Decoded names: ${getTask4DecodedCount()} / 6`;

  updateTask4Graph();
  renderTask4CompletionState();
}

function handleTask4DecodeInput(index) {
  if (state.task4.decoded[index]) return;
  const input = document.getElementById(`l4Decode${index}`);
  if (!input) return;

  const answer = TASK4_DECODE_ANSWERS[index];
  const normalized = normalizeNameToken(input.value);
  if (!input.value.trim()) {
    setDecodeFeedback(index, false, "");
    return;
  }

  if (normalized === answer) {
    state.task4.decoded[index] = true;
    input.value = answer;
    saveProgress();
    renderTask4DecodeState();
    return;
  }

  setDecodeFeedback(index, false, "Keep decoding");
}

function renderTask4CompletionState() {
  const nextBtn = document.getElementById("nextTask4");
  const answer = document.getElementById("answer4");

  if (state.solved[4]) {
    if (answer) answer.value = "34";
    setFeedback(4, true, "Correct — the breach points to Viktor, and the entry-point confidence score is 34.");
    if (nextBtn) nextBtn.classList.remove("hidden");
  } else if (nextBtn) {
    nextBtn.classList.add("hidden");
  }
}

function checkTask4Gate() {
  if (state.gates[4]) return;
  const input = document.getElementById("gateInput4");
  const value = normalize(input?.value || "");
  if (value === "A-2" || value === "A2") {
    state.gates[4] = true;
    setGateFeedback(4, true, `Correct — ${TASK4_GATE_ANSWER} opens the gate.`);
    renderTask4GateState();
    renderTask4DecodeState();
    saveProgress();
    return;
  }
  setGateFeedback(4, false, "That feed label does not open the gate. Recheck the blue helmet clue.");
}

function checkTask4Final() {
  if (!state.gates[4]) {
    setFeedback(4, false, "Solve the gate riddle first.");
    return;
  }
  if (getTask4DecodedCount() < 6) {
    setFeedback(4, false, "Decode all six names first so the network is fully visible.");
    return;
  }

  const answer = document.getElementById("answer4")?.value.trim() || "";
  if (!/^\d+$/.test(answer)) {
    setFeedback(4, false, "Enter the confidence score using digits only.");
    return;
  }

  if (Number(answer) === 34) {
    unlockLevel(4);
    renderTask4CompletionState();
    return;
  }

  setFeedback(4, false, "Not correct yet. Recheck the 02:47 issue and the sealed-room clue.");
}

function checkTask3RoomAudit() {
  if (!state.subtasks[3].d) {
    setFeedback(3, false, "Compile the agent first, then use it to find the room overcharges.");
    return;
  }

  const entries = Object.keys(TASK3_ROOM_OVERCHARGES).map((room) => {
    const input = document.getElementById(`l3Room${room}`);
    return [Number(room), input ? input.value.trim() : ""];
  });

  if (entries.some(([, value]) => !value)) {
    setFeedback(3, false, "Enter an overcharge amount for all four rooms. Use digits only, without dots or commas.");
    return;
  }

  if (entries.some(([, value]) => !/^\d+$/.test(value))) {
    if (!state.solved[3]) state.audits[3] = false;
    setFeedback(3, false, "Type the room overcharge amounts using digits only, without dots or commas.");
    renderTask3CompletionState();
    saveProgress();
    return;
  }

  const incorrectRooms = entries
    .filter(([room, value]) => Number(value) !== TASK3_ROOM_OVERCHARGES[room])
    .map(([room]) => `Room ${room}`);

  if (incorrectRooms.length) {
    if (!state.solved[3]) state.audits[3] = false;
    setFeedback(3, false, "Not correct yet. Re-run the agent and enter the exact overcharge for each room.");
    renderTask3CompletionState();
    saveProgress();
    return;
  }

  state.audits[3] = true;
  renderTask3AuditInputs();
  renderTask3CompletionState();
  saveProgress();
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

/* ─── admin skip ─── */
function skipToLevel(level) {
  // Unlock all levels before the target
  for (let l = 1; l < level; l++) {
    state.solved[l] = true;
    if (l === 2) {
      state.gates[2] = true;
      state.subtasks[2] = { a: true, b: true, c: true, d: true };
    }
    if (l === 3) {
      state.subtasks[3] = { a: true, b: true, c: true, d: true };
      state.audits[3] = true;
    }
  }
  // Open the gate on the target level if it has one
  if (level === 2) state.gates[2] = true;
  if (level === 4) state.gates[4] = true;

  state.score =
    (Number(state.solved[1]) + Number(state.solved[2]) + Number(state.solved[3]) + Number(state.solved[4])) * 10
    - (Number(state.hintsUsed[1]) + Number(state.hintsUsed[2]) + Number(state.hintsUsed[3]) + Number(state.hintsUsed[4])) * 3;

  renderSubtaskState();
  renderGateStates();
  updateStatsUI();
  saveProgress();
  showSection(`level-${level}`);
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
  if (level === 3 && key === "a") {
    return ["N", "LETTERN", "THELETTERN"].includes(v);
  }
  if (level === 3 && key === "b") return v === "11111000101";
  if (level === 3 && key === "c") {
    const rawText = String(raw || "").toUpperCase();
    return Number(v) === 14 || rawText.includes("MAIN ENTRANCE") || rawText.includes("ROOM 14");
  }
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
  if (level === 3) {
    const nav = document.querySelector('.nav-item[data-target="level-4"]');
    if (nav) {
      nav.classList.remove("locked");
      nav.querySelector(".nav-icon").textContent = "4";
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
  if (level === 3 && !state.solved[2]) {
    setSubtaskFeedback(level, key, false, "Solve Task 2 first.");
    return;
  }
  const inputIds = {
    1: { a: "l1Sub1", b: "l1Sub2" },
    2: { a: "l2Sub1", b: "l2Sub2", c: "l2Sub3", d: "l2Sub4" },
    3: { a: "l3Sub1", b: "l3Sub2", c: "l3Sub3" },
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
      level === 2 ? getTask2SuccessMessage(key) : level === 3 ? getTask3SuccessMessage(key) : "Correct — fragment unlocked.",
    );
  } else {
    setSubtaskFeedback(
      level,
      key,
      false,
      level === 2
        ? "Not correct yet. Recheck the quote data."
        : level === 3
          ? "Not correct yet. Recheck the protocol stack clues."
          : "Not correct yet.",
    );
  }
  updateSubtaskUI(level, key);
  if (level === 2) renderTask2CheckState();
  if (level === 3) renderTask3CheckState();
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

function bindPythonOutput(py, outEl) {
  py.setStdout({
    batched: (text) => {
      outEl.textContent += `${text}\n`;
    },
  });
  if (typeof py.setStderr === "function") {
    py.setStderr({
      batched: (text) => {
        outEl.textContent += `${text}\n`;
      },
    });
  }
}

async function compileAgent(level, editorId, outputId) {
  const outEl = document.getElementById(outputId);
  const code = document.getElementById(editorId).value;
  const prerequisitesReady = state.subtasks[3].a && state.subtasks[3].b && state.subtasks[3].c;

  if (level === 3 && !prerequisitesReady) {
    setSubtaskFeedback(3, "d", false, "Unlock Box 1-3 before compiling the agent.");
    return;
  }

  let py;
  outEl.textContent = "Compiling agent…";
  try {
    py = await ensurePyodide();
    bindPythonOutput(py, outEl);
    py.globals.set("__agent_code__", code);
    outEl.textContent = "";
    await py.runPythonAsync(`
import ast

tree = ast.parse(__agent_code__, "<agent>", "exec")
compile(__agent_code__, "<agent>", "exec")

has_input_call = any(
    isinstance(node, ast.Call) and getattr(node.func, "id", "") == "input"
    for node in ast.walk(tree)
)

if not has_input_call:
    raise ValueError("Add an input() prompt so the user can type a room number.")
`);
    state.subtasks[3].d = true;
    outEl.textContent = "Compilation successful.\nAgent console unlocked.";
    setSubtaskFeedback(3, "d", true, getTask3SuccessMessage("d"));
    updateSubtaskUI(3, "d");
    renderTask3CheckState();
    saveProgress();
  } catch (err) {
    if (!state.solved[3]) state.subtasks[3].d = false;
    outEl.textContent = String(err);
    setSubtaskFeedback(3, "d", false, "Compile failed. Fix the Python code and try again.");
    updateSubtaskUI(3, "d");
    renderTask3CheckState();
  } finally {
    if (py?.globals) {
      try { py.globals.delete("__agent_code__"); } catch {}
    }
  }
}

async function runAgentPrompt(editorId, promptId, outputId) {
  const outEl = document.getElementById(outputId);
  const promptValue = document.getElementById(promptId).value.trim();
  const code = document.getElementById(editorId).value;

  if (!state.subtasks[3].d) {
    outEl.textContent = "Compile the agent first.";
    return;
  }

  if (!promptValue) {
    outEl.textContent = "Enter a room number first.";
    return;
  }

  let py;
  outEl.textContent = "Running agent…";
  try {
    py = await ensurePyodide();
    bindPythonOutput(py, outEl);
    py.globals.set("__agent_code__", code);
    py.globals.set("__agent_prompt__", promptValue);
    outEl.textContent = "";
    await py.runPythonAsync(`
import builtins

agent_code = __agent_code__
agent_prompt = str(__agent_prompt__)
original_input = builtins.input

def mock_input(prompt=""):
    if prompt:
        print(prompt)
    return agent_prompt

namespace = {"__name__": "__main__"}

try:
    builtins.input = mock_input
    exec(compile(agent_code, "<agent>", "exec"), namespace)
finally:
    builtins.input = original_input
`);
    if (!outEl.textContent.trim()) {
      outEl.textContent = "Agent ran, but it did not print any output.";
    }
  } catch (err) {
    outEl.textContent = String(err);
  } finally {
    if (py?.globals) {
      try { py.globals.delete("__agent_code__"); } catch {}
      try { py.globals.delete("__agent_prompt__"); } catch {}
    }
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
  document.querySelectorAll("[data-check-gate-text]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (Number(btn.dataset.checkGateText) === 4) checkTask4Gate();
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

  // Python compile actions
  document.querySelectorAll("[data-compile-agent]").forEach((btn) => {
    btn.addEventListener("click", () => compileAgent(Number(btn.dataset.compileAgent), btn.dataset.editor, btn.dataset.output));
  });

  // Agent prompt runners
  document.querySelectorAll("[data-run-agent]").forEach((btn) => {
    btn.addEventListener("click", () => runAgentPrompt(btn.dataset.editor, btn.dataset.prompt, btn.dataset.output));
  });

  // Task 3 final room audit
  document.querySelectorAll("[data-check-room-audit]").forEach((btn) => {
    btn.addEventListener("click", () => checkTask3RoomAudit());
  });
  document.querySelectorAll("[data-check-task4-answer]").forEach((btn) => {
    btn.addEventListener("click", () => checkTask4Final());
  });
  Object.keys(TASK4_DECODE_ANSWERS).forEach((key) => {
    const input = document.getElementById(`l4Decode${key}`);
    if (!input) return;
    input.addEventListener("input", () => handleTask4DecodeInput(key));
    input.addEventListener("change", () => handleTask4DecodeInput(key));
  });

  // Mobile menu toggle
  document.getElementById("menuToggle").addEventListener("click", () => {
    document.getElementById("sidebar").classList.toggle("open");
  });

  const bindLightbox = (thumbId, lightboxId, closeId) => {
    const lightbox = document.getElementById(lightboxId);
    const thumb = document.getElementById(thumbId);
    const close = document.getElementById(closeId);
    if (!thumb || !lightbox || !close) return;
    thumb.addEventListener("click", () => lightbox.classList.remove("hidden"));
    close.addEventListener("click", () => lightbox.classList.add("hidden"));
    lightbox.addEventListener("click", (e) => {
      if (e.target === lightbox) lightbox.classList.add("hidden");
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !lightbox.classList.contains("hidden")) {
        lightbox.classList.add("hidden");
      }
    });
  };
  bindLightbox("floorplanThumb", "lightbox", "lightboxClose");
  bindLightbox("site2ThumbGate", "site2LightboxGate", "site2LightboxGateClose");
  bindLightbox("site2Thumb", "site2Lightbox", "site2LightboxClose");

  // Skip to task (requires admin code)
  document.getElementById("skipTaskBtn").addEventListener("click", () => {
    const code = prompt("Enter admin code:");
    if (code !== "symadmin") return;
    const raw = prompt("Jump to task (1 – 4):");
    const level = Number(raw);
    if (!level || level < 1 || level > 4) return;
    skipToLevel(level);
  });

  // Reset (requires admin code)
  document.getElementById("resetProgressBtn").addEventListener("click", () => {
    const code = prompt("Enter admin code to reset progress:");
    if (code !== "symadmin") return;

    resetState();
    localStorage.removeItem(STORAGE_KEY);

    Object.entries({ 1: ["a", "b"], 2: ["a", "b", "c", "d"], 3: ["a", "b", "c", "d"] }).forEach(([level, keys]) => {
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
    ["hint4", "feedback4"].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      if (id.startsWith("hint")) el.classList.add("hidden");
      else {
        el.classList.remove("ok", "bad");
        el.textContent = "";
      }
    });
    const nextTask4 = document.getElementById("nextTask4");
    if (nextTask4) nextTask4.classList.add("hidden");

    ["l1Sub1", "l1Sub2", "l2Sub1", "l2Sub2", "l2Sub3", "l2Sub4", "l3Sub1", "l3Sub2", "l3Sub3", "agentPrompt3", "l3Room5", "l3Room8", "l3Room11", "l3Room14", "gateInput4", "answer4", "l4Decode1", "l4Decode2", "l4Decode3", "l4Decode4", "l4Decode5", "l4Decode6"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        el.value = "";
        el.disabled = false;
      }
    });
    ["pyOut3", "agentConsoleOut3"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.textContent = "";
    });

    const gateFeedback = document.getElementById("gateFeedback2");
    if (gateFeedback) {
      gateFeedback.classList.remove("ok", "bad");
      gateFeedback.textContent = "";
    }
    document.querySelectorAll('[data-gate-level="2"]').forEach((btn) => {
      btn.classList.remove("is-correct", "is-wrong");
    });
    const gateFeedback4 = document.getElementById("gateFeedback4");
    if (gateFeedback4) {
      gateFeedback4.classList.remove("ok", "bad");
      gateFeedback4.textContent = "";
    }
    document.querySelectorAll('[data-choice-subtask="2b"]').forEach((btn) => {
      btn.classList.remove("is-correct", "is-wrong");
      btn.disabled = false;
    });
    Object.keys(TASK4_DECODE_ANSWERS).forEach((key) => {
      setDecodeFeedback(key, false, "");
      const card = document.getElementById(`l4Decode${key}`)?.closest(".decode-card");
      if (card) card.classList.remove("is-decoded");
    });
    const graph = document.getElementById("task4Graph");
    if (graph) graph.innerHTML = "";

    const l2Nav = document.querySelector('.nav-item[data-target="level-2"]');
    l2Nav.classList.add("locked");
    l2Nav.querySelector(".nav-icon").textContent = "2";
    const l3Nav = document.querySelector('.nav-item[data-target="level-3"]');
    if (l3Nav) {
      l3Nav.classList.add("locked");
      l3Nav.querySelector(".nav-icon").textContent = "3";
    }
    const l4Nav = document.querySelector('.nav-item[data-target="level-4"]');
    if (l4Nav) {
      l4Nav.classList.add("locked");
      l4Nav.querySelector(".nav-icon").textContent = "4";
    }

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

  if (state.solved[4]) showSection("level-4");
  else if (state.solved[3]) showSection("level-3");
  else if (state.solved[2]) showSection("level-2");
  else if (state.solved[1]) showSection("level-1");
  else showSection("start");
}

init();
