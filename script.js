const WEATHER_CODES = {
  0: { label: "Clear sky", icon: "☀️" },
  1: { label: "Mostly clear", icon: "🌤️" },
  2: { label: "Partly cloudy", icon: "⛅" },
  3: { label: "Overcast", icon: "☁️" },
  45: { label: "Foggy", icon: "🌫️" },
  48: { label: "Rime fog", icon: "🌫️" },
  51: { label: "Light drizzle", icon: "🌦️" },
  53: { label: "Drizzle", icon: "🌦️" },
  55: { label: "Heavy drizzle", icon: "🌧️" },
  56: { label: "Freezing drizzle", icon: "🌧️" },
  57: { label: "Heavy freezing drizzle", icon: "🌧️" },
  61: { label: "Light rain", icon: "🌦️" },
  63: { label: "Rain", icon: "🌧️" },
  65: { label: "Heavy rain", icon: "🌧️" },
  66: { label: "Freezing rain", icon: "🌧️" },
  67: { label: "Heavy freezing rain", icon: "🌧️" },
  71: { label: "Light snow", icon: "🌨️" },
  73: { label: "Snow", icon: "❄️" },
  75: { label: "Heavy snow", icon: "❄️" },
  77: { label: "Snow grains", icon: "❄️" },
  80: { label: "Rain showers", icon: "🌦️" },
  81: { label: "Showers", icon: "🌧️" },
  82: { label: "Heavy showers", icon: "⛈️" },
  85: { label: "Snow showers", icon: "🌨️" },
  86: { label: "Heavy snow showers", icon: "🌨️" },
  95: { label: "Thunderstorm", icon: "⛈️" },
  96: { label: "Storm with hail", icon: "⛈️" },
  99: { label: "Severe storm", icon: "⛈️" },
};

const STORAGE_KEYS = {
  unit: "weatherwear-unit",
  theme: "weatherwear-theme",
};

const state = {
  unit: localStorage.getItem(STORAGE_KEYS.unit) || "metric",
  theme: localStorage.getItem(STORAGE_KEYS.theme) || getPreferredTheme(),
  latestForecast: null,
};

const form = document.querySelector("#location-form");
const cityInput = document.querySelector("#city-input");
const geoButton = document.querySelector("#geo-button");
const statusEl = document.querySelector("#status");
const summaryPanel = document.querySelector("#summary-panel");
const locationNameEl = document.querySelector("#location-name");
const summaryTextEl = document.querySelector("#summary-text");
const forecastGrid = document.querySelector("#forecast-grid");
const cardTemplate = document.querySelector("#forecast-card-template");
const themeToggle = document.querySelector("#theme-toggle");
const unitToggleButtons = document.querySelectorAll("[data-unit-toggle]");

applyTheme(state.theme);
syncUnitButtons();
syncThemeButton();

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const city = cityInput.value.trim();

  if (!city) {
    setStatus("Enter a city to load the forecast.");
    return;
  }

  await loadByCity(city);
});

unitToggleButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const nextUnit = button.dataset.unitToggle;
    if (!nextUnit || nextUnit === state.unit) {
      return;
    }

    state.unit = nextUnit;
    localStorage.setItem(STORAGE_KEYS.unit, state.unit);
    syncUnitButtons();

    if (state.latestForecast) {
      renderForecast(state.latestForecast.daily, state.latestForecast.label);
    }
  });
});

themeToggle.addEventListener("click", () => {
  state.theme = state.theme === "light" ? "dark" : "light";
  localStorage.setItem(STORAGE_KEYS.theme, state.theme);
  applyTheme(state.theme);
  syncThemeButton();
});

geoButton.addEventListener("click", async () => {
  if (!navigator.geolocation) {
    setStatus("Geolocation is not available in this browser.");
    return;
  }

  setLoadingState(true, "Finding your location...");

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const { latitude, longitude } = position.coords;
      await loadForecast({
        latitude,
        longitude,
        label: "Your current location",
      });
    },
    () => {
      setLoadingState(false);
      setStatus("Location access was denied. Search by city instead.");
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
});

