const STORAGE_KEY = "vfsQaToolSessionV6";

const VIEW_ORDER = ["uploadView", "sampleView", "reviewView", "dashboardView"];

const state = {
  activeView: "uploadView",
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

const REQUIRED_COLUMNS = ["agent", "status", "venueId", "configId"];

const COLUMN_ALIASES = {
  agent: ["AGENT"],
  status: ["STATUS"],
  start: ["START", "START TIME", "STARTED"],
  end: ["END", "END TIME", "ENDED"],
  duration: ["DURATION", "DURATION MIN", "DURATION MINS", "DURATION (MIN)", "DURATION_MINUTES"],
  issueNotes: ["ISSUE NOTES", "ISSUE NOTE", "NOTES", "AGENT NOTES", "ISSUE_NOTES"],
  venueName: ["VENUE_NAME", "VENUE NAME", "VENUE"],
  venueId: ["VENUE_ID", "VENUE ID", "VENUEID"],
  configId: ["VENUE_CONFIG_ID", "VENUE CONFIG ID", "CONFIG_ID", "CONFIG ID", "CONFIGID", "VENUECONFIGID"],
  configName: ["VENUE_CONFIG", "VENUE CONFIG", "CONFIG_NAME", "CONFIG NAME", "CONFIG"],
  eventIds: ["ALL_EVENT_IDS", "EVENT_ID", "EVENT IDS", "EVENT ID"],
  eventNames: ["ALL_EVENT_NAMES", "EVENT_NAME", "EVENT NAMES", "EVENT NAME"],
  taskType: ["TASK TYPE", "TASK_TYPE"],
};

const BRIGHTNESS_DEFAULT = 50;
const BRIGHTNESS_PERFECT_MIN = 45;
const BRIGHTNESS_PERFECT_MAX = 55;

const BRIGHTNESS_BUCKETS = [
  { min: 0, max: 20, label: "Too dark" },
  { min: 21, max: 44, label: "Slightly too dark" },
  { min: 45, max: 55, label: "Perfect" },
  { min: 56, max: 79, label: "Slightly too bright" },
  { min: 80, max: 100, label: "Too bright" },
];

document.addEventListener("DOMContentLoaded", () => {
  cacheElements();
  attachEvents();
  updateAllViews();
});

function cacheElements() {
  const ids = [
    "fileInput", "dropZone", "fileStatus", "headerRowInput", "sampleSizeInput", "sampleModeInput", "seedInput",
    "generateSampleBtn", "reshuffleBtn", "parseWarnings", "totalRowsMetric", "candidateRowsMetric",
    "doneRowsMetric", "skippedRowsMetric", "agentBreakdown", "reviewProgress", "reviewProgressBar", "reviewEmpty", "taskCard",
    "taskCounter", "taskTitle", "vfsLink", "taskAgent", "taskStatus", "taskDuration", "taskStart", "taskEnd",
    "taskVenueId", "taskConfigId", "taskConfigName", "taskIssueNotes", "qaNotesInput", "brightnessSlider",
    "brightnessValue", "brightnessHint", "prevTaskBtn", "saveReviewBtn", "nextTaskBtn", "reviewedMetric",
    "errorsMetric", "errorRateMetric", "avgDurationMetric", "brightnessIssueMetric", "avgBrightnessMetric", "decisionChart",
    "agentErrorChart", "brightnessChart", "lightingScoreChart", "durationChart", "qualitySignalInsight", "lightingSignalInsight", "trainingWatchInsight", "agentStatsTable", "reviewedTasksTable",
    "exportCsvBtn", "exportJsonBtn", "loadSavedBtn", "clearSavedBtn",
    "goSampleBtn", "startReviewBtn", "goDashboardBtn", "backUploadBtn", "backSampleBtn", "backReviewBtn", "restartBtn",
    "sampleWorkbookName", "sampleCandidateCount", "sampleSelectedCount", "sampleModeLabel", "sampleRosterTable", "toast"
  ];

  ids.forEach((id) => {
    els[id] = document.getElementById(id);
  });
}

function attachEvents() {
  els.fileInput?.addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (file) handleFile(file);
  });

  setupDropZone();

  els.headerRowInput?.addEventListener("change", () => {
    state.headerRowNumber = parsePositiveInt(els.headerRowInput.value, 3);
    if (state.rawRows.length) processRows();
  });

  els.sampleSizeInput?.addEventListener("input", () => updateSampleSummary());
  els.sampleModeInput?.addEventListener("change", () => {
    state.sampleMode = els.sampleModeInput.value;
    updateSampleSummary();
  });
  els.seedInput?.addEventListener("input", () => {
    state.seed = els.seedInput.value.trim();
  });

  els.goSampleBtn?.addEventListener("click", () => setView("sampleView"));
  els.backUploadBtn?.addEventListener("click", () => setView("uploadView"));
  els.backSampleBtn?.addEventListener("click", () => setView("sampleView"));
  els.backReviewBtn?.addEventListener("click", () => setView("reviewView"));
  els.startReviewBtn?.addEventListener("click", () => setView("reviewView"));
  els.goDashboardBtn?.addEventListener("click", () => setView("dashboardView"));
  els.restartBtn?.addEventListener("click", startOver);

  els.generateSampleBtn?.addEventListener("click", () => generateSample(false));
  els.reshuffleBtn?.addEventListener("click", () => generateSample(true));

  els.prevTaskBtn?.addEventListener("click", () => moveTask(-1));
  els.nextTaskBtn?.addEventListener("click", () => moveTask(1));
  els.saveReviewBtn?.addEventListener("click", () => {
    saveCurrentReview();
    showToast("QA result saved.");
  });

  document.querySelectorAll("input[name='qaDecision']").forEach((radio) => {
    radio.addEventListener("change", () => {
      saveCurrentReview();
      updateReviewCard();
    });
  });

  els.qaNotesInput?.addEventListener("blur", saveCurrentReview);
  els.brightnessSlider?.addEventListener("input", () => {
    updateBrightnessControl(parseBrightness(els.brightnessSlider.value));
    saveCurrentReview();
  });
  els.exportCsvBtn?.addEventListener("click", exportResultsCsv);
  els.exportJsonBtn?.addEventListener("click", exportSessionJson);
  els.loadSavedBtn?.addEventListener("click", loadSavedSession);
  els.clearSavedBtn?.addEventListener("click", clearSavedSession);

  document.querySelectorAll(".step-button[data-view]").forEach((button) => {
    button.addEventListener("click", () => setView(button.dataset.view));
  });
}

