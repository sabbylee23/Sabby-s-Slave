const state = {
  screen: "dashboard",
  previousScreen: null,
  activity: null,
  exercises: [],
  exerciseCategories: [],
  summaries: {},
  gymItems: [],
  rehabItems: [],
  gymDuration: "",
  gymZoneMinutes: "",
  gymCardioLoad: "",
  selectedDate: "",
};

const app = document.querySelector("#app");
const screenTitle = document.querySelector("#screenTitle");
const selectedDateInput = document.querySelector("#selectedDate");
const backButton = document.querySelector("#backButton");
const toast = document.querySelector("#toast");
const exerciseDialog = document.querySelector("#exerciseDialog");
const exerciseSearch = document.querySelector("#exerciseSearch");
const exerciseResults = document.querySelector("#exerciseResults");
const createExercisePanel = document.querySelector("#createExercisePanel");
const newExerciseName = document.querySelector("#newExerciseName");
const newExerciseCategory = document.querySelector("#newExerciseCategory");
const exerciseCategoryOptions = document.querySelector("#exerciseCategoryOptions");
const createExerciseButton = document.querySelector("#createExerciseButton");

const DEFAULT_EXERCISE_CATEGORIES = ["Upper Body", "Lower Body", "Core", "Rehab"];

const ACTIVITY_LABELS = {
  gym: "Gym",
  badminton: "Badminton",
  cycling: "Cycling",
  others: "Others",
};

const HEALTH_LABELS = {
  steps: "Steps",
  azm: "Zone Minutes",
  sleep: "Sleep hours",
  sleepScore: "Sleep score",
  readinessScore: "Readiness score",
  weight: "Weight",
};

const titles = {
  dashboard: "Sabby's Slave",
  workout: "Workout",
  gym: "Gym Workout",
  rehab: "Rehab",
  cycling: "Cycling",
  badminton: "Badminton",
  others: "Other Activity",
  health: "Health",
  diary: "Diary",
};

document.addEventListener("DOMContentLoaded", init);

function todayKey() {
  return formatDateKey(new Date());
}

async function init() {
  wireEvents();
  state.selectedDate = todayKey();
  selectedDateInput.value = state.selectedDate;

  try {
    await refreshSummaries();
    render();
    if (LifeDashboardApi.isDemoMode()) {
      showToast("Demo mode is on. Add your Apps Script URL when ready.");
    }
  } catch (error) {
    renderError(error);
  }
}

async function refreshSummaries() {
  const bootstrap = await LifeDashboardApi.request("bootstrap", { date: state.selectedDate });
  state.exercises = bootstrap.exercises;
  state.exerciseCategories = collectExerciseCategories(state.exercises);
  state.summaries = bootstrap.summaries || {};
  if (bootstrap.selectedDate) {
    state.selectedDate = bootstrap.selectedDate;
    selectedDateInput.value = state.selectedDate;
  }
}

function wireEvents() {
  document.querySelectorAll("[data-nav]").forEach((button) => {
    button.addEventListener("click", () => navigate(button.dataset.nav));
  });

  backButton.addEventListener("click", () => {
    navigate(state.previousScreen || "dashboard");
  });

  exerciseSearch.addEventListener("input", renderExerciseResults);
  createExerciseButton.addEventListener("click", createAndAddExercise);

  selectedDateInput.addEventListener("change", async () => {
    state.selectedDate = selectedDateInput.value || todayKey();
    try {
      await refreshSummaries();
      render();
    } catch (error) {
      showToast(error.message);
    }
  });
}

function navigate(screen, options = {}) {
  state.previousScreen = options.from || state.screen;
  state.screen = screen;
  render();
}

function render() {
  screenTitle.textContent = titles[state.screen] || "Sabby's Slave";
  backButton.hidden = ["dashboard", "workout", "health", "diary"].includes(state.screen);

  document.querySelectorAll("[data-nav]").forEach((button) => {
    button.classList.toggle("active", button.dataset.nav === navKeyForScreen(state.screen));
  });

  if (state.screen === "dashboard") renderDashboard();
  if (state.screen === "workout") renderWorkoutChoice();
  if (state.screen === "gym") renderGym();
  if (state.screen === "rehab") renderRehab();
  if (state.screen === "cycling") renderActivityForm("Cycling");
  if (state.screen === "badminton") renderBadminton();
  if (state.screen === "others") renderActivityForm("Other");
  if (state.screen === "health") renderHealth();
  if (state.screen === "diary") renderDiary();
}

