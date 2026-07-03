const LifeDashboardApi = (() => {
  const CONFIG = {
    // Paste your deployed Google Apps Script Web App URL here after deployment.
    // Example: https://script.google.com/macros/s/AKfycb.../exec
    appsScriptUrl: "https://script.google.com/macros/s/AKfycbxgFwTaGw0ey7LS8769useDSjYgqWvArV2lZO_LTTduqTpNpo2xq3fdRHNvUzJB0YSo/exec",
  };

  const STORE_KEY = "life-dashboard-demo-data-v1";

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
    activityLog: [],
    healthLog: [],
    diary: [],
  };

  function todayKey() {
    return new Date().toISOString().slice(0, 10);
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
      return Promise.resolve({
        demoMode: true,
        today: todayKey(),
        exercises: data.exercises.filter((exercise) => exercise.active),
        summaries: buildSummaries(data),
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
      payload.items.forEach((item, index) => {
        data.gymLog.push({
          workoutId,
          date: todayKey(),
          order: index + 1,
          ...item,
        });
      });
      saveLocal(data);
      return Promise.resolve({ workoutId, savedRows: payload.items.length });
    }

    if (action === "saveActivity") {
      data.activityLog.push({ date: todayKey(), ...payload });
      saveLocal(data);
      return Promise.resolve({ saved: true });
    }

    if (action === "saveHealth") {
      data.healthLog.push({ date: todayKey(), ...payload });
      saveLocal(data);
      return Promise.resolve({ saved: true });
    }

    if (action === "saveDiary") {
      data.diary.push({ date: todayKey(), ...payload });
      saveLocal(data);
      return Promise.resolve({ saved: true });
    }

    return Promise.reject(new Error(`Unknown action: ${action}`));
  }

  function buildSummaries(data) {
    const today = todayKey();
    return {
      gymExercisesToday: data.gymLog.filter((row) => row.date === today).length,
      activitiesToday: data.activityLog.filter((row) => row.date === today).length,
      healthToday: data.healthLog.some((row) => row.date === today),
      diaryToday: data.diary.some((row) => row.date === today),
    };
  }

  return {
    CONFIG,
    request,
    isDemoMode,
  };
})();
