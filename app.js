const STORAGE_DAYS_KEY = "tiny-week:v1:days";
const STORAGE_WEEKS_KEY = "tiny-week:v1:initialized-weeks";
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

const MEALS = [
  "beefstew",
  "chickencurry",
  "dakgalbi",
  "dwaejigukbap",
  "galbitang",
  "miyeokguk",
  "random",
  "samgyeop",
  "tteokbokki",
  "tteokguk",
];

const BUILT_IN_VOIDMOON = {
  2026: [
    { start: "2026-06-30T14:20:00+09:00", end: "2026-06-30T18:05:00+09:00" },
    { start: "2026-07-02T23:10:00+09:00", end: "2026-07-03T02:40:00+09:00" },
    { start: "2026-07-05T23:10:00+09:00", end: "2026-07-06T02:40:00+09:00" },
    { start: "2026-12-31T22:10:00+09:00", end: "2027-01-01T01:20:00+09:00" },
  ],
  2027: [
    { start: "2027-01-10T00:00:00+09:00", end: "2027-01-12T02:15:00+09:00" },
  ],
};

const state = {
  currentWeekStart: startOfWeek(new Date()),
  daysData: readJson(STORAGE_DAYS_KEY, {}),
  initializedWeeks: readJson(STORAGE_WEEKS_KEY, {}),
  voidmoonByYear: new Map(),
  selectedMealDate: null,
  selectedMovieDate: null,
};

const elements = {
  weekRange: document.querySelector("#weekRange"),
  weekGrid: document.querySelector("#weekGrid"),
  prevWeekButton: document.querySelector("#prevWeekButton"),
  nextWeekButton: document.querySelector("#nextWeekButton"),
  currentWeekButton: document.querySelector("#currentWeekButton"),
  mealModal: document.querySelector("#mealModal"),
  mealModalTitle: document.querySelector("#mealModalTitle"),
  menuGrid: document.querySelector("#menuGrid"),
  movieModal: document.querySelector("#movieModal"),
  movieForm: document.querySelector("#movieForm"),
  movieModalTitle: document.querySelector("#movieModalTitle"),
  movieModalDate: document.querySelector("#movieModalDate"),
  movieTimeInput: document.querySelector("#movieTimeInput"),
  movieTitleInput: document.querySelector("#movieTitleInput"),
  deleteMovieButton: document.querySelector("#deleteMovieButton"),
  saveMovieButton: document.querySelector("#saveMovieButton"),
};

document.addEventListener("DOMContentLoaded", init);

function init() {
  renderMenuOptions();
  bindEvents();
  registerServiceWorker();
  render();
}

function bindEvents() {
  elements.prevWeekButton.addEventListener("click", () => moveWeek(-1));
  elements.nextWeekButton.addEventListener("click", () => moveWeek(1));
  elements.currentWeekButton.addEventListener("click", () => {
    state.currentWeekStart = startOfWeek(new Date());
    render();
  });

  document.querySelectorAll("[data-close-modal]").forEach((button) => {
    button.addEventListener("click", closeModals);
  });

  elements.mealModal.addEventListener("click", closeOnLayerClick);
  elements.movieModal.addEventListener("click", closeOnLayerClick);
  elements.movieForm.addEventListener("submit", saveMovie);
  elements.deleteMovieButton.addEventListener("click", deleteMovie);
  elements.movieTimeInput.addEventListener("input", updateMovieSaveState);
  elements.movieTitleInput.addEventListener("input", updateMovieSaveState);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeModals();
    }
  });
}

async function render() {
  ensureWeekDefaults(state.currentWeekStart);
  const days = getWeekDays(state.currentWeekStart);
  elements.weekRange.textContent = formatWeekRange(days[0], days[6]);
  const voidmoonItems = await loadVoidmoonForWeek(days);
  elements.weekGrid.replaceChildren(...days.map((day) => renderDayColumn(day, voidmoonItems)));
}

