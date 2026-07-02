const STORAGE_KEY = "vfsQaToolSessionV1";

const state = {
  workbookName: "",
  headerRowNumber: 3,
  rawRows: [],
  headers: [],
  columnMap: {},
  candidates: [],
  sample: [],
  currentIndex: 0,
  reviews: {},
  seed: "",
  sampleMode: "balanced",
};

const els = {};

document.addEventListener("DOMContentLoaded", () => {
  cacheElements();
  attachEvents();
  updateAllViews();
});

function cacheElements() {
  const ids = [
    "fileInput", "fileStatus", "headerRowInput", "sampleSizeInput", "sampleModeInput", "seedInput",
    "generateSampleBtn", "reshuffleBtn", "parseWarnings", "totalRowsMetric", "candidateRowsMetric",
    "doneRowsMetric", "skippedRowsMetric", "agentBreakdown", "reviewProgress", "reviewEmpty", "taskCard",
    "taskCounter", "taskTitle", "vfsLink", "taskAgent", "taskStatus", "taskDuration", "taskStart", "taskEnd",
    "taskVenueId", "taskConfigId", "taskConfigName", "taskIssueNotes", "qaNotesInput", "prevTaskBtn",
    "saveReviewBtn", "nextTaskBtn", "reviewedMetric", "errorsMetric", "errorRateMetric", "avgDurationMetric",
    "agentStatsTable", "reviewedTasksTable", "exportCsvBtn", "exportJsonBtn", "loadSavedBtn", "clearSavedBtn"
  ];
  ids.forEach((id) => { els[id] = document.getElementById(id); });
}

function attachEvents() {
  els.fileInput.addEventListener("change", handleFileUpload);
  els.headerRowInput.addEventListener("change", () => {
    state.headerRowNumber = parsePositiveInt(els.headerRowInput.value, 3);
    if (state.rawRows.length) processRows();
  });
  els.generateSampleBtn.addEventListener("click", () => generateSample(false));
  els.reshuffleBtn.addEventListener("click", () => generateSample(true));
  els.sampleModeInput.addEventListener("change", () => {
    state.sampleMode = els.sampleModeInput.value;
  });
  els.seedInput.addEventListener("input", () => {
    state.seed = els.seedInput.value.trim();
  });
  els.prevTaskBtn.addEventListener("click", () => moveTask(-1));
  els.nextTaskBtn.addEventListener("click", () => moveTask(1));
  els.saveReviewBtn.addEventListener("click", saveCurrentReview);
  els.exportCsvBtn.addEventListener("click", exportResultsCsv);
  els.exportJsonBtn.addEventListener("click", exportSessionJson);
  els.loadSavedBtn.addEventListener("click", loadSavedSession);
  els.clearSavedBtn.addEventListener("click", clearSavedSession);
  document.querySelectorAll("input[name='qaDecision']").forEach((radio) => {
    radio.addEventListener("change", saveCurrentReview);
  });
  els.qaNotesInput.addEventListener("blur", saveCurrentReview);
}

async function handleFileUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    await ensureXlsxLoaded();
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: "array", cellDates: false, raw: false });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: "",
      raw: false,
      blankrows: false,
    });

    resetStateForNewWorkbook(file.name, rows);
    processRows();
    updateAllViews();
    saveSession();
  } catch (error) {
    showWarnings([`Could not read the file. ${error.message || error}`]);
  }
}

function ensureXlsxLoaded() {
  return new Promise((resolve, reject) => {
    if (window.XLSX) {
      resolve();
      return;
    }
    const started = Date.now();
    const timer = window.setInterval(() => {
      if (window.XLSX) {
        window.clearInterval(timer);
        resolve();
      } else if (Date.now() - started > 8000) {
        window.clearInterval(timer);
        reject(new Error("The spreadsheet parser did not load. Check your internet connection and refresh the page."));
      }
    }, 100);
  });
}

function resetStateForNewWorkbook(name, rows) {
  state.workbookName = name;
  state.headerRowNumber = parsePositiveInt(els.headerRowInput.value, 3);
  state.rawRows = rows;
  state.headers = [];
  state.columnMap = {};
  state.candidates = [];
  state.sample = [];
  state.currentIndex = 0;
  state.reviews = {};
  state.seed = els.seedInput.value.trim() || makeSeed();
  els.seedInput.value = state.seed;
}

