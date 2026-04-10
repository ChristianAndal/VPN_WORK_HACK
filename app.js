const STORAGE_KEY = "work-session-tracker";
const REMINDER_MINUTES = 20;

const state = loadState();

const clock = document.getElementById("clock");
const elapsed = document.getElementById("elapsed");
const sessionState = document.getElementById("sessionState");
const entryCount = document.getElementById("entryCount");
const latestTask = document.getElementById("latestTask");
const nextReminder = document.getElementById("nextReminder");
const timeline = document.getElementById("timeline");
const taskForm = document.getElementById("taskForm");
const taskInput = document.getElementById("taskInput");
const noteInput = document.getElementById("noteInput");
const startSessionButton = document.getElementById("startSession");
const endSessionButton = document.getElementById("endSession");
const clearLogButton = document.getElementById("clearLog");
const timelineItemTemplate = document.getElementById("timelineItemTemplate");

function loadState() {
  const fallback = {
    sessionStart: null,
    entries: [],
    lastReminderAt: null,
  };

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function formatTime(date) {
  return new Intl.DateTimeFormat([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

function formatTimestamp(timestamp) {
  return new Intl.DateTimeFormat([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

function addEntry(title, note = "") {
  state.entries.unshift({
    id: crypto.randomUUID(),
    title,
    note,
    createdAt: Date.now(),
  });
  saveState();
  render();
}

function renderTimeline() {
  timeline.innerHTML = "";

  if (state.entries.length === 0) {
    const empty = document.createElement("li");
    empty.className = "empty";
    empty.textContent = "No activity yet. Start a session and add your first task.";
    timeline.appendChild(empty);
    return;
  }

  state.entries.forEach((entry) => {
    const item = timelineItemTemplate.content.cloneNode(true);
    item.querySelector(".timeline-title").textContent = entry.title;
    item.querySelector(".timeline-time").textContent = formatTimestamp(entry.createdAt);
    item.querySelector(".timeline-note").textContent = entry.note || "No extra note.";
    timeline.appendChild(item);
  });
}

function renderSummary() {
  entryCount.textContent = `${state.entries.length} ${state.entries.length === 1 ? "entry" : "entries"}`;
  latestTask.textContent = state.entries[0]?.title || "Nothing logged yet";

  if (!state.sessionStart) {
    sessionState.textContent = "Idle";
    nextReminder.textContent = `Every ${REMINDER_MINUTES} minutes`;
    return;
  }

  sessionState.textContent = "Active";

  const reminderAt = state.lastReminderAt
    ? new Date(state.lastReminderAt + REMINDER_MINUTES * 60 * 1000)
    : new Date(state.sessionStart + REMINDER_MINUTES * 60 * 1000);
  nextReminder.textContent = formatTime(reminderAt);
}

function renderSession() {
  const now = Date.now();
  elapsed.textContent = state.sessionStart ? formatDuration(now - state.sessionStart) : "00:00:00";
  clock.textContent = formatTime(new Date(now));
}

function render() {
  renderSession();
  renderSummary();
  renderTimeline();
}

function maybeSendReminder() {
  if (!state.sessionStart) {
    return;
  }

  const now = Date.now();
  const anchor = state.lastReminderAt || state.sessionStart;
  const threshold = REMINDER_MINUTES * 60 * 1000;

  if (now - anchor < threshold) {
    return;
  }

  state.lastReminderAt = now;
  saveState();
  addEntry("Status reminder", "Time to update your task note, team status, or ticket progress.");
}

taskForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const task = taskInput.value.trim();
  const note = noteInput.value.trim();

  if (!task) {
    return;
  }

  addEntry(task, note);
  taskForm.reset();
  taskInput.focus();
});

startSessionButton.addEventListener("click", () => {
  if (state.sessionStart) {
    return;
  }

  state.sessionStart = Date.now();
  state.lastReminderAt = null;
  saveState();
  addEntry("Session started", "Work session started on this device.");
});

endSessionButton.addEventListener("click", () => {
  if (!state.sessionStart) {
    return;
  }

  const sessionLength = formatDuration(Date.now() - state.sessionStart);
  state.sessionStart = null;
  state.lastReminderAt = null;
  saveState();
  addEntry("Session ended", `Tracked session length: ${sessionLength}.`);
});

clearLogButton.addEventListener("click", () => {
  state.entries = [];
  saveState();
  render();
});

render();
setInterval(() => {
  renderSession();
  maybeSendReminder();
  renderSummary();
}, 1000);