function renderDayColumn(day, voidmoonItems) {
  const key = dateKey(day);
  const data = state.daysData[key] ?? {};
  const column = document.createElement("section");
  column.className = "day-column";
  column.setAttribute("aria-label", formatLongDate(day));

  if (key === dateKey(new Date())) {
    column.classList.add("is-today");
  }

  const dateCell = document.createElement("div");
  dateCell.className = "date-cell";
  dateCell.innerHTML = `<span class="day-name">${WEEKDAYS[day.getDay()]}</span><span class="day-date">${day.getMonth() + 1}.${day.getDate()}</span>`;

  const mealCell = document.createElement("button");
  mealCell.className = "meal-cell";
  mealCell.type = "button";
  mealCell.setAttribute("aria-label", `${formatLongDate(day)} 식단 선택`);
  mealCell.addEventListener("click", () => openMealModal(key, day));

  if (data.meal) {
    const mealImage = document.createElement("img");
    mealImage.src = `assets/${data.meal}.png`;
    mealImage.alt = data.meal;
    mealCell.append(mealImage);
  } else {
    const empty = document.createElement("span");
    empty.className = "empty-meal";
    empty.textContent = "+";
    mealCell.append(empty);
  }

  const voidCell = document.createElement("div");
  const voidSegments = getVoidSegmentsForDay(day, voidmoonItems);
  voidCell.className = getVoidClassName(voidSegments);
  voidCell.textContent = voidSegments.map((segment) => segment.label).join(" / ");

  const movieCell = document.createElement("button");
  movieCell.className = "movie-cell";
  movieCell.type = "button";
  movieCell.setAttribute("aria-label", `${formatLongDate(day)} 영화 일정`);
  movieCell.addEventListener("click", () => openMovieModal(key, day));

  if (data.movie) {
    movieCell.innerHTML = `<span class="movie-time">${escapeHtml(data.movie.time)}</span><span class="movie-title">${escapeHtml(data.movie.title)}</span>`;
  } else {
    const plus = document.createElement("span");
    plus.className = "movie-add-button";
    plus.textContent = "+";
    movieCell.append(plus);
  }

  column.append(dateCell, mealCell, voidCell, movieCell);
  return column;
}

function renderMenuOptions() {
  const fragment = document.createDocumentFragment();

  MEALS.forEach((meal) => {
    const button = document.createElement("button");
    button.className = "menu-option";
    button.type = "button";
    button.setAttribute("aria-label", meal);
    button.addEventListener("click", () => selectMeal(meal));

    const image = document.createElement("img");
    image.src = `assets/${meal}.png`;
    image.alt = meal;
    button.append(image);
    fragment.append(button);
  });

  elements.menuGrid.replaceChildren(fragment);
}

function openMealModal(key, day) {
  state.selectedMealDate = key;
  elements.mealModalTitle.textContent = `${formatShortDate(day)} 식단`;
  openModal(elements.mealModal);
}

function selectMeal(meal) {
  if (!state.selectedMealDate) {
    return;
  }

  const current = state.daysData[state.selectedMealDate] ?? {};
  state.daysData[state.selectedMealDate] = { ...current, meal };
  persistDays();
  closeModals();
  render();
}

function openMovieModal(key, day) {
  const movie = state.daysData[key]?.movie;
  state.selectedMovieDate = key;
  elements.movieModalTitle.textContent = "영화";
  elements.movieModalDate.textContent = formatLongDate(day);
  elements.movieTimeInput.value = movie?.time ?? "";
  elements.movieTitleInput.value = movie?.title ?? "";
  elements.deleteMovieButton.disabled = !movie;
  updateMovieSaveState();
  openModal(elements.movieModal);
  setTimeout(() => elements.movieTimeInput.focus(), 0);
}

function saveMovie(event) {
  event.preventDefault();
  if (!state.selectedMovieDate) {
    return;
  }

  const time = elements.movieTimeInput.value;
  const title = elements.movieTitleInput.value.trim();
  if (!time || !title) {
    return;
  }

  const current = state.daysData[state.selectedMovieDate] ?? {};
  state.daysData[state.selectedMovieDate] = {
    ...current,
    movie: { time, title },
  };
  persistDays();
  closeModals();
  render();
}

function deleteMovie() {
  if (!state.selectedMovieDate || !state.daysData[state.selectedMovieDate]?.movie) {
    return;
  }

  const current = { ...state.daysData[state.selectedMovieDate] };
  delete current.movie;
  state.daysData[state.selectedMovieDate] = current;
  persistDays();
  closeModals();
  render();
}

function updateMovieSaveState() {
  elements.saveMovieButton.disabled = !elements.movieTimeInput.value || !elements.movieTitleInput.value.trim();
}

function openModal(modal) {
  modal.classList.remove("is-hidden");
}

function closeModals() {
  state.selectedMealDate = null;
  state.selectedMovieDate = null;
  elements.mealModal.classList.add("is-hidden");
  elements.movieModal.classList.add("is-hidden");
}