function setupDropZone() {
  if (!els.dropZone) return;

  ["dragenter", "dragover"].forEach((eventName) => {
    els.dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      els.dropZone.classList.add("is-dragover");
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    els.dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      els.dropZone.classList.remove("is-dragover");
    });
  });

  els.dropZone.addEventListener("drop", (event) => {
    const file = event.dataTransfer?.files?.[0];
    if (file) handleFile(file);
  });
}

async function handleFile(file) {
  try {
    showWarnings([]);
    setFileStatus(`Reading ${file.name}...`, "muted");
    const rows = await readWorkbookRows(file);

    resetStateForNewWorkbook(file.name, rows);
    processRows();

    if (state.candidates.length) {
      showToast(`Loaded ${formatNumber(state.candidates.length)} QA candidates.`);
      setView("uploadView");
    }
  } catch (error) {
    setFileStatus("Could not read file", "bad");
    showWarnings([`Could not read the file. ${error.message || error}`]);
  }
}

async function readWorkbookRows(file) {
  const extension = file.name.split(".").pop().toLowerCase();
  const buffer = await file.arrayBuffer();

  if (extension === "csv") {
    return parseCsv(textFromBuffer(buffer));
  }

  await ensureXlsxLoaded();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: false, raw: false });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  return XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: "",
    raw: false,
    blankrows: true,
  });
}

function textFromBuffer(buffer) {
  let text = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
  if (text.includes("\uFFFD")) {
    try {
      text = new TextDecoder("windows-1252", { fatal: false }).decode(buffer);
    } catch (error) {
      // Keep the UTF-8-decoded version if the browser does not support windows-1252.
    }
  }
  return text.replace(/^\uFEFF/, "");
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      if (char === "\r" && next === "\n") i += 1;
    } else {
      cell += char;
    }
  }

  row.push(cell);
  rows.push(row);

  if (rows.length && rows[rows.length - 1].every((value) => clean(value) === "")) {
    rows.pop();
  }

  return rows;
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
  state.sampleMode = els.sampleModeInput.value || "balanced";
  els.seedInput.value = state.seed;
}

function processRows() {
  const warnings = [];
  let headerIndex = Math.max(0, state.headerRowNumber - 1);
  let headerRow = state.rawRows[headerIndex] || [];
  let headers = makeHeaders(headerRow);
  let columnMap = detectColumns(headers);

  if (!hasRequiredColumns(columnMap)) {
    const detectedIndex = detectHeaderRowIndex(state.rawRows);
    if (detectedIndex !== -1 && detectedIndex !== headerIndex) {
      headerIndex = detectedIndex;
      state.headerRowNumber = detectedIndex + 1;
      els.headerRowInput.value = state.headerRowNumber;
      headerRow = state.rawRows[headerIndex] || [];
      headers = makeHeaders(headerRow);
      columnMap = detectColumns(headers);
      warnings.push(`Auto-detected row ${state.headerRowNumber} as the task header row.`);
    }
  }

  state.headers = headers;
  state.columnMap = columnMap;
  state.candidates = [];
  state.sample = [];
  state.currentIndex = 0;
  state.reviews = {};

  REQUIRED_COLUMNS.forEach((key) => {
    if (state.columnMap[key] === -1) {
      warnings.push(`Could not detect required column: ${key}. Detected headers: ${state.headers.slice(0, 18).join(" | ") || "none"}`);
    }
  });

  for (let rowIndex = headerIndex + 1; rowIndex < state.rawRows.length; rowIndex += 1) {
    const row = state.rawRows[rowIndex] || [];
    const task = buildTask(row, rowIndex + 1);
    const status = task.status.toLowerCase();
    if (task.agent && (status === "done" || status === "skipped")) {
      state.candidates.push(task);
    }
  }

  if (!state.candidates.length && state.rawRows.length && hasRequiredColumns(state.columnMap)) {
    warnings.push("No QA candidates found. Candidates need an agent name and a status of Done or Skipped.");
  }

  showWarnings(warnings);
  updateAllViews();
  saveSession();
}