function navKeyForScreen(screen) {
  if (["gym", "rehab", "cycling", "badminton", "others"].includes(screen)) return "workout";
  return screen;
}

function renderDashboard() {
  const dayStats = state.summaries.today || {};
  const dayHtml = renderDayStats(dayStats);
  const weekHtml = renderWeekStatsSections(state.summaries.week || { days: [] });

  app.innerHTML = `
    ${dayHtml || `<section class="section stack"><h2 class="stats-heading">${escapeHtml(formatFullDate(state.selectedDate))}</h2><p class="muted">Nothing logged for this day.</p></section>`}
    ${weekHtml || `<section class="empty">Nothing logged this week.</section>`}
  `;
}

function renderDayStats(dayStats) {
  const sections = [];
  const hasContent = dayStats.activities || dayStats.health || dayStats.diary;
  if (!hasContent) return "";

  sections.push(`
    <section class="section stack">
      <h2 class="stats-heading">${escapeHtml(formatFullDate(dayStats.date || state.selectedDate))}</h2>
  `);

  if (dayStats.activities) {
    sections.push(`<div class="stat-group">${Object.keys(ACTIVITY_LABELS)
      .filter((key) => dayStats.activities[key])
      .map((key) => renderActivityRow(ACTIVITY_LABELS[key], dayStats.activities[key]))
      .join("")}</div>`);
  }

  if (dayStats.health) {
    sections.push(renderHealthStatsSection(dayStats.health, false));
  }

  if (dayStats.diary) {
    sections.push(`
      <div class="stack">
        <h3 class="stats-subheading">Diary</h3>
        <p class="diary-entry">${escapeHtml(dayStats.diary.entry)}</p>
      </div>
    `);
  }

  sections.push("</section>");
  return sections.join("");
}

function renderActivityRow(label, data) {
  return `
    <div class="stat-block">
      <strong>${label}</strong>
      <div class="stat-metrics">
        ${metricChip("Duration", formatMinutes(data.duration))}
        ${metricChip("Zone Minutes", formatNumber(data.zoneMinutes))}
        ${metricChip("Cardio load", formatNumber(data.cardioLoad))}
      </div>
    </div>
  `;
}

function renderHealthStatsSection(health, wrapSection = true) {
  const rows = Object.keys(HEALTH_LABELS)
    .filter((key) => health[key] !== undefined && health[key] !== "")
    .map((key) => `<div class="row"><span>${HEALTH_LABELS[key]}</span><strong>${escapeHtml(health[key])}</strong></div>`)
    .join("");

  const content = `
    <div class="stack">
      <h3 class="stats-subheading">Health</h3>
      ${rows}
    </div>
  `;

  if (!wrapSection) return content;

  return `
    <section class="section stack">
      <h2 class="stats-heading">Health</h2>
      ${rows}
    </section>
  `;
}

function metricChip(label, value) {
  return `<span class="metric-chip"><span>${label}</span><strong>${value}</strong></span>`;
}

function renderWorkoutChoice() {
  app.innerHTML = `
    <section class="hero-panel">
      <h2>Select activity</h2>
      <p>All activities track duration, Zone Minutes, and cardio load. Gym also logs exercises.</p>
    </section>

    <section class="grid">
      ${activityButton("Gym", "Exercises, duration, Zone Minutes, cardio load", "gym")}
      ${activityButton("Rehab", "Exercises, reps, sets, notes", "rehab")}
      ${activityButton("Cycling", "Duration, Zone Minutes, cardio load", "cycling")}
      ${activityButton("Badminton", "Duration, Zone Minutes, cardio load", "badminton")}
      ${activityButton("Others", "Any activity you want", "others")}
    </section>
  `;

  app.querySelectorAll("[data-activity]").forEach((button) => {
    button.addEventListener("click", () => navigate(button.dataset.activity, { from: "workout" }));
  });
}

function activityButton(title, description, screen) {
  return `
    <button class="activity-button" data-activity="${screen}" type="button">
      <strong>${title}</strong>
      <span>${description}</span>
    </button>
  `;
}