function processRows() {
  const warnings = [];
  const headerIndex = Math.max(0, state.headerRowNumber - 1);
  const headerRow = state.rawRows[headerIndex] || [];
  state.headers = makeHeaders(headerRow);
  state.columnMap = detectColumns(state.headers);
  state.candidates = [];
  state.sample = [];
  state.currentIndex = 0;
  state.reviews = {};

  const required = ["agent", "status", "venueId", "configId"];
  required.forEach((key) => {
    if (state.columnMap[key] === -1) warnings.push(`Could not detect required column: ${key}. Check the header row setting.`);
  });

  for (let rowIndex = headerIndex + 1; rowIndex < state.rawRows.length; rowIndex += 1) {
    const row = state.rawRows[rowIndex] || [];
    const task = buildTask(row, rowIndex + 1);
    const status = task.status.toLowerCase();
    if (task.agent && (status === "done" || status === "skipped")) {
      state.candidates.push(task);
    }
  }

  if (!state.candidates.length && state.rawRows.length) {
    warnings.push("No QA candidates found. Candidates need an agent name and a status of Done or Skipped.");
  }

  showWarnings(warnings);
  updateAllViews();
  saveSession();
}

function makeHeaders(headerRow) {
  const seen = new Map();
  return headerRow.map((value, index) => {
    const raw = clean(value) || `COL_${index + 1}`;
    const base = raw;
    const count = seen.get(base) || 0;
    seen.set(base, count + 1);
    return count ? `${base}_${count + 1}` : base;
  });
}

function detectColumns(headers) {
  return {
    agent: findColumn(headers, ["AGENT"], 0),
    status: findColumn(headers, ["STATUS"], 1),
    start: findColumn(headers, ["START"]),
    end: findColumn(headers, ["END"]),
    duration: findColumn(headers, ["DURATION", "DURATION MIN", "DURATION (MIN)"]),
    issueNotes: findColumn(headers, ["ISSUE NOTES", "NOTES", "ISSUE NOTE"]),
    venueName: findColumn(headers, ["VENUE_NAME", "VENUE NAME"]),
    venueId: findColumn(headers, ["VENUE_ID", "VENUE ID"]),
    configId: findColumn(headers, ["VENUE_CONFIG_ID", "VENUE CONFIG ID", "CONFIG_ID", "CONFIG ID", "CONFIGID"]),
    configName: findColumn(headers, ["VENUE_CONFIG", "VENUE CONFIG", "CONFIG_NAME", "CONFIG NAME"]),
    eventIds: findColumn(headers, ["ALL_EVENT_IDS", "EVENT_ID", "EVENT IDS", "EVENT ID"]),
    eventNames: findColumn(headers, ["ALL_EVENT_NAMES", "EVENT_NAME", "EVENT NAMES", "EVENT NAME"]),
    taskType: findColumn(headers, ["TASK TYPE", "Task Type"]),
  };
}

function findColumn(headers, aliases, fallbackIndex = -1) {
  const normalizedAliases = aliases.map(normalizeKey);
  for (let i = 0; i < headers.length; i += 1) {
    const normalizedHeader = normalizeKey(headers[i]);
    if (normalizedAliases.includes(normalizedHeader)) return i;
  }
  return fallbackIndex >= 0 && fallbackIndex < headers.length ? fallbackIndex : -1;
}

function buildTask(row, sheetRowNumber) {
  const get = (key) => {
    const index = state.columnMap[key];
    return index >= 0 ? clean(row[index]) : "";
  };
  const venueId = get("venueId");
  const configId = get("configId");
  const task = {
    rowNumber: sheetRowNumber,
    agent: get("agent"),
    status: get("status"),
    start: get("start"),
    end: get("end"),
    duration: get("duration"),
    issueNotes: get("issueNotes"),
    venueName: get("venueName"),
    venueId,
    configId,
    configName: get("configName"),
    eventIds: get("eventIds"),
    eventNames: get("eventNames"),
    taskType: get("taskType"),
    vfsUrl: venueId && configId ? `https://eventdatamanager.viagogo.net/venue/${encodeURIComponent(venueId)}/config/${encodeURIComponent(configId)}/vfs` : "",
  };
  task.key = makeTaskKey(task);
  return task;
}