function detectHeaderRowIndex(rows) {
  let best = { index: -1, score: -1 };
  const maxRows = Math.min(rows.length, 30);

  for (let i = 0; i < maxRows; i += 1) {
    const headers = makeHeaders(rows[i] || []);
    const columnMap = detectColumns(headers);
    const score = REQUIRED_COLUMNS.reduce((total, key) => total + (columnMap[key] >= 0 ? 1 : 0), 0);
    if (score > best.score) best = { index: i, score };
    if (score === REQUIRED_COLUMNS.length) return i;
  }

  return best.score >= 3 ? best.index : -1;
}

function hasRequiredColumns(columnMap) {
  return REQUIRED_COLUMNS.every((key) => columnMap[key] >= 0);
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
  return Object.fromEntries(Object.entries(COLUMN_ALIASES).map(([key, aliases]) => [key, findColumn(headers, aliases, key)]));
}

function findColumn(headers, aliases, key) {
  const normalizedAliases = aliases.map(normalizeKey);
  for (let i = 0; i < headers.length; i += 1) {
    const normalizedHeader = normalizeKey(headers[i]);
    if (normalizedAliases.includes(normalizedHeader)) return i;
  }

  if (key === "agent" && headers.length > 0) return 0;
  if (key === "status" && headers.length > 1) return 1;
  return -1;
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

  if (!sampleSize) {
    showToast("No candidate tasks available yet.");
    return;
  }

  if (state.sampleMode === "proportional") {
    state.sample = proportionalSample(state.candidates, sampleSize, state.seed);
  } else if (state.sampleMode === "random") {
    state.sample = shuffle([...state.candidates], seededRandom(state.seed)).slice(0, sampleSize);
  } else {
    state.sample = balancedSample(state.candidates, sampleSize, state.seed);
  }

  state.currentIndex = 0;
  state.reviews = {};
  updateAllViews();
  saveSession();
  setView("sampleView");
  showToast(`Sample generated: ${state.sample.length} tasks.`);
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

  for (let i = 0; allocated < sampleSize && i < remainders.length; i += 1) {
    quotas[remainders[i].agent] += 1;
    allocated += 1;
  }

  const selected = [];
  agents.forEach((agent) => {
    selected.push(...shuffle([...groups[agent]], rng).slice(0, quotas[agent]));
  });

  return shuffle(selected, rng).slice(0, sampleSize);
}

function setView(viewId) {
  if (!VIEW_ORDER.includes(viewId)) return;
  if (!isViewUnlocked(viewId)) return;

  state.activeView = viewId;
  document.querySelectorAll(".view").forEach((view) => {
    view.classList.toggle("is-active", view.id === viewId);
  });
  document.querySelectorAll(".step-button[data-view]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.view === viewId);
  });
  saveSession();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function isViewUnlocked(viewId) {
  if (viewId === "uploadView") return true;
  if (viewId === "sampleView") return state.candidates.length > 0;
  if (viewId === "reviewView") return state.sample.length > 0;
  if (viewId === "dashboardView") return state.sample.length > 0;
  return false;
}

function updateAllViews() {
  updateStepper();
  updateUploadOverview();
  updateSampleSummary();
  updateSampleRoster();
  updateReviewCard();
  updateDashboard();

  if (!isViewUnlocked(state.activeView)) {
    state.activeView = state.sample.length ? "reviewView" : state.candidates.length ? "sampleView" : "uploadView";
  }

  document.querySelectorAll(".view").forEach((view) => {
    view.classList.toggle("is-active", view.id === state.activeView);
  });
  document.querySelectorAll(".step-button[data-view]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.view === state.activeView);
  });
}

function updateStepper() {
  const unlocks = {
    uploadView: true,
    sampleView: state.candidates.length > 0,
    reviewView: state.sample.length > 0,
    dashboardView: state.sample.length > 0,
  };

  document.querySelectorAll(".step-button[data-view]").forEach((button) => {
    button.disabled = !unlocks[button.dataset.view];
    button.classList.toggle("is-complete", isStepComplete(button.dataset.view));
  });
}

function isStepComplete(viewId) {
  if (viewId === "uploadView") return state.candidates.length > 0;
  if (viewId === "sampleView") return state.sample.length > 0;
  if (viewId === "reviewView") return getReviewedTasks().length === state.sample.length && state.sample.length > 0;
  if (viewId === "dashboardView") return getReviewedTasks().length > 0;
  return false;
}