function closeOnLayerClick(event) {
  if (event.target.classList.contains("modal-layer")) {
    closeModals();
  }
}

function moveWeek(offset) {
  state.currentWeekStart = addDays(state.currentWeekStart, offset * 7);
  render();
}

function ensureWeekDefaults(weekStart) {
  const weekKey = dateKey(weekStart);
  if (state.initializedWeeks[weekKey]) {
    return;
  }

  const defaults = [
    [1, "dakgalbi"],
    [4, "dakgalbi"],
    [5, "random"],
  ];

  defaults.forEach(([offset, meal]) => {
    const key = dateKey(addDays(weekStart, offset));
    state.daysData[key] = { ...(state.daysData[key] ?? {}), meal };
  });

  state.initializedWeeks[weekKey] = true;
  persistDays();
  localStorage.setItem(STORAGE_WEEKS_KEY, JSON.stringify(state.initializedWeeks));
}

async function loadVoidmoonForWeek(days) {
  const years = new Set(days.map((day) => day.getFullYear()));
  years.add(days[0].getFullYear() - 1);
  years.add(days[6].getFullYear() + 1);

  const batches = await Promise.all([...years].map((year) => loadVoidmoonYear(year)));
  return batches.flat().map((item) => ({
    start: parseVoidDate(item.start),
    end: parseVoidDate(item.end),
  }));
}

async function loadVoidmoonYear(year) {
  if (state.voidmoonByYear.has(year)) {
    return state.voidmoonByYear.get(year);
  }

  let items = BUILT_IN_VOIDMOON[year] ?? [];

  try {
    const response = await fetch(`data/voidmoon/${year}.json`, { cache: "force-cache" });
    if (response.ok) {
      items = await response.json();
    }
  } catch (_error) {
    items = BUILT_IN_VOIDMOON[year] ?? [];
  }

  state.voidmoonByYear.set(year, items);
  return items;
}

function getVoidSegmentsForDay(day, items) {
  const dayStart = startOfDay(day);
  const dayEnd = addDays(dayStart, 1);

  return items
    .filter((item) => item.start < dayEnd && item.end > dayStart)
    .map((item) => {
      const coversFullDay = item.start <= dayStart && item.end >= dayEnd;
      const startsBefore = item.start < dayStart;
      const endsAfter = item.end > dayEnd;
      const startsToday = item.start >= dayStart && item.start < dayEnd;
      const endsToday = item.end > dayStart && item.end <= dayEnd;

      if (coversFullDay) {
        return { label: "ALL", position: "middle" };
      }

      if (startsToday && endsToday) {
        return { label: `${formatTime(item.start)}–${formatTime(item.end)}`, position: "single" };
      }

      if (startsBefore && endsToday) {
        return { label: `→ ${formatTime(item.end)}`, position: "end" };
      }

      if (startsToday && endsAfter) {
        return { label: `${formatTime(item.start)} →`, position: "start" };
      }

      return { label: "ALL", position: "middle" };
    });
}

function getVoidClassName(segments) {
  const classes = ["void-cell"];
  if (!segments.length) {
    return classes.join(" ");
  }

  classes.push("is-active");
  if (segments.length > 1) {
    return classes.join(" ");
  }

  classes.push(`is-${segments[0].position}`);
  return classes.join(" ");
}

function readJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch (_error) {
    return fallback;
  }
}

function persistDays() {
  localStorage.setItem(STORAGE_DAYS_KEY, JSON.stringify(state.daysData));
}

function getWeekDays(weekStart) {
  return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
}

function startOfWeek(date) {
  const clean = startOfDay(date);
  const mondayOffset = (clean.getDay() + 6) % 7;
  return addDays(clean, -mondayOffset);
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date, days) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function dateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function formatWeekRange(start, end) {
  return `${start.getMonth() + 1}.${start.getDate()}–${end.getMonth() + 1}.${end.getDate()}`;
}

function formatShortDate(date) {
  return `${date.getMonth() + 1}.${date.getDate()} ${WEEKDAYS[date.getDay()]}`;
}

function formatLongDate(date) {
  return `${date.getFullYear()}.${date.getMonth() + 1}.${date.getDate()} ${WEEKDAYS[date.getDay()]}`;
}

function formatTime(date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function parseVoidDate(value) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!match) {
    return new Date(value);
  }

  const [, year, month, day, hour, minute] = match.map(Number);
  return new Date(year, month - 1, day, hour, minute);
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return entities[character];
  });
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  navigator.serviceWorker.register("service-worker.js").catch(() => {});
}