function generateSample(forceNewSeed) {
  const sampleSize = Math.min(parsePositiveInt(els.sampleSizeInput.value, 20), state.candidates.length);
  state.sampleMode = els.sampleModeInput.value;
  if (forceNewSeed || !els.seedInput.value.trim()) {
    state.seed = makeSeed();
    els.seedInput.value = state.seed;
  } else {
    state.seed = els.seedInput.value.trim();
  }

  if (!sampleSize) return;

  if (state.sampleMode === "proportional") {
    state.sample = proportionalSample(state.candidates, sampleSize, state.seed);
  } else if (state.sampleMode === "random") {
    state.sample = shuffle([...state.candidates], seededRandom(state.seed)).slice(0, sampleSize);
  } else {
    state.sample = balancedSample(state.candidates, sampleSize, state.seed);
  }

  state.currentIndex = 0;
  updateAllViews();
  saveSession();
  document.querySelector(".review-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function balancedSample(candidates, sampleSize, seed) {
  const rng = seededRandom(seed);
  const groups = groupBy(candidates, "agent");
  const agents = shuffle(Object.keys(groups).sort(), rng);
  const shuffledGroups = {};
  agents.forEach((agent) => {
    shuffledGroups[agent] = shuffle([...groups[agent]], rng);
  });

  const selected = [];
  while (selected.length < sampleSize) {
    let addedThisRound = false;
    for (const agent of agents) {
      if (selected.length >= sampleSize) break;
      const group = shuffledGroups[agent];
      if (group.length) {
        selected.push(group.shift());
        addedThisRound = true;
      }
    }
    if (!addedThisRound) break;
  }
  return selected;
}

function proportionalSample(candidates, sampleSize, seed) {
  const rng = seededRandom(seed);
  const groups = groupBy(candidates, "agent");
  const agents = Object.keys(groups).sort();
  const quotas = {};
  let allocated = 0;

  agents.forEach((agent) => {
    const rawQuota = (groups[agent].length / candidates.length) * sampleSize;
    quotas[agent] = Math.floor(rawQuota);
    allocated += quotas[agent];
  });

  const remainders = agents
    .map((agent) => ({ agent, remainder: ((groups[agent].length / candidates.length) * sampleSize) - quotas[agent] }))
    .sort((a, b) => b.remainder - a.remainder);

  for (const item of remainders) {
    if (allocated >= sampleSize) break;
    quotas[item.agent] += 1;
    allocated += 1;
  }

  const selected = [];
  agents.forEach((agent) => {
    const shuffled = shuffle([...groups[agent]], rng);
    selected.push(...shuffled.slice(0, quotas[agent]));
  });

  return shuffle(selected, rng).slice(0, sampleSize);
}

function updateAllViews() {
  updateUploadStatus();
  updatePoolStats();
  updateReviewCard();
  updateDashboard();
}

function updateUploadStatus() {
  if (!state.workbookName) {
    els.fileStatus.textContent = "No file loaded";
    els.fileStatus.classList.add("muted");
    els.generateSampleBtn.disabled = true;
    els.reshuffleBtn.disabled = true;
    return;
  }
  els.fileStatus.textContent = state.workbookName;
  els.fileStatus.classList.remove("muted");
  els.generateSampleBtn.disabled = !state.candidates.length;
  els.reshuffleBtn.disabled = !state.candidates.length;
}

function updatePoolStats() {
  const totalDataRows = Math.max(0, state.rawRows.length - state.headerRowNumber);
  const done = state.candidates.filter((task) => task.status.toLowerCase() === "done").length;
  const skipped = state.candidates.filter((task) => task.status.toLowerCase() === "skipped").length;

  els.totalRowsMetric.textContent = state.rawRows.length ? formatNumber(totalDataRows) : "-";
  els.candidateRowsMetric.textContent = state.rawRows.length ? formatNumber(state.candidates.length) : "-";
  els.doneRowsMetric.textContent = state.rawRows.length ? formatNumber(done) : "-";
  els.skippedRowsMetric.textContent = state.rawRows.length ? formatNumber(skipped) : "-";

  if (!state.candidates.length) {
    els.agentBreakdown.className = "agent-breakdown empty-state";
    els.agentBreakdown.textContent = state.rawRows.length ? "No eligible Done or Skipped tasks found." : "Upload a file to see agent counts.";
    return;
  }

  const groups = groupBy(state.candidates, "agent");
  const max = Math.max(...Object.values(groups).map((items) => items.length));
  els.agentBreakdown.className = "agent-breakdown agent-list";
  els.agentBreakdown.innerHTML = Object.keys(groups).sort().map((agent) => {
    const count = groups[agent].length;
    const pct = max ? (count / max) * 100 : 0;
    return `<div class="agent-row"><strong>${escapeHtml(agent)}</strong><div class="agent-bar"><span style="width: ${pct}%"></span></div><span>${count} tasks</span></div>`;
  }).join("");
}

function updateReviewCard() {
  if (!state.sample.length) {
    els.reviewProgress.textContent = "No sample";
    els.reviewProgress.classList.add("muted");
    els.reviewEmpty.classList.remove("hidden");
    els.taskCard.classList.add("hidden");
    return;
  }

  const task = state.sample[state.currentIndex];
  const review = state.reviews[task.key] || {};
  const reviewedCount = state.sample.filter((item) => state.reviews[item.key]?.decision).length;

  els.reviewProgress.textContent = `${reviewedCount}/${state.sample.length} reviewed`;
  els.reviewProgress.classList.toggle("muted", reviewedCount === 0);
  els.reviewEmpty.classList.add("hidden");
  els.taskCard.classList.remove("hidden");

  els.taskCounter.textContent = `Task ${state.currentIndex + 1} of ${state.sample.length} | Sheet row ${task.rowNumber}`;
  els.taskTitle.textContent = task.venueName || "Unknown venue";
  els.vfsLink.href = task.vfsUrl || "#";
  els.vfsLink.textContent = task.vfsUrl ? "Open VFS page" : "Missing VFS link";
  els.vfsLink.classList.toggle("disabled-link", !task.vfsUrl);
  els.taskAgent.textContent = task.agent || "-";
  els.taskStatus.textContent = task.status || "-";
  els.taskDuration.textContent = formatDuration(task.duration);
  els.taskStart.textContent = task.start || "-";
  els.taskEnd.textContent = task.end || "-";
  els.taskVenueId.textContent = task.venueId || "-";
  els.taskConfigId.textContent = task.configId || "-";
  els.taskConfigName.textContent = task.configName || "-";
  els.taskIssueNotes.textContent = task.issueNotes || "No issue notes supplied.";

  document.querySelectorAll("input[name='qaDecision']").forEach((radio) => {
    radio.checked = radio.value === review.decision;
  });
  els.qaNotesInput.value = review.notes || "";
  els.prevTaskBtn.disabled = state.currentIndex === 0;
  els.nextTaskBtn.disabled = state.currentIndex === state.sample.length - 1;
}

function saveCurrentReview() {
  if (!state.sample.length) return;
  const task = state.sample[state.currentIndex];
  const decision = document.querySelector("input[name='qaDecision']:checked")?.value || "";
  const notes = els.qaNotesInput.value.trim();

  if (!decision && !notes) {
    delete state.reviews[task.key];
  } else {
    state.reviews[task.key] = {
      decision,
      notes,
      reviewedAt: new Date().toISOString(),
    };
  }
  updateDashboard();
  updateReviewCard();
  saveSession();
}

function moveTask(direction) {
  saveCurrentReview();
  const nextIndex = state.currentIndex + direction;
  if (nextIndex < 0 || nextIndex >= state.sample.length) return;
  state.currentIndex = nextIndex;
  updateReviewCard();
  saveSession();
}

function updateDashboard() {
  const reviewedTasks = getReviewedTasks();
  const errors = reviewedTasks.filter((item) => isErrorDecision(item.review.decision)).length;
  const durations = reviewedTasks.map((item) => parseFloat(item.task.duration)).filter(Number.isFinite);
  const avgDuration = durations.length ? durations.reduce((sum, value) => sum + value, 0) / durations.length : null;

  els.reviewedMetric.textContent = formatNumber(reviewedTasks.length);
  els.errorsMetric.textContent = formatNumber(errors);
  els.errorRateMetric.textContent = reviewedTasks.length ? `${Math.round((errors / reviewedTasks.length) * 100)}%` : "0%";
  els.avgDurationMetric.textContent = avgDuration === null ? "-" : `${avgDuration.toFixed(1)} min`;
  els.exportCsvBtn.disabled = !reviewedTasks.length;
  els.exportJsonBtn.disabled = !state.sample.length;

  renderAgentStats(reviewedTasks);
  renderReviewedTasks(reviewedTasks);
}

function getReviewedTasks() {
  return state.sample
    .map((task, index) => ({ task, review: state.reviews[task.key], sampleNumber: index + 1 }))
    .filter((item) => item.review?.decision || item.review?.notes);
}

function renderAgentStats(reviewedTasks) {
  if (!reviewedTasks.length) {
    els.agentStatsTable.innerHTML = `<tr><td colspan="8" class="table-empty">No QA results yet.</td></tr>`;
    return;
  }

  const byAgent = {};
  reviewedTasks.forEach(({ task, review }) => {
    byAgent[task.agent] ||= { reviewed: 0, pass: 0, errors: 0, skipped: 0, incorrectSkips: 0, durations: [] };
    const bucket = byAgent[task.agent];
    bucket.reviewed += 1;
    if (review.decision === "pass" || review.decision === "correct_skip") bucket.pass += 1;
    if (isErrorDecision(review.decision)) bucket.errors += 1;
    if (task.status.toLowerCase() === "skipped") bucket.skipped += 1;
    if (review.decision === "incorrect_skip") bucket.incorrectSkips += 1;
    const duration = parseFloat(task.duration);
    if (Number.isFinite(duration)) bucket.durations.push(duration);
  });

  els.agentStatsTable.innerHTML = Object.entries(byAgent).sort(([a], [b]) => a.localeCompare(b)).map(([agent, bucket]) => {
    const errorPct = bucket.reviewed ? `${Math.round((bucket.errors / bucket.reviewed) * 100)}%` : "0%";
    const avgDuration = bucket.durations.length
      ? `${(bucket.durations.reduce((sum, value) => sum + value, 0) / bucket.durations.length).toFixed(1)} min`
      : "-";
    return `
      <tr>
        <td><strong>${escapeHtml(agent)}</strong></td>
        <td>${bucket.reviewed}</td>
        <td>${bucket.pass}</td>
        <td>${bucket.errors}</td>
        <td>${errorPct}</td>
        <td>${bucket.skipped}</td>
        <td>${bucket.incorrectSkips}</td>
        <td>${avgDuration}</td>
      </tr>`;
  }).join("");
}

function renderReviewedTasks(reviewedTasks) {
  if (!reviewedTasks.length) {
    els.reviewedTasksTable.innerHTML = `<tr><td colspan="8" class="table-empty">No reviewed tasks yet.</td></tr>`;
    return;
  }

  els.reviewedTasksTable.innerHTML = reviewedTasks.map(({ task, review, sampleNumber }) => {
    const configCell = task.vfsUrl
      ? `<a href="${escapeHtml(task.vfsUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(task.configId || "Open")}</a>`
      : escapeHtml(task.configId || "-");
    return `
      <tr>
        <td>${sampleNumber}</td>
        <td>${escapeHtml(task.agent)}</td>
        <td>${escapeHtml(task.status)}</td>
        <td>${escapeHtml(task.venueName || "-")}</td>
        <td>${configCell}</td>
        <td>${escapeHtml(formatDuration(task.duration))}</td>
        <td>${escapeHtml(formatDecision(review.decision))}</td>
        <td>${escapeHtml(review.notes || "")}</td>
      </tr>`;
  }).join("");
}

function exportResultsCsv() {
  const reviewedTasks = getReviewedTasks();
  if (!reviewedTasks.length) return;

  const headers = [
    "sample_number", "source_row", "agent", "agent_status", "duration_minutes", "start", "end",
    "venue_name", "venue_id", "venue_config_id", "venue_config", "event_ids", "event_names",
    "agent_issue_notes", "vfs_url", "qa_decision", "qa_notes", "reviewed_at", "workbook_name", "sample_seed", "sample_mode"
  ];

  const rows = reviewedTasks.map(({ task, review, sampleNumber }) => [
    sampleNumber, task.rowNumber, task.agent, task.status, task.duration, task.start, task.end,
    task.venueName, task.venueId, task.configId, task.configName, task.eventIds, task.eventNames,
    task.issueNotes, task.vfsUrl, formatDecision(review.decision), review.notes || "", review.reviewedAt || "",
    state.workbookName, state.seed, state.sampleMode
  ]);

  downloadText(csvString([headers, ...rows]), makeExportName("vfs-qa-results", "csv"), "text/csv;charset=utf-8");
}

function exportSessionJson() {
  if (!state.sample.length) return;
  const exportState = {
    exportedAt: new Date().toISOString(),
    workbookName: state.workbookName,
    headerRowNumber: state.headerRowNumber,
    sampleMode: state.sampleMode,
    seed: state.seed,
    sample: state.sample,
    reviews: state.reviews,
  };
  downloadText(JSON.stringify(exportState, null, 2), makeExportName("vfs-qa-session", "json"), "application/json;charset=utf-8");
}

function saveSession() {
  try {
    const payload = {
      workbookName: state.workbookName,
      headerRowNumber: state.headerRowNumber,
      rawRows: state.rawRows,
      headers: state.headers,
      columnMap: state.columnMap,
      candidates: state.candidates,
      sample: state.sample,
      currentIndex: state.currentIndex,
      reviews: state.reviews,
      seed: state.seed,
      sampleMode: state.sampleMode,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn("Could not save session", error);
  }
}

function loadSavedSession() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    showWarnings(["No saved session was found in this browser."]);
    return;
  }
  try {
    const saved = JSON.parse(raw);
    Object.assign(state, saved);
    els.headerRowInput.value = state.headerRowNumber || 3;
    els.seedInput.value = state.seed || "";
    els.sampleModeInput.value = state.sampleMode || "balanced";
    showWarnings([]);
    updateAllViews();
  } catch (error) {
    showWarnings([`Could not load saved session. ${error.message || error}`]);
  }
}