function updateUploadOverview() {
  els.headerRowInput.value = state.headerRowNumber || 3;
  els.sampleModeInput.value = state.sampleMode || "balanced";
  els.seedInput.value = state.seed || "";

  if (state.workbookName) {
    setFileStatus(state.workbookName, state.candidates.length ? "good" : "muted");
  } else {
    setFileStatus("No file loaded", "muted");
  }

  const totalRows = Math.max(0, state.rawRows.length - (state.headerRowNumber || 3));
  const doneRows = state.candidates.filter((task) => task.status.toLowerCase() === "done").length;
  const skippedRows = state.candidates.filter((task) => task.status.toLowerCase() === "skipped").length;

  els.totalRowsMetric.textContent = state.rawRows.length ? formatNumber(totalRows) : "-";
  els.candidateRowsMetric.textContent = state.rawRows.length ? formatNumber(state.candidates.length) : "-";
  els.doneRowsMetric.textContent = state.rawRows.length ? formatNumber(doneRows) : "-";
  els.skippedRowsMetric.textContent = state.rawRows.length ? formatNumber(skippedRows) : "-";

  els.generateSampleBtn.disabled = !state.candidates.length;
  els.reshuffleBtn.disabled = !state.candidates.length;
  els.goSampleBtn.disabled = !state.candidates.length;

  renderAgentBreakdown();
}

function renderAgentBreakdown() {
  if (!state.candidates.length) {
    els.agentBreakdown.innerHTML = "Upload a file to see agent counts.";
    els.agentBreakdown.classList.add("empty-state");
    return;
  }

  els.agentBreakdown.classList.remove("empty-state");
  const byAgent = groupBy(state.candidates, "agent");
  const rows = Object.entries(byAgent)
    .sort(([, a], [, b]) => b.length - a.length)
    .map(([agent, tasks]) => {
      const done = tasks.filter((task) => task.status.toLowerCase() === "done").length;
      const skipped = tasks.filter((task) => task.status.toLowerCase() === "skipped").length;
      return `<div class="agent-row"><strong>${escapeHtml(agent)}</strong><span>${tasks.length} tasks</span><small>${done} done / ${skipped} skipped</small></div>`;
    })
    .join("");

  els.agentBreakdown.innerHTML = rows;
}

function updateSampleSummary() {
  const modeLabels = {
    balanced: "Balanced",
    proportional: "Proportional",
    random: "Random",
  };
  els.sampleWorkbookName.textContent = state.workbookName || "-";
  els.sampleCandidateCount.textContent = formatNumber(state.candidates.length || 0);
  els.sampleSelectedCount.textContent = formatNumber(state.sample.length || 0);
  els.sampleModeLabel.textContent = modeLabels[els.sampleModeInput?.value || state.sampleMode] || "Balanced";
  els.startReviewBtn.disabled = !state.sample.length;
}