function renderGym() {
  const cards = state.gymItems.length
    ? state.gymItems.map((item, index) => exerciseItemCard(item, index)).join("")
    : `<div class="empty">No exercises yet. Add the exercises you did, then save once.</div>`;

  app.innerHTML = `
    <section class="section">
      <div class="stack">
        <div class="form-grid">
          <label class="field"><span>Duration minutes</span><input id="gymDuration" type="number" inputmode="numeric" min="0" value="${escapeAttr(state.gymDuration)}" /></label>
          <label class="field"><span>Zone Minutes</span><input id="gymZoneMinutes" type="number" inputmode="numeric" min="0" value="${escapeAttr(state.gymZoneMinutes)}" /></label>
          <label class="field"><span>Cardio load</span><input id="gymCardioLoad" type="number" inputmode="numeric" min="0" value="${escapeAttr(state.gymCardioLoad)}" /></label>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="section-title">
        <h2>Exercises</h2>
        <button class="secondary-button" id="addExercise" type="button">Add Exercise</button>
      </div>
      <div class="stack">${cards}</div>
    </section>

    <button class="primary-button" id="saveGym" type="button" ${state.gymItems.length ? "" : "disabled"}>Save Workout</button>
  `;

  document.querySelector("#gymDuration").addEventListener("input", (event) => {
    state.gymDuration = event.target.value;
  });
  document.querySelector("#gymZoneMinutes").addEventListener("input", (event) => {
    state.gymZoneMinutes = event.target.value;
  });
  document.querySelector("#gymCardioLoad").addEventListener("input", (event) => {
    state.gymCardioLoad = event.target.value;
  });
  document.querySelector("#addExercise").addEventListener("click", openExerciseDialog);
  document.querySelector("#saveGym").addEventListener("click", saveGymWorkout);

  app.querySelectorAll("[data-update]").forEach((input) => {
    input.addEventListener("input", updateGymItem);
  });

  app.querySelectorAll("[data-remove]").forEach((button) => {
    button.addEventListener("click", () => {
      state.gymItems.splice(Number(button.dataset.remove), 1);
      renderGym();
    });
  });

  app.querySelectorAll("[data-quick]").forEach((button) => {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.index);
      state.gymItems[index][button.dataset.field] = button.dataset.quick;
      renderGym();
    });
  });
}

function renderRehab() {
  const cards = state.rehabItems.length
    ? state.rehabItems.map((item, index) => exerciseItemCard(item, index)).join("")
    : `<div class="empty">No exercises yet. Add the rehab exercises you did, then save once.</div>`;

  app.innerHTML = `
    <section class="section">
      <div class="section-title">
        <h2>Exercises</h2>
        <button class="secondary-button" id="addExercise" type="button">Add Exercise</button>
      </div>
      <div class="stack">${cards}</div>
    </section>

    <button class="primary-button" id="saveRehab" type="button" ${state.rehabItems.length ? "" : "disabled"}>Save Rehab</button>
  `;

  document.querySelector("#addExercise").addEventListener("click", openExerciseDialog);
  document.querySelector("#saveRehab").addEventListener("click", saveRehabSession);

  app.querySelectorAll("[data-update]").forEach((input) => {
    input.addEventListener("input", updateExerciseItem);
  });

  app.querySelectorAll("[data-remove]").forEach((button) => {
    button.addEventListener("click", () => {
      currentExerciseItems().splice(Number(button.dataset.remove), 1);
      renderRehab();
    });
  });

  app.querySelectorAll("[data-quick]").forEach((button) => {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.index);
      currentExerciseItems()[index][button.dataset.field] = button.dataset.quick;
      renderRehab();
    });
  });
}

