const LifeDashboardApi = (() => {
  const CONFIG = {
    // Paste your deployed Google Apps Script Web App URL here after deployment.
    // Example: https://script.google.com/macros/s/AKfycb.../exec
    appsScriptUrl: "https://script.google.com/macros/s/AKfycbzZ5QS34Lu2p0k7WVipD3DPUw97y8tbP5ZCY7RnMW02yT8SVIC4WWcVjNiQhDkFtf2k/exec",
  };

  const STORE_KEY = "life-dashboard-demo-data-v2";

  const starterData = {
    exercises: [
      { id: "EX001", name: "Bench Press", category: "Chest", active: true },
      { id: "EX002", name: "Incline DB Press", category: "Chest", active: true },
      { id: "EX003", name: "Cable Fly", category: "Chest", active: true },
      { id: "EX004", name: "Lat Pulldown", category: "Back", active: true },
      { id: "EX005", name: "Seated Cable Row", category: "Back", active: true },
      { id: "EX006", name: "Shoulder Press", category: "Shoulders", active: true },
      { id: "EX007", name: "Lateral Raise", category: "Shoulders", active: true },
      { id: "EX008", name: "Squat", category: "Legs", active: true },
      { id: "EX009", name: "Romanian Deadlift", category: "Legs", active: true },
      { id: "EX010", name: "Triceps Pushdown", category: "Arms", active: true },
    ],
    gymLog: [],
    rehabLog: [],
    activityLog: [],
    healthLog: [],
    diary: [],
  };

  function todayKey() {
    return formatDateKey(new Date());
  }

  function loadLocal() {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) {
      localStorage.setItem(STORE_KEY, JSON.stringify(starterData));
      return structuredClone(starterData);
    }
    return JSON.parse(raw);
  }

  function saveLocal(data) {
    localStorage.setItem(STORE_KEY, JSON.stringify(data));
  }

  function isDemoMode() {
    return !CONFIG.appsScriptUrl;
  }

  async function request(action, payload = {}) {
    if (isDemoMode()) {
      return localRequest(action, payload);
    }

    const response = await fetch(CONFIG.appsScriptUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action, payload }),
    });

    const result = await response.json();
    if (!result.ok) throw new Error(result.error || "Request failed");
    return result.data;
  }

  function localRequest(action, payload) {
    const data = loadLocal();

    if (action === "bootstrap") {
      const referenceDate = resolveDate(payload.date);
      return Promise.resolve({
        demoMode: true,
        today: todayKey(),
        selectedDate: referenceDate,
        exercises: data.exercises.filter((exercise) => exercise.active),
        summaries: buildSummaries(data, referenceDate),
      });
    }

    if (action === "addExercise") {
      const exercise = {
        id: `EX${String(data.exercises.length + 1).padStart(3, "0")}`,
        name: payload.name.trim(),
        category: payload.category,
        active: true,
      };
      data.exercises.push(exercise);
      saveLocal(data);
      return Promise.resolve(exercise);
    }

    if (action === "saveGymWorkout") {
      const workoutId = `WO-${Date.now()}`;
      const date = resolveDate(payload.date);
      payload.items.forEach((item, index) => {
        data.gymLog.push({
          workoutId,
          date,
          order: index + 1,
          duration: payload.duration || "",
          zoneMinutes: payload.zoneMinutes || "",
          cardioLoad: payload.cardioLoad || "",
          ...item,
        });
      });
      saveLocal(data);
      return Promise.resolve({ workoutId, savedRows: payload.items.length });
    }

    if (action === "saveRehabSession") {
      const sessionId = `RH-${Date.now()}`;
      const date = resolveDate(payload.date);
      payload.items.forEach((item, index) => {
        data.rehabLog = data.rehabLog || [];
        data.rehabLog.push({
          sessionId,
          date,
          order: index + 1,
          ...item,
        });
      });
      saveLocal(data);
      return Promise.resolve({ sessionId, savedRows: payload.items.length });
    }

    if (action === "saveActivity") {
      data.activityLog.push({ ...payload, date: resolveDate(payload.date) });
      saveLocal(data);
      return Promise.resolve({ saved: true });
    }

    if (action === "saveHealth") {
      data.healthLog.push({ ...payload, date: resolveDate(payload.date) });
      saveLocal(data);
      return Promise.resolve({ saved: true });
    }

    if (action === "saveDiary") {
      data.diary.push({ ...payload, date: resolveDate(payload.date) });
      saveLocal(data);
      return Promise.resolve({ saved: true });
    }

    return Promise.reject(new Error(`Unknown action: ${action}`));
  }

  function buildSummaries(data, referenceDate) {
    const date = resolveDate(referenceDate);
    const gymRows = data.gymLog.filter((row) => row.date === date);
    const activityRows = data.activityLog.filter((row) => row.date === date);
    const healthRows = data.healthLog.filter((row) => row.date === date);
    const diaryRows = data.diary.filter((row) => row.date === date);

    return {
      today: buildDayStats(date, gymRows, activityRows, healthRows, diaryRows),
      week: buildWeekStats(date, data),
    };
  }

  function buildDayStats(date, gymRows, activityRows, healthRows, diaryRows) {
    const stats = { date };

    const activities = buildActivityStats(gymRows, activityRows);
    if (Object.keys(activities).length) {
      stats.activities = activities;
    }

    const health = buildHealthStats(healthRows);
    if (health) {
      stats.health = health;
    }

    const diary = buildDiaryStats(diaryRows);
    if (diary) {
      stats.diary = diary;
    }

    return stats;
  }

  function buildWeekStats(today, data) {
    const dates = weekDates(today);
    const days = dates.map((date) =>
      buildDayStats(
        date,
        data.gymLog.filter((row) => row.date === date),
        data.activityLog.filter((row) => row.date === date),
        data.healthLog.filter((row) => row.date === date),
        data.diary.filter((row) => row.date === date),
      ),
    );

    const totals = {};
    ["gym", "badminton", "cycling", "others"].forEach((key) => {
      const duration = days.reduce((sum, day) => sum + (day.activities?.[key]?.duration || 0), 0);
      const zoneMinutes = days.reduce((sum, day) => sum + (day.activities?.[key]?.zoneMinutes || 0), 0);
      const cardioLoad = days.reduce((sum, day) => sum + (day.activities?.[key]?.cardioLoad || 0), 0);
      if (duration || zoneMinutes || cardioLoad) {
        totals[key] = { duration, zoneMinutes, cardioLoad };
      }
    });

    const week = { days };
    if (Object.keys(totals).length) {
      week.totals = totals;
    }

    return week;
  }

  function buildActivityStats(gymRows, activityRows) {
    const stats = {};

    const gym = sumGymWorkouts(gymRows);
    if (gym.duration || gym.zoneMinutes || gym.cardioLoad) stats.gym = gym;

    const badminton = sumActivityType(activityRows, "badminton");
    if (badminton.duration || badminton.zoneMinutes || badminton.cardioLoad) stats.badminton = badminton;

    const cycling = sumActivityType(activityRows, "cycling");
    if (cycling.duration || cycling.zoneMinutes || cycling.cardioLoad) stats.cycling = cycling;

    const others = sumOtherActivities(activityRows);
    if (others.duration || others.zoneMinutes || others.cardioLoad) stats.others = others;

    return stats;
  }

  function sumGymWorkouts(gymRows) {
    const seen = new Set();
    return gymRows.reduce(
      (totals, row) => {
        const workoutId = String(row.workoutId || "");
        if (!workoutId || seen.has(workoutId)) return totals;
        seen.add(workoutId);
        totals.duration += parseNumber(row.duration);
        totals.zoneMinutes += parseNumber(row.zoneMinutes);
        totals.cardioLoad += parseNumber(row.cardioLoad);
        return totals;
      },
      { duration: 0, zoneMinutes: 0, cardioLoad: 0 },
    );
  }

  function sumActivityType(activityRows, activityName) {
    return activityRows
      .filter((row) => String(row.activity).toLowerCase() === activityName)
      .reduce(
        (totals, row) => {
          totals.duration += parseNumber(row.duration);
          totals.zoneMinutes += parseNumber(row.zoneMinutes);
          totals.cardioLoad += parseNumber(row.cardioLoad);
          return totals;
        },
        { duration: 0, zoneMinutes: 0, cardioLoad: 0 },
      );
  }

  function sumOtherActivities(activityRows) {
    const known = new Set(["badminton", "cycling"]);
    return activityRows
      .filter((row) => !known.has(String(row.activity).toLowerCase()))
      .reduce(
        (totals, row) => {
          totals.duration += parseNumber(row.duration);
          totals.zoneMinutes += parseNumber(row.zoneMinutes);
          totals.cardioLoad += parseNumber(row.cardioLoad);
          return totals;
        },
        { duration: 0, zoneMinutes: 0, cardioLoad: 0 },
      );
  }

  function buildHealthStats(healthRows) {
    if (!healthRows.length) return null;

    const latest = healthRows[healthRows.length - 1];
    const stats = {};

    if (hasValue(latest.steps)) stats.steps = latest.steps;
    if (hasValue(latest.azm)) stats.azm = latest.azm;
    if (hasValue(latest.sleep)) stats.sleep = latest.sleep;
    if (hasValue(latest.sleepScore)) stats.sleepScore = latest.sleepScore;
    if (hasValue(latest.readinessScore)) stats.readinessScore = latest.readinessScore;
    if (hasValue(latest.weight)) stats.weight = latest.weight;

    return Object.keys(stats).length ? stats : null;
  }

  function buildDiaryStats(diaryRows) {
    if (!diaryRows.length) return null;

    const latest = diaryRows[diaryRows.length - 1];
    const entry = String(latest.entry || "").trim();
    if (!entry) return null;

    return { entry };
  }

  function weekDates(today) {
    const end = parseDateKey(today);
    const dates = [];

    for (let offset = 6; offset >= 0; offset -= 1) {
      const date = new Date(end);
      date.setDate(end.getDate() - offset);
      dates.push(formatDateKey(date));
    }

    return dates;
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

  function parseNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }

  function hasValue(value) {
    return value !== "" && value !== null && value !== undefined;
  }

  function resolveDate(date) {
    const value = String(date || "").trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    return todayKey();
  }

  return {
    CONFIG,
    request,
    isDemoMode,
  };
})();