async function loadByCity(city) {
  setLoadingState(true, `Looking up ${city}...`);

  try {
    const geocodeUrl = new URL("https://geocoding-api.open-meteo.com/v1/search");
    geocodeUrl.search = new URLSearchParams({
      name: city,
      count: "1",
      language: "en",
      format: "json",
    });

    const response = await fetch(geocodeUrl);
    if (!response.ok) {
      throw new Error("Unable to find that city right now.");
    }

    const data = await response.json();
    const place = data.results?.[0];

    if (!place) {
      throw new Error("No matching city found. Try a broader search.");
    }

    const labelParts = [place.name, place.admin1, place.country].filter(Boolean);

    await loadForecast({
      latitude: place.latitude,
      longitude: place.longitude,
      label: labelParts.join(", "),
    });
  } catch (error) {
    setLoadingState(false);
    setStatus(error.message || "Something went wrong while loading the city.");
  }
}

async function loadForecast({ latitude, longitude, label }) {
  setLoadingState(true, `Loading forecast for ${label}...`);

  try {
    const forecastUrl = new URL("https://api.open-meteo.com/v1/forecast");
    forecastUrl.search = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
      timezone: "auto",
      forecast_days: "7",
      daily: [
        "weather_code",
        "temperature_2m_max",
        "temperature_2m_min",
        "precipitation_probability_max",
        "precipitation_sum",
        "wind_speed_10m_max",
        "uv_index_max",
      ].join(","),
    });

    const response = await fetch(forecastUrl);
    if (!response.ok) {
      throw new Error("Unable to load the forecast right now.");
    }

    const data = await response.json();
    state.latestForecast = { daily: data.daily, label };
    renderForecast(data.daily, label);
    setLoadingState(false);
    setStatus(`Updated ${label}.`);
  } catch (error) {
    setLoadingState(false);
    setStatus(error.message || "Something went wrong while loading the forecast.");
  }
}

function renderForecast(daily, locationLabel) {
  forecastGrid.innerHTML = "";

  const days = daily.time.map((date, index) => ({
    date,
    weatherCode: Number(daily.weather_code[index]),
    maxTempC: Number(daily.temperature_2m_max[index]),
    minTempC: Number(daily.temperature_2m_min[index]),
    rainChance: Math.round(daily.precipitation_probability_max[index]),
    rainTotal: Number(daily.precipitation_sum[index] || 0),
    windKmh: Number(daily.wind_speed_10m_max[index]),
    uvIndex: Number(daily.uv_index_max[index] || 0),
  }));

  locationNameEl.textContent = locationLabel;
  summaryTextEl.textContent = buildSummary(days);
  summaryPanel.hidden = false;

  days.forEach((day, index) => {
    const card = cardTemplate.content.firstElementChild.cloneNode(true);
    const codeInfo = WEATHER_CODES[day.weatherCode] || {
      label: "Variable weather",
      icon: "🌤️",
    };
    const recommendation = buildRecommendation(day);
    const date = new Date(`${day.date}T12:00:00`);

    card.querySelector(".card-day").textContent =
      index === 0
        ? "Today"
        : new Intl.DateTimeFormat(undefined, { weekday: "long" }).format(date);
    card.querySelector(".card-date").textContent = new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
    }).format(date);
    card.querySelector(".card-range").textContent =
      `${formatTemperature(day.maxTempC)} / ${formatTemperature(day.minTempC)}`;
    card.querySelector(".condition-icon").textContent = codeInfo.icon;
    card.querySelector(".condition-label").textContent = codeInfo.label;
    card.querySelector(".condition-detail").textContent = recommendation.vibe;

    const metrics = [
      `Rain ${day.rainChance}%`,
      formatPrecipitation(day.rainTotal),
      `Wind ${formatWind(day.windKmh)}`,
      `UV ${day.uvIndex.toFixed(1)}`,
    ];

    card.querySelector(".metrics").innerHTML = metrics
      .map((metric) => `<span class="metric-pill">${metric}</span>`)
      .join("");

    card.querySelector(".recommendation-body").textContent = recommendation.summary;

    const recommendationList = card.querySelector(".recommendation-list");
    recommendation.items.forEach((item) => {
      const li = document.createElement("li");
      li.textContent = item;
      recommendationList.appendChild(li);
    });

    forecastGrid.appendChild(card);
  });
}

function buildSummary(days) {
  const averageHigh = days.reduce((total, day) => total + day.maxTempC, 0) / days.length;
  const wetDays = days.filter((day) => day.rainChance >= 45).length;
  const windyDays = days.filter((day) => day.windKmh >= 30).length;

  let tone = `Average daytime high is ${formatTemperature(averageHigh)} over the next week.`;

  if (wetDays >= 4) {
    tone += " It looks like a wetter stretch, so keep rain layers handy.";
  } else if (wetDays > 0) {
    tone += ` Expect ${wetDays} day${wetDays > 1 ? "s" : ""} with meaningful rain chances.`;
  } else {
    tone += " Conditions look mostly dry.";
  }

  if (windyDays >= 2) {
    tone += " A couple of breezy days could make it feel cooler than the thermometer suggests.";
  }

  return tone;
}