function clearSavedSession() {
  localStorage.removeItem(STORAGE_KEY);
  showWarnings(["Saved browser session cleared. The uploaded source file itself was never stored outside this browser."]);
}

function showWarnings(warnings) {
  if (!warnings.length) {
    els.parseWarnings.classList.add("hidden");
    els.parseWarnings.innerHTML = "";
    return;
  }
  els.parseWarnings.classList.remove("hidden");
  els.parseWarnings.innerHTML = `<strong>Heads up:</strong><ul>${warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join("")}</ul>`;
}

function groupBy(items, key) {
  return items.reduce((acc, item) => {
    const groupKey = item[key] || "Unknown";
    acc[groupKey] ||= [];
    acc[groupKey].push(item);
    return acc;
  }, {});
}

function shuffle(items, rng) {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

function seededRandom(seedText) {
  let seed = 1779033703 ^ seedText.length;
  for (let i = 0; i < seedText.length; i += 1) {
    seed = Math.imul(seed ^ seedText.charCodeAt(i), 3432918353);
    seed = (seed << 13) | (seed >>> 19);
  }
  return function random() {
    seed = Math.imul(seed ^ (seed >>> 16), 2246822507);
    seed = Math.imul(seed ^ (seed >>> 13), 3266489909);
    seed ^= seed >>> 16;
    return (seed >>> 0) / 4294967296;
  };
}

function makeSeed() {
  return `qa-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function makeTaskKey(task) {
  return [task.rowNumber, task.agent, task.venueId, task.configId, task.status].map((part) => clean(part)).join("|");
}

function normalizeKey(value) {
  return clean(value).toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function clean(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function parsePositiveInt(value, fallback) {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-IE").format(value);
}

function formatDuration(value) {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? `${parsed.toFixed(1)} min` : (clean(value) || "-");
}

function formatDecision(value) {
  const labels = {
    pass: "Pass",
    error: "Error",
    correct_skip: "Correctly skipped",
    incorrect_skip: "Incorrectly skipped",
  };
  return labels[value] || "Not set";
}

function isErrorDecision(value) {
  return value === "error" || value === "incorrect_skip";
}

function csvString(rows) {
  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}

function csvCell(value) {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function downloadText(text, filename, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function makeExportName(base, extension) {
  const date = new Date().toISOString().slice(0, 10);
  return `${base}-${date}.${extension}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
