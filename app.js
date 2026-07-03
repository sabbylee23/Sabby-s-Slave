const state = {
  screen: "dashboard",
  previousScreen: null,
  activity: null,
  exercises: [],
  summaries: {},
  gymItems: [],
};

const app = document.querySelector("#app");
const screenTitle = document.querySelector("#screenTitle");
const todayLabel = document.querySelector("#todayLabel");
const backButton = document.querySelector("#backButton");
const toast = document.querySelector("#toast");
const exerciseDialog = document.querySelector("#exerciseDialog");
const exerciseSearch = document.querySelector("#exerciseSearch");
const exerciseResults = document.querySelector("#exerciseResults");
const createExercisePanel = document.querySelector("#createExercisePanel");
const newExerciseName = document.querySelector("#newExerciseName");
const newExerciseCategory = document.querySelector("#newExerciseCategory");
const createExerciseButton = document.querySelector("#createExerciseButton");

const titles = {
  dashboard: "Life Dashboard",
  workout: "Workout",
  gym: "Gym Workout",
  cycling: "Cycling",
  badminton: "Badminton",
  others: "Other Activity",
  health: "Health",
  diary: "Diary",
  stats: "Statistics",
};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  wireEvents();
  todayLabel.textContent = new Intl.DateTimeFormat("en-SG", {
    weekday: "long",
    day: "numeric",
    month: "short",
  }).format(new Date());

  try {
    const bootstrap = await LifeDashboardApi.request("bootstrap");
    state.exercises = bootstrap.exercises;
    state.summaries = bootstrap.summaries || {};
    render();
    if (bootstrap.demoMode) {
      showToast("Demo mode is on. Add your Apps Script URL when ready.");
    }
  } catch (error) {
    renderError(error);
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
}

function navigate(screen, options = {}) {
  state.previousScreen = options.from || state.screen;
  state.screen = screen;
  render();
}

function render() {
  screenTitle.textContent = titles[state.screen] || "Life Dashboard";
  backButton.hidden = ["dashboard", "workout", "health", "diary"].includes(state.screen);

  document.querySelectorAll("[data-nav]").forEach((button) => {
    button.classList.toggle("active", button.dataset.nav === navKeyForScreen(state.screen));
  });

  if (state.screen === "dashboard") renderDashboard();
  if (state.screen === "workout") renderWorkoutChoice();
  if (state.screen === "gym") renderGym();
  if (state.screen === "cycling") renderActivityForm("Cycling");
  if (state.screen === "badminton") renderBadminton();
  if (state.screen === "others") renderActivityForm("Other");
  if (state.screen === "health") renderHealth();
  if (state.screen === "diary") renderDiary();
  if (state.screen === "stats") renderStats();
}

function navKeyForScreen(screen) {
  if (["gym", "cycling", "badminton", "others"].includes(screen)) return "workout";
  if (screen === "stats") return "dashboard";
  return screen;
}

function renderDashboard() {
  app.innerHTML = `
    <section class="hero-panel">
      <h2>Today at a glance</h2>
      <p>Log workout, health, and diary entries quickly. Save once per section, then everything lands in Google Sheets.</p>
    </section>

    <section class="grid">
      ${tile("Workout", summaryText("workout"), "workout")}
      ${tile("Health", state.summaries.healthToday ? "Logged today" : "Steps, sleep, weight", "health")}
      ${tile("Diary", state.summaries.diaryToday ? "Entry saved today" : "Mood, notes, tags", "diary")}
      ${tile("Statistics", "Weekly totals and trends", "stats")}
    </section>
  `;

  app.querySelectorAll("[data-open]").forEach((button) => {
    button.addEventListener("click", () => navigate(button.dataset.open));
  });
}

function tile(title, description, screen) {
  return `
    <button class="tile" data-open="${screen}" type="button">
      <strong>${title}</strong>
      <span>${description}</span>
    </button>
  `;
}

function summaryText(type) {
  if (type === "workout") {
    const gymCount = state.summaries.gymExercisesToday || 0;
    const activities = state.summaries.activitiesToday || 0;
    if (gymCount) return `${gymCount} gym exercises logged`;
    if (activities) return `${activities} activity logged`;
  }
  return "Gym, cycling, badminton, others";
}