function updateSampleRoster() {
  if (!state.sample.length) {
    els.sampleRosterTable.innerHTML = `<tr><td colspan="7" class="table-empty">Generate a sample to preview the tasks here.</td></tr>`;
    return;
  }

  els.sampleRosterTable.innerHTML = state.sample.map((task, index) => {
    const noteText = task.issueNotes ? task.issueNotes : "-";
    return `
      <tr>
        <td>${index + 1}</td>
        <td><strong>${escapeHtml(task.agent || "-")}</strong></td>
        <td><span class="mini-pill ${task.status.toLowerCase() === "skipped" ? "skip" : "done"}">${escapeHtml(task.status || "-")}</span></td>
        <td>${escapeHtml(task.venueName || "-")}</td>
        <td>${task.vfsUrl ? `<a href="${escapeHtml(task.vfsUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(task.configId || "Open")}</a>` : escapeHtml(task.configId || "-")}</td>
        <td>${escapeHtml(formatDuration(task.duration))}</td>
        <td title="${escapeHtml(noteText)}">${escapeHtml(truncate(noteText, 70))}</td>
      </tr>`;
  }).join("");
}

function updateReviewCard() {
  const hasSample = state.sample.length > 0;
  els.reviewEmpty.classList.toggle("hidden", hasSample);
  els.taskCard.classList.toggle("hidden", !hasSample);
  els.goDashboardBtn.disabled = !hasSample;
  els.exportJsonBtn.disabled = !hasSample;

  if (!hasSample) {
    els.reviewProgress.textContent = "No sample";
    els.reviewProgressBar.style.width = "0%";
    return;
  }

  if (state.currentIndex < 0) state.currentIndex = 0;
  if (state.currentIndex >= state.sample.length) state.currentIndex = state.sample.length - 1;

  const task = state.sample[state.currentIndex];
  const review = state.reviews[task.key] || { decision: "", notes: "", brightness: BRIGHTNESS_DEFAULT };
  const reviewedCount = getReviewedTasks().length;
  const progressPct = Math.round((reviewedCount / state.sample.length) * 100);

  els.reviewProgress.textContent = `${reviewedCount}/${state.sample.length} reviewed`;
  els.reviewProgressBar.style.width = `${progressPct}%`;
  els.taskCounter.textContent = `Task ${state.currentIndex + 1} of ${state.sample.length}`;
  els.taskTitle.textContent = task.venueName ? `${task.venueName}` : `Venue ${task.venueId || "-"}`;
  els.vfsLink.href = task.vfsUrl || "#";
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
  els.qaNotesInput.value = review.notes || "";
  updateBrightnessControl(parseBrightness(review.brightness));

  document.querySelectorAll("input[name='qaDecision']").forEach((radio) => {
    radio.checked = radio.value === review.decision;
    radio.closest("label")?.classList.toggle("is-selected", radio.checked);
  });

  els.prevTaskBtn.disabled = state.currentIndex === 0;
  els.nextTaskBtn.disabled = state.currentIndex === state.sample.length - 1;
}

function saveCurrentReview() {
  if (!state.sample.length) return;

  const task = state.sample[state.currentIndex];
  const existing = state.reviews[task.key] || {};
  const decision = document.querySelector("input[name='qaDecision']:checked")?.value || "";
  const notes = els.qaNotesInput.value.trim();
  const brightness = parseBrightness(els.brightnessSlider?.value ?? existing.brightness ?? BRIGHTNESS_DEFAULT);

  if (!decision && !notes && brightness === BRIGHTNESS_DEFAULT) {
    delete state.reviews[task.key];
  } else {
    state.reviews[task.key] = {
      decision,
      notes,
      brightness,
      reviewedAt: existing.reviewedAt && existing.decision === decision && existing.notes === notes && parseBrightness(existing.brightness) === brightness
        ? existing.reviewedAt
        : new Date().toISOString(),
    };
  }

  updateDashboard();
  updateStepper();
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
  const brightnessScores = reviewedTasks.map((item) => parseBrightness(item.review.brightness)).filter(Number.isFinite);
  const avgBrightness = brightnessScores.length ? brightnessScores.reduce((sum, value) => sum + value, 0) / brightnessScores.length : null;
  const brightnessIssues = reviewedTasks.filter((item) => !isBrightnessPerfect(item.review.brightness)).length;

  els.reviewedMetric.textContent = formatNumber(reviewedTasks.length);
  els.errorsMetric.textContent = formatNumber(errors);
  els.errorRateMetric.textContent = reviewedTasks.length ? `${Math.round((errors / reviewedTasks.length) * 100)}%` : "0%";
  els.avgDurationMetric.textContent = avgDuration === null ? "-" : `${avgDuration.toFixed(1)} min`;
  if (els.brightnessIssueMetric) els.brightnessIssueMetric.textContent = formatNumber(brightnessIssues);
  if (els.avgBrightnessMetric) els.avgBrightnessMetric.textContent = avgBrightness === null ? "-" : formatBrightness(avgBrightness);
  els.exportCsvBtn.disabled = !reviewedTasks.length;
  els.exportJsonBtn.disabled = !state.sample.length;

  renderAgentStats(reviewedTasks);
  renderReviewedTasks(reviewedTasks);
  renderDashboardInsights(reviewedTasks, { errors, avgDuration, avgBrightness, brightnessIssues });
  renderDashboardCharts(reviewedTasks);
}

function getReviewedTasks() {
  return state.sample
    .map((task, index) => ({ task, review: state.reviews[task.key], sampleNumber: index + 1 }))
    .filter((item) => item.review?.decision || item.review?.notes || parseBrightness(item.review?.brightness ?? BRIGHTNESS_DEFAULT) !== BRIGHTNESS_DEFAULT);
}

function renderAgentStats(reviewedTasks) {
  if (!reviewedTasks.length) {
    els.agentStatsTable.innerHTML = `<tr><td colspan="10" class="table-empty">No QA results yet.</td></tr>`;
    return;
  }

  const byAgent = {};
  reviewedTasks.forEach(({ task, review }) => {
    byAgent[task.agent] ||= { reviewed: 0, pass: 0, errors: 0, skipped: 0, incorrectSkips: 0, brightnessIssues: 0, durations: [], brightnessScores: [] };
    const bucket = byAgent[task.agent];
    bucket.reviewed += 1;
    if (review.decision === "pass" || review.decision === "correct_skip") bucket.pass += 1;
    if (isErrorDecision(review.decision)) bucket.errors += 1;
    if (task.status.toLowerCase() === "skipped") bucket.skipped += 1;
    if (review.decision === "incorrect_skip") bucket.incorrectSkips += 1;
    const brightnessScore = parseBrightness(review.brightness);
    if (!isBrightnessPerfect(brightnessScore)) bucket.brightnessIssues += 1;
    bucket.brightnessScores.push(brightnessScore);
    const duration = parseFloat(task.duration);
    if (Number.isFinite(duration)) bucket.durations.push(duration);
  });

  els.agentStatsTable.innerHTML = Object.entries(byAgent).sort(([a], [b]) => a.localeCompare(b)).map(([agent, bucket]) => {
    const errorPct = bucket.reviewed ? `${Math.round((bucket.errors / bucket.reviewed) * 100)}%` : "0%";
    const avgDuration = bucket.durations.length
      ? `${(bucket.durations.reduce((sum, value) => sum + value, 0) / bucket.durations.length).toFixed(1)} min`
      : "-";
    const avgBrightness = bucket.brightnessScores.length
      ? formatBrightness(bucket.brightnessScores.reduce((sum, value) => sum + value, 0) / bucket.brightnessScores.length)
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
        <td>${bucket.brightnessIssues}</td>
        <td>${avgBrightness}</td>
        <td>${avgDuration}</td>
      </tr>`;
  }).join("");
}