function exerciseItemCard(item, index) {
  return `
    <article class="card">
      <div class="row">
        <div>
          <strong>${escapeHtml(item.name)}</strong>
          <div class="muted">${escapeHtml(item.category)}</div>
        </div>
        <button class="ghost-button" data-remove="${index}" type="button">Remove</button>
      </div>

      <div class="form-grid">
        ${textField("Weight", "weight", item.weight, index, "Bodyweight, band, 2 x 5kg...")}
        ${numberField("Reps", "reps", item.reps, index, "1")}
        ${numberField("Sets", "sets", item.sets, index, "1")}
      </div>

      <div class="quick-row" aria-label="Quick reps">
        ${[6, 8, 10, 12, 15].map((value) => quickButton(index, "reps", value)).join("")}
      </div>

      <div class="quick-row" aria-label="Quick sets">
        ${[1, 2, 3, 4, 5].map((value) => quickButton(index, "sets", value)).join("")}
      </div>

      <label class="field">
        <span>Notes</span>
        <input data-update="${index}" data-field="notes" value="${escapeAttr(item.notes)}" placeholder="Felt strong, slow tempo..." />
      </label>
    </article>
  `;
}

function textField(label, field, value, index, placeholder = "") {
  return `
    <label class="field">
      <span>${label}</span>
      <input data-update="${index}" data-field="${field}" value="${escapeAttr(value)}" placeholder="${escapeAttr(placeholder)}" />
    </label>
  `;
}

function numberField(label, field, value, index, step) {
  return `
    <label class="field">
      <span>${label}</span>
      <input data-update="${index}" data-field="${field}" type="number" inputmode="decimal" min="0" step="${step}" value="${escapeAttr(value)}" />
    </label>
  `;
}

function quickButton(index, field, value) {
  return `<button data-index="${index}" data-field="${field}" data-quick="${value}" type="button">${value}</button>`;
}

function updateGymItem(event) {
  updateExerciseItem(event);
}

function updateExerciseItem(event) {
  const index = Number(event.target.dataset.update);
  const field = event.target.dataset.field;
  currentExerciseItems()[index][field] = event.target.value;
}

function openExerciseDialog() {
  exerciseSearch.value = "";
  newExerciseName.value = "";
  newExerciseCategory.value = state.screen === "rehab" ? "Rehab" : "Upper Body";
  createExercisePanel.hidden = true;
  exerciseDialog.querySelector(".dialog-header .eyebrow").textContent = state.screen === "rehab" ? "Rehab" : "Gym";
  renderExerciseCategoryOptions();
  renderExerciseResults();
  exerciseDialog.showModal();
  setTimeout(() => exerciseSearch.focus(), 50);
}

function renderExerciseResults() {
  const query = exerciseSearch.value.trim().toLowerCase();
  const matches = state.exercises
    .filter((exercise) => {
      return `${exercise.name} ${exercise.category}`.toLowerCase().includes(query);
    })
    .slice(0, 20);

  exerciseResults.innerHTML = matches.length
    ? matches
        .map(
          (exercise) => `
          <button class="result-button" data-exercise="${exercise.id}" type="button">
            ${escapeHtml(exercise.name)}
            <span>${escapeHtml(exercise.category)}</span>
          </button>
        `,
        )
        .join("")
    : `<div class="empty">No exercises found.</div>`;

  exerciseResults.querySelectorAll("[data-exercise]").forEach((button) => {
    button.addEventListener("click", () => {
      const exercise = state.exercises.find((item) => item.id === button.dataset.exercise);
      addExerciseItem(exercise);
      exerciseDialog.close();
      renderExerciseScreen();
    });
  });

  createExercisePanel.hidden = !query || matches.some((exercise) => exercise.name.toLowerCase() === query);
  newExerciseName.value = exerciseSearch.value.trim();
}

function renderExerciseCategoryOptions() {
  exerciseCategoryOptions.innerHTML = state.exerciseCategories
    .map((category) => `<option value="${escapeAttr(category)}"></option>`)
    .join("");
}

async function createAndAddExercise() {
  const name = newExerciseName.value.trim();
  const category = newExerciseCategory.value.trim() || "Upper Body";
  if (!name) return showToast("Enter an exercise name first.");

  try {
    const exercise = await LifeDashboardApi.request("addExercise", {
      name,
      category,
    });
    state.exercises.push(exercise);
    state.exerciseCategories = collectExerciseCategories(state.exercises);
    addExerciseItem(exercise);
    exerciseDialog.close();
    renderExerciseScreen();
    showToast("Exercise created.");
  } catch (error) {
    showToast(error.message);
  }
}