function buildRecommendation(day) {
  const layers = [];
  const conditions = [];
  let vibe = "Steady conditions";
  const maxTemp = day.maxTempC;
  const minTemp = day.minTempC;

  if (maxTemp >= 30) {
    vibe = "Hot day";
    layers.push("Breathable short sleeves or a tank");
    layers.push("Shorts, a skirt, or loose lightweight pants");
    conditions.push("Choose airy fabrics and lighter colors.");
  } else if (maxTemp >= 23) {
    vibe = "Warm day";
    layers.push("T-shirt, polo, or light blouse");
    layers.push("Light pants, jeans, or a casual dress");
  } else if (maxTemp >= 16) {
    vibe = "Mild day";
    layers.push("Light layers like a tee with an overshirt");
    layers.push("Jeans, chinos, or a midi skirt");
  } else if (maxTemp >= 9) {
    vibe = "Cool day";
    layers.push("Sweater or long-sleeve top");
    layers.push("Jacket or trench for morning and evening");
    layers.push("Full-length pants");
  } else if (maxTemp >= 2) {
    vibe = "Cold day";
    layers.push("Warm knit or thermal base layer");
    layers.push("Coat plus full-length pants");
    conditions.push("Closed shoes or boots will be more comfortable.");
  } else {
    vibe = "Freezing day";
    layers.push("Thermal layers under a heavy coat");
    layers.push("Insulated pants or thick trousers");
    conditions.push("Prioritize gloves, scarf, and warm socks.");
  }

  if (minTemp <= 8 && maxTemp - minTemp >= 8) {
    conditions.push("Start with a removable layer for the chilly morning.");
  }

  if (day.rainChance >= 45 || day.rainTotal >= 2) {
    layers.push("A rain shell or compact umbrella");
    conditions.push("Water-resistant shoes will help if you are out for long.");
  }

  if (day.windKmh >= 28) {
    conditions.push("A wind-blocking outer layer will make the day feel steadier.");
  }

  if (day.uvIndex >= 6 && maxTemp >= 16) {
    conditions.push("Add sunglasses or a hat for strong sun.");
  }

  if ([71, 73, 75, 77, 85, 86].includes(day.weatherCode)) {
    layers.push("Boots with grip if sidewalks might get slick");
    conditions.push("A water-resistant coat is better than a light jacket.");
  }

  const uniqueLayers = [...new Set(layers)];
  const uniqueConditions = [...new Set(conditions)];

  return {
    vibe,
    summary: uniqueConditions[0] || "A balanced outfit should work well today.",
    items: [...uniqueLayers, ...uniqueConditions].slice(0, 5),
  };
}

function setLoadingState(isLoading, message = "") {
  form.querySelector('button[type="submit"]').disabled = isLoading;
  geoButton.disabled = isLoading;

  if (message) {
    setStatus(message);
  }
}

function setStatus(message) {
  statusEl.textContent = message;
}

function syncUnitButtons() {
  unitToggleButtons.forEach((button) => {
    const isActive = button.dataset.unitToggle === state.unit;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

function syncThemeButton() {
  themeToggle.textContent = state.theme === "light" ? "Dark mode" : "Light mode";
}

function applyTheme(theme) {
  document.body.dataset.theme = theme;
}

function getPreferredTheme() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function formatTemperature(valueCelsius) {
  const rounded =
    state.unit === "metric"
      ? Math.round(valueCelsius)
      : Math.round((valueCelsius * 9) / 5 + 32);
  const symbol = state.unit === "metric" ? "C" : "F";
  return `${rounded}°${symbol}`;
}

function formatWind(valueKmh) {
  if (state.unit === "metric") {
    return `${Math.round(valueKmh)} km/h`;
  }

  return `${Math.round(valueKmh / 1.609)} mph`;
}

function formatPrecipitation(valueMm) {
  if (state.unit === "metric") {
    return `${valueMm.toFixed(1)} mm`;
  }

  return `${(valueMm / 25.4).toFixed(2)} in`;
}

loadByCity("New York");