function renderWorkoutChoice() {
  app.innerHTML = `
    <section class="hero-panel">
      <h2>Select activity</h2>
      <p>Gym has exercises. Cycling, badminton, and others use simpler activity forms.</p>
    </section>

    <section class="grid">
      ${activityButton("Gym", "Weights, reps, sets, notes", "gym")}
      ${activityButton("Cycling", "Duration, distance, speed", "cycling")}
      ${activityButton("Badminton", "Duration, location, session", "badminton")}
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
    ? state.gymItems.map((item, index) => gymItemCard(item, index)).join("")
    : `<div class="empty">No exercises yet. Add the exercises you did, then save once.</div>`;

  app.innerHTML = `
    <section class="section">
      <div class="section-title">
        <h2>Exercises</h2>
        <button class="secondary-button" id="addExercise" type="button">Add Exercise</button>
      </div>
      <div class="stack">${cards}</div>
    </section>

    <button class="primary-button" id="saveGym" type="button" ${state.gymItems.length ? "" : "disabled"}>Save Workout</button>
  `;

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

function gymItemCard(item, index) {
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
        ${numberField("Weight", "weight", item.weight, index, "0.1")}
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
  const index = Number(event.target.dataset.update);
  const field = event.target.dataset.field;
  state.gymItems[index][field] = event.target.value;
}

function openExerciseDialog() {
  exerciseSearch.value = "";
  newExerciseName.value = "";
  createExercisePanel.hidden = true;
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
      addGymItem(exercise);
      exerciseDialog.close();
      renderGym();
    });
  });

  createExercisePanel.hidden = !query || matches.some((exercise) => exercise.name.toLowerCase() === query);
  newExerciseName.value = exerciseSearch.value.trim();
}

async function createAndAddExercise() {
  const name = newExerciseName.value.trim();
  if (!name) return showToast("Enter an exercise name first.");

  try {
    const exercise = await LifeDashboardApi.request("addExercise", {
      name,
      category: newExerciseCategory.value,
    });
    state.exercises.push(exercise);
    addGymItem(exercise);
    exerciseDialog.close();
    renderGym();
    showToast("Exercise created.");
  } catch (error) {
    showToast(error.message);
  }
}

function addGymItem(exercise) {
  state.gymItems.push({
    exerciseId: exercise.id,
    name: exercise.name,
    category: exercise.category,
    weight: "",
    reps: "",
    sets: "3",
    notes: "",
  });
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
    await LifeDashboardApi.request("saveGymWorkout", { items });
    state.gymItems = [];
    const bootstrap = await LifeDashboardApi.request("bootstrap");
    state.summaries = bootstrap.summaries || {};
    renderGym();
    showToast("Workout saved.");
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
        <div class="form-grid two">
          <label class="field"><span>Duration minutes</span><input id="duration" type="number" inputmode="numeric" min="0" /></label>
          <label class="field"><span>Distance km</span><input id="distance" type="number" inputmode="decimal" min="0" step="0.1" /></label>
        </div>
        <label class="field"><span>Average speed</span><input id="averageSpeed" type="number" inputmode="decimal" min="0" step="0.1" /></label>
        <label class="field"><span>Notes</span><textarea id="activityNotes"></textarea></label>
      </div>
    </section>
    <button class="primary-button" id="saveActivity" type="button">Save Activity</button>
  `;

  document.querySelector("#saveActivity").addEventListener("click", async () => {
    const payload = {
      activity: isOther ? valueOf("#activityName") || "Other" : activity,
      duration: valueOf("#duration"),
      distance: valueOf("#distance"),
      averageSpeed: valueOf("#averageSpeed"),
      notes: valueOf("#activityNotes"),
    };
    await saveSimple("saveActivity", payload, "Activity saved.");
  });
}

function renderBadminton() {
  app.innerHTML = `
    <section class="section">
      <div class="stack">
        <div class="form-grid two">
          <label class="field"><span>Duration minutes</span><input id="duration" type="number" inputmode="numeric" min="0" /></label>
          <label class="field"><span>Location</span><input id="location" placeholder="NUS, ActiveSG..." /></label>
        </div>
        <div class="form-grid two">
          <label class="field"><span>Session</span><select id="session"><option>Training</option><option>Match</option><option>Social</option></select></label>
          <label class="field"><span>Intensity</span><select id="intensity"><option>Easy</option><option>Moderate</option><option>Hard</option></select></label>
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
        distance: "",
        averageSpeed: "",
        location: valueOf("#location"),
        session: valueOf("#session"),
        intensity: valueOf("#intensity"),
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
          <label class="field"><span>Active zone minutes</span><input id="azm" type="number" inputmode="numeric" min="0" /></label>
        </div>
        <div class="form-grid two">
          <label class="field"><span>Sleep hours</span><input id="sleep" type="number" inputmode="decimal" min="0" step="0.1" /></label>
          <label class="field"><span>Sleep score</span><input id="sleepScore" type="number" inputmode="numeric" min="0" max="100" /></label>
        </div>
        <div class="form-grid two">
          <label class="field"><span>Weight</span><input id="weight" type="number" inputmode="decimal" min="0" step="0.1" /></label>
          <label class="field"><span>Mood</span><select id="mood"><option>Great</option><option>Good</option><option>Okay</option><option>Low</option><option>Tired</option></select></label>
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
        weight: valueOf("#weight"),
        mood: valueOf("#mood"),
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
        <label class="field"><span>Mood</span><select id="mood"><option>Great</option><option>Good</option><option>Okay</option><option>Low</option><option>Tired</option></select></label>
        <label class="field"><span>Tags</span><input id="tags" placeholder="Workout, school, travel..." /></label>
      </div>
    </section>
    <button class="primary-button" id="saveDiary" type="button">Save Diary</button>
  `;

  document.querySelector("#saveDiary").addEventListener("click", async () => {
    await saveSimple(
      "saveDiary",
      {
        mood: valueOf("#mood"),
        entry: valueOf("#entry"),
        tags: valueOf("#tags"),
      },
      "Diary saved.",
    );
  });
}

function renderStats() {
  app.innerHTML = `
    <section class="hero-panel">
      <h2>First stats view</h2>
      <p>This starter version shows whether today's sections are logged. In the next part, this becomes weekly totals and charts.</p>
    </section>
    <section class="section stack">
      <div class="row"><span>Gym exercises today</span><strong>${state.summaries.gymExercisesToday || 0}</strong></div>
      <div class="row"><span>Activities today</span><strong>${state.summaries.activitiesToday || 0}</strong></div>
      <div class="row"><span>Health logged</span><strong>${state.summaries.healthToday ? "Yes" : "No"}</strong></div>
      <div class="row"><span>Diary logged</span><strong>${state.summaries.diaryToday ? "Yes" : "No"}</strong></div>
    </section>
  `;
}

async function saveSimple(action, payload, message) {
  try {
    await LifeDashboardApi.request(action, payload);
    const bootstrap = await LifeDashboardApi.request("bootstrap");
    state.summaries = bootstrap.summaries || {};
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