function collectExerciseCategories(exercises) {
  const categories = new Set();
  exercises.forEach((exercise) => {
    const category = String(exercise.category || "").trim();
    if (category && !DEFAULT_EXERCISE_CATEGORIES.includes(category)) categories.add(category);
  });
  return [...DEFAULT_EXERCISE_CATEGORIES, ...[...categories].sort((a, b) => a.localeCompare(b))];
}

function addExerciseItem(exercise) {
  currentExerciseItems().push({
    exerciseId: exercise.id,
    name: exercise.name,
    category: exercise.category,
    weight: "",
    reps: "",
    sets: "3",
    notes: "",
  });
}

function currentExerciseItems() {
  return state.screen === "rehab" ? state.rehabItems : state.gymItems;
}

function renderExerciseScreen() {
  if (state.screen === "rehab") renderRehab();
  else renderGym();
}

async function saveGymWorkout() {
  const items = state.gymItems.map(({ exerciseId, weight, reps, sets, notes }) => ({
    exerciseId,
    weight,
    reps,
    sets,
    notes,
  }));

  try {
    await LifeDashboardApi.request("saveGymWorkout", {
      items,
      duration: state.gymDuration,
      zoneMinutes: state.gymZoneMinutes,
      cardioLoad: state.gymCardioLoad,
      date: state.selectedDate,
    });
    state.gymItems = [];
    state.gymDuration = "";
    state.gymZoneMinutes = "";
    state.gymCardioLoad = "";
    await refreshSummaries();
    renderGym();
    showToast("Workout saved.");
  } catch (error) {
    showToast(error.message);
  }
}

async function saveRehabSession() {
  const items = state.rehabItems.map(({ exerciseId, weight, reps, sets, notes }) => ({
    exerciseId,
    weight,
    reps,
    sets,
    notes,
  }));

  try {
    await LifeDashboardApi.request("saveRehabSession", {
      items,
      date: state.selectedDate,
    });
    state.rehabItems = [];
    await refreshSummaries();
    renderRehab();
    showToast("Rehab saved.");
  } catch (error) {
    showToast(error.message);
  }
}

function renderActivityForm(activity) {
  const isOther = activity === "Other";
  app.innerHTML = `
    <section class="section">
      <div class="stack">
        ${
          isOther
            ? `<label class="field"><span>Activity name</span><input id="activityName" placeholder="Swimming, walk, pilates..." /></label>`
            : ""
        }
        <div class="form-grid">
          <label class="field"><span>Duration minutes</span><input id="duration" type="number" inputmode="numeric" min="0" /></label>
          <label class="field"><span>Zone Minutes</span><input id="zoneMinutes" type="number" inputmode="numeric" min="0" /></label>
          <label class="field"><span>Cardio load</span><input id="cardioLoad" type="number" inputmode="numeric" min="0" /></label>
        </div>
        <label class="field"><span>Notes</span><textarea id="activityNotes"></textarea></label>
      </div>
    </section>
    <button class="primary-button" id="saveActivity" type="button">Save Activity</button>
  `;

  document.querySelector("#saveActivity").addEventListener("click", async () => {
    const payload = {
      activity: isOther ? valueOf("#activityName") || "Other" : activity,
      duration: valueOf("#duration"),
      zoneMinutes: valueOf("#zoneMinutes"),
      cardioLoad: valueOf("#cardioLoad"),
      notes: valueOf("#activityNotes"),
    };
    await saveSimple("saveActivity", payload, "Activity saved.");
  });
}

function renderBadminton() {
  app.innerHTML = `
    <section class="section">
      <div class="stack">
        <div class="form-grid">
          <label class="field"><span>Duration minutes</span><input id="duration" type="number" inputmode="numeric" min="0" /></label>
          <label class="field"><span>Zone Minutes</span><input id="zoneMinutes" type="number" inputmode="numeric" min="0" /></label>
          <label class="field"><span>Cardio load</span><input id="cardioLoad" type="number" inputmode="numeric" min="0" /></label>
        </div>
        <label class="field"><span>Notes</span><textarea id="activityNotes"></textarea></label>
      </div>
    </section>
    <button class="primary-button" id="saveActivity" type="button">Save Badminton</button>
  `;

  document.querySelector("#saveActivity").addEventListener("click", async () => {
    await saveSimple(
      "saveActivity",
      {
        activity: "Badminton",
        duration: valueOf("#duration"),
        zoneMinutes: valueOf("#zoneMinutes"),
        cardioLoad: valueOf("#cardioLoad"),
        notes: valueOf("#activityNotes"),
      },
      "Badminton saved.",
    );
  });
}

