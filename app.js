const STORAGE_KEY = "work-session-tracker";
const REMINDER_MINUTES = 20;
const FEED_POLL_INTERVAL_MS = 60 * 1000;
const FEED_URL = "./mock-status.json";

const state = loadState();

const clock = document.getElementById("clock");
const elapsed = document.getElementById("elapsed");
const sessionState = document.getElementById("sessionState");
const entryCount = document.getElementById("entryCount");
const latestTask = document.getElementById("latestTask");
const nextReminder = document.getElementById("nextReminder");
const feedStatus = document.getElementById("feedStatus");
const feedMessage = document.getElementById("feedMessage");
const feedUpdatedAt = document.getElementById("feedUpdatedAt");
const feedItems = document.getElementById("feedItems");
const networkTestForm = document.getElementById("networkTestForm");
const networkTestUrl = document.getElementById("networkTestUrl");
const networkTestStatus = document.getElementById("networkTestStatus");
const networkTestCode = document.getElementById("networkTestCode");
const networkTestDuration = document.getElementById("networkTestDuration");
const networkTestBody = document.getElementById("networkTestBody");
const timeline = document.getElementById("timeline");
const taskForm = document.getElementById("taskForm");
const taskInput = document.getElementById("taskInput");
const noteInput = document.getElementById("noteInput");
const startSessionButton = document.getElementById("startSession");
const endSessionButton = document.getElementById("endSession");
const clearLogButton = document.getElementById("clearLog");
const refreshFeedButton = document.getElementById("refreshFeed");
const timelineItemTemplate = document.getElementById("timelineItemTemplate");

function loadState() {
  const fallback = {
    sessionStart: null,
    entries: [],
    lastReminderAt: null,
    feed: {
      message: "No data loaded yet",
      items: [],
      lastUpdatedAt: null,
      lastPolledAt: null,
      error: null,
    },
  };

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return fallback;
    }

    const parsed = JSON.parse(raw);
    return {
      ...fallback,
      ...parsed,
      feed: {
        ...fallback.feed,
        ...parsed.feed,
      },
    };
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

function renderFeed() {
  feedMessage.textContent = state.feed.message;
  feedUpdatedAt.textContent = state.feed.lastUpdatedAt
    ? formatTimestamp(state.feed.lastUpdatedAt)
    : "Never";
  renderFeedItems();

  if (state.feed.error) {
    feedStatus.textContent = "Refresh failed";
    return;
  }

  if (state.feed.lastPolledAt) {
    feedStatus.textContent = `Refreshed ${formatTime(new Date(state.feed.lastPolledAt))}`;
    return;
  }

  feedStatus.textContent = "Waiting for refresh";
}

function renderFeedItems() {
  feedItems.innerHTML = "";
  const items = Array.isArray(state.feed.items) ? state.feed.items : [];

  if (items.length === 0) {
    const empty = document.createElement("li");
    empty.className = "empty";
    empty.textContent = "No feed items yet.";
    feedItems.appendChild(empty);
    return;
  }

  items.forEach((item) => {
    const row = document.createElement("li");
    const title = document.createElement("strong");
    const detail = document.createElement("span");

    title.textContent = item.title;
    detail.textContent = item.detail;

    row.append(title, detail);
    feedItems.appendChild(row);
  });
}

function normalizeFeedPayload(payload) {
  const sourceItems = Array.isArray(payload)
    ? payload
    : Array.isArray(payload.items)
      ? payload.items
      : [];

  return {
    message: payload.message || "Feed refreshed",
    lastUpdatedAt: payload.updatedAt || Date.now(),
    items: sourceItems.map((item, index) => ({
      title: item.title || `Feed item ${index + 1}`,
      detail: item.detail || item.message || "No additional detail.",
    })),
  };
}

function render() {
  renderSession();
  renderSummary();
  renderFeed();
  renderTimeline();
}

async function runNetworkTest(url) {
  networkTestStatus.textContent = "Running...";
  networkTestCode.textContent = "-";
  networkTestDuration.textContent = "-";
  networkTestBody.textContent = "Waiting for response...";

  const startedAt = performance.now();

  try {
    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
    });
    const durationMs = Math.round(performance.now() - startedAt);
    const bodyText = await response.text();

    networkTestStatus.textContent = response.ok ? "Request succeeded" : "Request failed";
    networkTestCode.textContent = String(response.status);
    networkTestDuration.textContent = `${durationMs} ms`;
    networkTestBody.textContent = bodyText || "Response body was empty.";
  } catch (error) {
    const durationMs = Math.round(performance.now() - startedAt);

    networkTestStatus.textContent = "Network error";
    networkTestCode.textContent = "blocked";
    networkTestDuration.textContent = `${durationMs} ms`;
    networkTestBody.textContent = error instanceof Error ? error.message : "Unknown error";
  }
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

async function refreshFeed() {
  try {
    const response = await fetch(FEED_URL, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const payload = await response.json();
    const normalized = normalizeFeedPayload(payload);
    state.feed = {
      message: normalized.message,
      items: normalized.items,
      lastUpdatedAt: normalized.lastUpdatedAt,
      lastPolledAt: Date.now(),
      error: null,
    };
    saveState();
    renderFeed();
  } catch (error) {
    state.feed = {
      ...state.feed,
      lastPolledAt: Date.now(),
      error: error instanceof Error ? error.message : "Unknown error",
    };
    saveState();
    renderFeed();
  }
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

refreshFeedButton.addEventListener("click", () => {
  refreshFeed();
});

networkTestForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const url = networkTestUrl.value.trim();

  if (!url) {
    return;
  }

  runNetworkTest(url);
});

render();
setInterval(() => {
  renderSession();
  maybeSendReminder();
  renderSummary();
}, 1000);
refreshFeed();
setInterval(() => {
  refreshFeed();
}, FEED_POLL_INTERVAL_MS);