function renderReviewedTasks(reviewedTasks) {
  if (!reviewedTasks.length) {
    els.reviewedTasksTable.innerHTML = `<tr><td colspan="9" class="table-empty">No reviewed tasks yet.</td></tr>`;
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
        <td><span class="mini-pill ${isErrorDecision(review.decision) ? "error" : "done"}">${escapeHtml(formatDecision(review.decision))}</span></td>
        <td>${escapeHtml(formatBrightness(review.brightness))}</td>
        <td>${escapeHtml(review.notes || "")}</td>
      </tr>`;
  }).join("");
}

function renderDashboardInsights(reviewedTasks, summary) {
  if (!els.qualitySignalInsight || !els.lightingSignalInsight || !els.trainingWatchInsight) return;

  if (!reviewedTasks.length) {
    els.qualitySignalInsight.textContent = "No reviews yet";
    els.lightingSignalInsight.textContent = "No lighting scores yet";
    els.trainingWatchInsight.textContent = "No agents flagged";
    return;
  }

  const errorRate = Math.round((summary.errors / reviewedTasks.length) * 100);
  els.qualitySignalInsight.textContent = `${errorRate}% error rate across ${reviewedTasks.length} reviewed`;

  if (summary.avgBrightness === null) {
    els.lightingSignalInsight.textContent = "No lighting scores yet";
  } else {
    const delta = Math.abs(summary.avgBrightness - BRIGHTNESS_DEFAULT).toFixed(1);
    els.lightingSignalInsight.textContent = `${formatBrightness(summary.avgBrightness)} | ${delta} from perfect`;
  }

  const byAgent = {};
  reviewedTasks.forEach(({ task, review }) => {
    byAgent[task.agent] ||= { reviewed: 0, errors: 0, brightnessScores: [], durations: [] };
    byAgent[task.agent].reviewed += 1;
    if (isErrorDecision(review.decision)) byAgent[task.agent].errors += 1;
    byAgent[task.agent].brightnessScores.push(parseBrightness(review.brightness));
    const duration = parseFloat(task.duration);
    if (Number.isFinite(duration)) byAgent[task.agent].durations.push(duration);
  });

  const ranked = Object.entries(byAgent).map(([agent, bucket]) => {
    const errorRateValue = bucket.reviewed ? (bucket.errors / bucket.reviewed) * 100 : 0;
    const avgBrightness = bucket.brightnessScores.length
      ? bucket.brightnessScores.reduce((sum, value) => sum + value, 0) / bucket.brightnessScores.length
      : BRIGHTNESS_DEFAULT;
    const lightingDrift = Math.abs(avgBrightness - BRIGHTNESS_DEFAULT);
    const avgDuration = bucket.durations.length
      ? bucket.durations.reduce((sum, value) => sum + value, 0) / bucket.durations.length
      : 0;
    return { agent, errorRateValue, lightingDrift, avgDuration, reviewed: bucket.reviewed };
  }).sort((a, b) => (b.errorRateValue + b.lightingDrift) - (a.errorRateValue + a.lightingDrift));

  const watch = ranked[0];
  els.trainingWatchInsight.textContent = watch
    ? `${watch.agent}: ${Math.round(watch.errorRateValue)}% errors, ${watch.lightingDrift.toFixed(1)} lighting drift`
    : "No agents flagged";
}

function renderDashboardCharts(reviewedTasks) {
  renderDecisionChart(reviewedTasks);
  renderAgentErrorChart(reviewedTasks);
  renderBrightnessChart(reviewedTasks);
  renderLightingScoreChart(reviewedTasks);
  renderDurationChart(reviewedTasks);
}

function renderDecisionChart(reviewedTasks) {
  const labels = [
    ["pass", "Pass"],
    ["error", "Error"],
    ["correct_skip", "Correct skip"],
    ["incorrect_skip", "Incorrect skip"],
  ];
  const items = labels.map(([key, label]) => ({
    label,
    value: reviewedTasks.filter((item) => item.review.decision === key).length,
  }));
  renderDonutChart(els.decisionChart, items, { total: reviewedTasks.length, centerLabel: "QA", suffix: "tasks" });
}

function renderAgentErrorChart(reviewedTasks) {
  const byAgent = {};
  reviewedTasks.forEach(({ task, review }) => {
    byAgent[task.agent] ||= { reviewed: 0, errors: 0 };
    byAgent[task.agent].reviewed += 1;
    if (isErrorDecision(review.decision)) byAgent[task.agent].errors += 1;
  });

  const items = Object.entries(byAgent).sort(([a], [b]) => a.localeCompare(b)).map(([agent, bucket]) => ({
    label: agent,
    value: bucket.reviewed ? Math.round((bucket.errors / bucket.reviewed) * 100) : 0,
    detail: `${bucket.errors}/${bucket.reviewed} errors`,
  }));

  renderBarChart(els.agentErrorChart, items, { max: 100, suffix: "%", tone: "danger" });
}

function renderBrightnessChart(reviewedTasks) {
  const items = BRIGHTNESS_BUCKETS.map((bucket) => ({
    label: `${bucket.label} (${bucket.min}-${bucket.max})`,
    value: reviewedTasks.filter((item) => {
      const score = parseBrightness(item.review.brightness);
      return score >= bucket.min && score <= bucket.max;
    }).length,
  }));
  renderBarChart(els.brightnessChart, items, { total: reviewedTasks.length, suffix: "tasks", tone: "spectrum" });
}

function renderLightingScoreChart(reviewedTasks) {
  const byAgent = {};
  reviewedTasks.forEach(({ task, review }) => {
    byAgent[task.agent] ||= [];
    byAgent[task.agent].push(parseBrightness(review.brightness));
  });

  const items = Object.entries(byAgent).sort(([a], [b]) => a.localeCompare(b)).map(([agent, scores]) => {
    const average = scores.reduce((sum, value) => sum + value, 0) / scores.length;
    return { label: agent, value: Number(average.toFixed(1)), detail: formatBrightness(average) };
  });

  renderScoreChart(els.lightingScoreChart, items, { ideal: BRIGHTNESS_DEFAULT });
}

function renderDurationChart(reviewedTasks) {
  const byAgent = {};
  reviewedTasks.forEach(({ task }) => {
    const duration = parseFloat(task.duration);
    if (!Number.isFinite(duration)) return;
    byAgent[task.agent] ||= [];
    byAgent[task.agent].push(duration);
  });

  const items = Object.entries(byAgent).sort(([a], [b]) => a.localeCompare(b)).map(([agent, durations]) => {
    const average = durations.reduce((sum, value) => sum + value, 0) / durations.length;
    return { label: agent, value: Number(average.toFixed(1)), detail: `${average.toFixed(1)} min` };
  });

  renderBarChart(els.durationChart, items, { suffix: " min", tone: "duration" });
}

function renderDonutChart(container, items, options = {}) {
  if (!container) return;
  const total = Number.isFinite(options.total) ? options.total : items.reduce((sum, item) => sum + (Number(item.value) || 0), 0);
  const positiveItems = items.filter((item) => Number(item.value) > 0);

  if (!items.length || !total || !positiveItems.length) {
    container.classList.remove("donut-chart");
    container.classList.add("empty-chart");
    container.textContent = "No QA results yet.";
    return;
  }

  container.classList.remove("empty-chart");
  container.classList.add("donut-chart");

  let offset = 25;
  const circumference = 100;
  const rings = positiveItems.map((item, index) => {
    const value = Number(item.value) || 0;
    const dash = (value / total) * circumference;
    const html = `<circle class="donut-segment segment-${index % 5}" cx="21" cy="21" r="15.915" fill="transparent" stroke-width="7" stroke-dasharray="${dash} ${circumference - dash}" stroke-dashoffset="${offset}"></circle>`;
    offset -= dash;
    return html;
  }).join("");

  const legend = items.map((item, index) => {
    const value = Number(item.value) || 0;
    const pct = total ? Math.round((value / total) * 100) : 0;
    return `<div class="donut-legend-item"><span class="legend-dot segment-${index % 5}"></span><strong>${escapeHtml(item.label)}</strong><em>${value} ${options.suffix || ""} · ${pct}%</em></div>`;
  }).join("");

  container.innerHTML = `
    <div class="donut-wrap">
      <svg viewBox="0 0 42 42" role="img" aria-label="${escapeHtml(options.centerLabel || "Chart")}">
        <circle class="donut-bg" cx="21" cy="21" r="15.915" fill="transparent" stroke-width="7"></circle>
        ${rings}
      </svg>
      <div class="donut-center"><strong>${total}</strong><span>${escapeHtml(options.centerLabel || "Total")}</span></div>
    </div>
    <div class="donut-legend">${legend}</div>`;
}

function renderScoreChart(container, items, options = {}) {
  if (!container) return;
  if (!items.length) {
    container.classList.remove("donut-chart");
    container.classList.add("empty-chart");
    container.textContent = "No QA results yet.";
    return;
  }

  container.classList.remove("empty-chart");
  container.classList.remove("donut-chart");
  const ideal = Number.isFinite(options.ideal) ? options.ideal : 50;

  container.innerHTML = `
    <div class="score-scale" aria-hidden="true"><span>Dark</span><span>Perfect</span><span>Bright</span></div>
    ${items.map((item) => {
      const value = Math.max(0, Math.min(100, Number(item.value) || 0));
      const drift = Math.abs(value - ideal).toFixed(1);
      return `
        <div class="score-row">
          <div class="chart-label" title="${escapeHtml(item.label)}">${escapeHtml(item.label)}</div>
          <div class="score-track"><span class="ideal-marker" style="left:${ideal}%"></span><span class="score-marker" style="left:${value}%"></span></div>
          <div class="chart-value">${escapeHtml(item.detail || String(value))} · ${drift} drift</div>
        </div>`;
    }).join("")}`;
}

function renderBarChart(container, items, options = {}) {
  if (!container) return;
  const positiveItems = items.filter((item) => Number(item.value) > 0);
  const maxValue = Number.isFinite(options.max)
    ? options.max
    : Math.max(1, ...items.map((item) => Number(item.value) || 0));

  if (!items.length || (!positiveItems.length && options.total === 0)) {
    container.classList.remove("donut-chart");
    container.classList.add("empty-chart");
    container.textContent = "No QA results yet.";
    return;
  }

  container.classList.remove("empty-chart");
  container.classList.remove("donut-chart");
  container.dataset.tone = options.tone || "default";
  container.innerHTML = items.map((item) => {
    const value = Number(item.value) || 0;
    const pct = Math.max(0, Math.min(100, (value / maxValue) * 100));
    const valueLabel = item.detail || `${value}${options.suffix ? ` ${options.suffix}` : ""}`.replace(" %", "%");
    return `
      <div class="chart-row" style="--pct:${pct}%">
        <div class="chart-label" title="${escapeHtml(item.label)}">${escapeHtml(item.label)}</div>
        <div class="chart-bar-track" aria-hidden="true"><span style="width:${pct}%"></span></div>
        <div class="chart-value">${escapeHtml(valueLabel)}</div>
      </div>`;
  }).join("");
}

function exportResultsCsv() {
  const reviewedTasks = getReviewedTasks();
  if (!reviewedTasks.length) return;

  const headers = [
    "sample_number", "source_row", "agent", "agent_status", "duration_minutes", "start", "end",
    "venue_name", "venue_id", "venue_config_id", "venue_config", "event_ids", "event_names",
    "agent_issue_notes", "vfs_url", "qa_decision", "brightness_score", "brightness_rating", "qa_notes", "reviewed_at", "workbook_name", "sample_seed", "sample_mode"
  ];

  const rows = reviewedTasks.map(({ task, review, sampleNumber }) => [
    sampleNumber, task.rowNumber, task.agent, task.status, task.duration, task.start, task.end,
    task.venueName, task.venueId, task.configId, task.configName, task.eventIds, task.eventNames,
    task.issueNotes, task.vfsUrl, formatDecision(review.decision), parseBrightness(review.brightness), getBrightnessLabel(review.brightness), review.notes || "", review.reviewedAt || "",
    state.workbookName, state.seed, state.sampleMode
  ]);

  downloadText(csvString([headers, ...rows]), makeExportName("vfs-qa-results", "csv"), "text/csv;charset=utf-8");
  showToast("QA CSV exported.");
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
  showToast("Session JSON exported.");
}

function saveSession() {
  try {
    const payload = {
      activeView: state.activeView,
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
    showToast("Saved session loaded.");
  } catch (error) {
    showWarnings([`Could not load saved session. ${error.message || error}`]);
  }
}

function clearSavedSession() {
  localStorage.removeItem(STORAGE_KEY);
  showToast("Saved browser session cleared.");
}

function startOver() {
  state.activeView = "uploadView";
  state.workbookName = "";
  state.headerRowNumber = 3;
  state.rawRows = [];
  state.headers = [];
  state.columnMap = {};
  state.candidates = [];
  state.sample = [];
  state.currentIndex = 0;
  state.reviews = {};
  state.seed = "";
  state.sampleMode = "balanced";

  if (els.fileInput) els.fileInput.value = "";
  localStorage.removeItem(STORAGE_KEY);
  showWarnings([]);
  updateAllViews();
  setView("uploadView");
  showToast("Started a fresh QA session.");
}

function setFileStatus(text, tone) {
  if (!els.fileStatus) return;
  els.fileStatus.textContent = text;
  els.fileStatus.classList.toggle("muted", tone === "muted");
  els.fileStatus.classList.toggle("bad", tone === "bad");
}

function showWarnings(warnings) {
  if (!els.parseWarnings) return;
  if (!warnings.length) {
    els.parseWarnings.classList.add("hidden");
    els.parseWarnings.innerHTML = "";
    return;
  }
  els.parseWarnings.classList.remove("hidden");
  els.parseWarnings.innerHTML = `<strong>Heads up:</strong><ul>${warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join("")}</ul>`;
}

function showToast(message) {
  if (!els.toast) return;
  els.toast.textContent = message;
  els.toast.classList.remove("hidden");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    els.toast.classList.add("hidden");
  }, 2600);
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

function parseBrightness(value) {
  const parsed = parseFloat(value);
  if (!Number.isFinite(parsed)) return BRIGHTNESS_DEFAULT;
  return Math.max(0, Math.min(100, Math.round(parsed)));
}

function getBrightnessLabel(value) {
  const score = parseBrightness(value);
  const bucket = BRIGHTNESS_BUCKETS.find((item) => score >= item.min && score <= item.max);
  return bucket?.label || "Perfect";
}

function isBrightnessPerfect(value) {
  const score = parseBrightness(value);
  return score >= BRIGHTNESS_PERFECT_MIN && score <= BRIGHTNESS_PERFECT_MAX;
}

function formatBrightness(value) {
  const score = parseBrightness(value);
  return `${score} (${getBrightnessLabel(score)})`;
}

function updateBrightnessControl(value) {
  const brightness = parseBrightness(value);
  const label = getBrightnessLabel(brightness);
  if (els.brightnessSlider) els.brightnessSlider.value = String(brightness);
  if (els.brightnessValue) els.brightnessValue.textContent = formatBrightness(brightness);
  if (els.brightnessHint) els.brightnessHint.textContent = `0 = too dark, 50 = ideal, 100 = too bright. Current guide: ${label}.`;
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

function truncate(value, limit) {
  const text = clean(value);
  return text.length > limit ? `${text.slice(0, limit - 1)}...` : text;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