function renderHealth() {
  app.innerHTML = `
    <section class="section">
      <div class="stack">
        <div class="form-grid two">
          <label class="field"><span>Steps</span><input id="steps" type="number" inputmode="numeric" min="0" /></label>
          <label class="field"><span>Zone Minutes</span><input id="azm" type="number" inputmode="numeric" min="0" /></label>
        </div>
        <div class="form-grid two">
          <label class="field"><span>Sleep hours</span><input id="sleep" type="number" inputmode="decimal" min="0" step="0.1" /></label>
          <label class="field"><span>Sleep score</span><input id="sleepScore" type="number" inputmode="numeric" min="0" max="100" /></label>
        </div>
        <div class="form-grid two">
          <label class="field"><span>Readiness score</span><input id="readinessScore" type="number" inputmode="numeric" min="0" max="100" /></label>
          <label class="field"><span>Weight</span><input id="weight" type="number" inputmode="decimal" min="0" step="0.1" /></label>
        </div>
        <label class="field"><span>Notes</span><textarea id="healthNotes"></textarea></label>
      </div>
    </section>
    <button class="primary-button" id="saveHealth" type="button">Save Health</button>
  `;

  document.querySelector("#saveHealth").addEventListener("click", async () => {
    await saveSimple(
      "saveHealth",
      {
        steps: valueOf("#steps"),
        azm: valueOf("#azm"),
        sleep: valueOf("#sleep"),
        sleepScore: valueOf("#sleepScore"),
        readinessScore: valueOf("#readinessScore"),
        weight: valueOf("#weight"),
        notes: valueOf("#healthNotes"),
      },
      "Health saved.",
    );
  });
}

function renderDiary() {
  app.innerHTML = `
    <section class="section">
      <div class="stack">
        <label class="field"><span>Today's thoughts</span><textarea id="entry" placeholder="Write whatever is useful to remember."></textarea></label>
      </div>
    </section>
    <button class="primary-button" id="saveDiary" type="button">Save Diary</button>
  `;

  document.querySelector("#saveDiary").addEventListener("click", async () => {
    await saveSimple(
      "saveDiary",
      {
        entry: valueOf("#entry"),
      },
      "Diary saved.",
    );
  });
}

function renderWeekStatsSections(week) {
  const sections = [];

  const activityKeys = ["gym", "badminton", "cycling", "others"].filter((key) =>
    week.days.some((day) => day.activities?.[key]),
  );

  if (activityKeys.length) {
    sections.push(`
      <section class="section stack">
        <h2 class="stats-heading">This week</h2>
        ${week.totals ? renderWeekTotals(week.totals) : ""}
        ${activityKeys.map((key) => renderActivityChart(key, week.days)).join("")}
      </section>
    `);
  }

  const healthKeys = collectHealthKeys(week.days);
  if (healthKeys.length) {
    sections.push(`
      <section class="section stack">
        <h2 class="stats-heading">Health this week</h2>
        ${healthKeys.map((key) => renderHealthChart(key, week.days)).join("")}
      </section>
    `);
  }

  const diaryDays = week.days.filter((day) => day.diary?.entry);
  if (diaryDays.length) {
    sections.push(`
      <section class="section stack">
        <h2 class="stats-heading">Diary this week</h2>
        ${diaryDays.map((day) => renderDiaryWeekEntry(day)).join("")}
      </section>
    `);
  }

  return sections.join("");
}

function renderWeekTotals(totals) {
  const rows = Object.keys(ACTIVITY_LABELS)
    .filter((key) => totals[key])
    .map((key) => renderActivityRow(ACTIVITY_LABELS[key], totals[key]))
    .join("");

  return `
    <div class="stat-group week-totals">
      <p class="muted">Week totals</p>
      ${rows}
    </div>
  `;
}

function renderActivityChart(key, days) {
  const label = ACTIVITY_LABELS[key];
  const durationValues = days.map((day) => day.activities?.[key]?.duration || 0);
  const cardioValues = days.map((day) => day.activities?.[key]?.cardioLoad || 0);
  const zoneValues = days.map((day) => day.activities?.[key]?.zoneMinutes || 0);
  const maxDuration = Math.max(...durationValues, 1);
  const maxCardio = Math.max(...cardioValues, 1);
  const maxZone = Math.max(...zoneValues, 1);

  return `
    <div class="chart-card">
      <div class="chart-header">
        <strong>${label}</strong>
      </div>
      <div class="chart-block">
        <p class="chart-label">Duration (min)</p>
        ${renderBarGroup(days, durationValues, maxDuration, "min")}
      </div>
      <div class="chart-block">
        <p class="chart-label">Zone Minutes</p>
        ${renderBarGroup(days, zoneValues, maxZone, "min")}
      </div>
      <div class="chart-block">
        <p class="chart-label">Cardio load</p>
        ${renderBarGroup(days, cardioValues, maxCardio, "")}
      </div>
    </div>
  `;
}

function renderBarGroup(days, values, maxValue, unit) {
  return `
    <div class="chart-bars" role="img" aria-label="Weekly chart">
      ${days
        .map((day, index) => {
          const value = values[index];
          const height = value ? Math.max(8, Math.round((value / maxValue) * 100)) : 0;
          const tooltip = `${formatDayLabel(day.date)}: ${formatNumber(value)}${unit ? ` ${unit}` : ""}`;
          return `
            <div class="chart-bar-wrap">
              <div class="chart-bar ${value ? "" : "is-empty"}" style="height:${height}%" title="${escapeAttr(tooltip)}" data-tooltip="${escapeAttr(tooltip)}"></div>
              <span class="chart-day">${formatDayLabel(day.date)}</span>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderHealthChart(key, days) {
  const values = days.map((day) => {
    const raw = day.health?.[key];
    return raw === undefined || raw === "" ? null : Number(raw);
  });
  const numericValues = values.filter((value) => Number.isFinite(value));
  if (!numericValues.length) return "";

  const maxValue = Math.max(...numericValues, 1);

  return `
    <div class="chart-card">
      <div class="chart-header">
        <strong>${HEALTH_LABELS[key]}</strong>
      </div>
      <div class="chart-block">
        ${renderBarGroup(
          days,
          values.map((value) => (Number.isFinite(value) ? value : 0)),
          maxValue,
          "",
        )}
      </div>
    </div>
  `;
}

function renderDiaryWeekEntry(day) {
  return `
    <article class="diary-week-entry">
      <p class="muted">${formatDayLabel(day.date, true)}</p>
      <p>${escapeHtml(day.diary.entry)}</p>
    </article>
  `;
}

function collectHealthKeys(days) {
  const keys = new Set();
  days.forEach((day) => {
    if (!day.health) return;
    Object.keys(day.health).forEach((key) => keys.add(key));
  });
  return [...keys];
}

function formatDayLabel(date, withDate = false) {
  const parsed = parseDateKey(date);
  const weekday = new Intl.DateTimeFormat("en-SG", { weekday: "short" }).format(parsed);
  if (!withDate) return weekday;
  const formatted = new Intl.DateTimeFormat("en-SG", { day: "numeric", month: "short" }).format(parsed);
  return `${weekday}, ${formatted}`;
}

function parseDateKey(value) {
  const [year, month, day] = String(value).split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatMinutes(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return "0 min";
  return `${number} min`;
}

function formatNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "0";
  return Number.isInteger(number) ? String(number) : number.toFixed(1);
}

function formatFullDate(date) {
  return new Intl.DateTimeFormat("en-SG", {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(parseDateKey(date));
}

async function saveSimple(action, payload, message) {
  try {
    await LifeDashboardApi.request(action, { ...payload, date: state.selectedDate });
    await refreshSummaries();
    render();
    showToast(message);
  } catch (error) {
    showToast(error.message);
  }
}

function valueOf(selector) {
  return document.querySelector(selector)?.value.trim() || "";
}

function showToast(message) {
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    toast.hidden = true;
  }, 3200);
}

function renderError(error) {
  app.innerHTML = `
    <section class="section">
      <h2>Something went wrong</h2>
      <p class="muted">${escapeHtml(error.message)}</p>
    </section>
  `;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}
