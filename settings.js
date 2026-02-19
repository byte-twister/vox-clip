const DEFAULT_SETTINGS = {
  provider: "builtin",
  builtinVoice: "",
  speed: 1,
  pitch: 1,
  openaiApiKey: "",
  openaiVoice: "alloy",
  openaiModel: "gpt-4o-mini-tts",
  elevenLabsApiKey: "",
  elevenLabsModelId: "eleven_multilingual_v2",
  elevenLabsVoiceId: ""
};

const viewMode = new URLSearchParams(window.location.search).get("mode") === "popup"
  ? "popup"
  : "page";

document.body.dataset.view = viewMode;

const SAVE_DEBOUNCE_MS = 260;

const FALLBACK_ELEVEN_MODELS = [
  {
    model_id: "eleven_multilingual_v2",
    name: "Eleven Multilingual v2"
  },
  {
    model_id: "eleven_flash_v2_5",
    name: "Eleven Flash v2.5"
  },
  {
    model_id: "eleven_turbo_v2_5",
    name: "Eleven Turbo v2.5"
  }
];

const els = {
  provider: document.getElementById("provider"),
  builtinFields: document.getElementById("builtinFields"),
  builtinVoice: document.getElementById("builtinVoice"),
  speed: document.getElementById("speed"),
  speedOut: document.getElementById("speedOut"),
  pitchField: document.getElementById("pitchField"),
  pitch: document.getElementById("pitch"),
  pitchOut: document.getElementById("pitchOut"),
  openaiApiKey: document.getElementById("openaiApiKey"),
  openaiVoice: document.getElementById("openaiVoice"),
  openaiModel: document.getElementById("openaiModel"),
  elevenLabsApiKey: document.getElementById("elevenLabsApiKey"),
  elevenLabsModelId: document.getElementById("elevenLabsModelId"),
  elevenLabsVoiceSelect: document.getElementById("elevenLabsVoiceSelect"),
  elevenLabsVoiceId: document.getElementById("elevenLabsVoiceId"),
  elevenLabsRefreshBtn: document.getElementById("elevenLabsRefreshBtn"),
  elevenLabsFetchStatus: document.getElementById("elevenLabsFetchStatus"),
  openaiFields: document.getElementById("openaiFields"),
  elevenLabsFields: document.getElementById("elevenLabsFields"),
  status: document.getElementById("status")
};

const state = {
  isHydrating: true,
  saveTimerId: 0,
  statusTimerId: 0
};

function storageGet(defaults) {
  return new Promise((resolve, reject) => {
    try {
      chrome.storage.local.get(defaults, (items) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(items);
      });
    } catch (error) {
      reject(error);
    }
  });
}

function storageSet(items) {
  return new Promise((resolve, reject) => {
    try {
      chrome.storage.local.set(items, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve();
      });
    } catch (error) {
      reject(error);
    }
  });
}

function isContextInvalidated(error) {
  const message = String(error?.message || "");
  return message.includes("Extension context invalidated");
}

function showStatus(message, isError = false) {
  els.status.textContent = message;
  els.status.style.color = isError ? "#f85149" : "#56d364";
}

function clearStatusSoon() {
  clearTimeout(state.statusTimerId);
  state.statusTimerId = setTimeout(() => {
    els.status.textContent = "";
  }, 1100);
}

function buildPayload() {
  return {
    provider: els.provider.value,
    builtinVoice: els.builtinVoice.value,
    speed: Number(els.speed.value),
    pitch: Number(els.pitch.value),
    openaiApiKey: els.openaiApiKey.value.trim(),
    openaiVoice: els.openaiVoice.value.trim() || "alloy",
    openaiModel: els.openaiModel.value.trim() || "gpt-4o-mini-tts",
    elevenLabsApiKey: els.elevenLabsApiKey.value.trim(),
    elevenLabsModelId: els.elevenLabsModelId.value || DEFAULT_SETTINGS.elevenLabsModelId,
    elevenLabsVoiceId: els.elevenLabsVoiceId.value.trim()
  };
}

async function saveSettings() {
  if (state.isHydrating) return;

  try {
    await storageSet(buildPayload());
    showStatus("Saved");
    clearStatusSoon();
  } catch (error) {
    if (isContextInvalidated(error)) {
      showStatus("Extension updated. Reload this settings page.", true);
      return;
    }
    showStatus("Could not save settings", true);
  }
}

function scheduleSave() {
  if (state.isHydrating) return;

  clearTimeout(state.saveTimerId);
  state.saveTimerId = setTimeout(() => {
    saveSettings();
  }, SAVE_DEBOUNCE_MS);
}

function updateProviderVisibility() {
  const provider = els.provider.value;
  els.builtinFields.style.display = provider === "builtin" ? "block" : "none";
  els.pitchField.style.display = provider === "builtin" ? "block" : "none";
  els.openaiFields.style.display = provider === "openai" ? "block" : "none";
  els.elevenLabsFields.style.display = provider === "elevenlabs" ? "block" : "none";
}

function setRangeOutput() {
  els.speedOut.value = Number(els.speed.value).toFixed(1);
  els.pitchOut.value = Number(els.pitch.value).toFixed(1);
}

function setElevenLabsFetchStatus(message, isError = false) {
  els.elevenLabsFetchStatus.textContent = message;
  els.elevenLabsFetchStatus.dataset.error = isError ? "true" : "false";
}

function populateElevenLabsModels(models, selectedModelId) {
  els.elevenLabsModelId.innerHTML = "";

  models.forEach((model) => {
    const option = document.createElement("option");
    option.value = model.model_id;
    option.textContent = model.name || model.model_id;
    option.selected = model.model_id === selectedModelId;
    els.elevenLabsModelId.append(option);
  });

  if (!models.length) {
    const option = document.createElement("option");
    option.value = DEFAULT_SETTINGS.elevenLabsModelId;
    option.textContent = "Eleven Multilingual v2";
    els.elevenLabsModelId.append(option);
    return;
  }

  if (!models.some((model) => model.model_id === selectedModelId)) {
    els.elevenLabsModelId.value = models[0].model_id;
  }
}

function populateElevenLabsVoices(voices, selectedVoiceId) {
  els.elevenLabsVoiceSelect.innerHTML = "";

  const placeholderOption = document.createElement("option");
  placeholderOption.value = "";
  placeholderOption.textContent = voices.length ? "Select a voice" : "No voices loaded";
  els.elevenLabsVoiceSelect.append(placeholderOption);

  voices.forEach((voice) => {
    const option = document.createElement("option");
    option.value = voice.voice_id;
    option.textContent = voice.name;
    option.selected = voice.voice_id === selectedVoiceId;
    els.elevenLabsVoiceSelect.append(option);
  });

  const hasSelectedVoice = voices.some((voice) => voice.voice_id === selectedVoiceId);
  if (!hasSelectedVoice) {
    if (selectedVoiceId) {
      const existingOption = document.createElement("option");
      existingOption.value = selectedVoiceId;
      existingOption.textContent = "Previously selected voice";
      existingOption.selected = true;
      els.elevenLabsVoiceSelect.append(existingOption);
    } else {
      els.elevenLabsVoiceSelect.value = "";
    }
  }

  els.elevenLabsVoiceId.value = selectedVoiceId || "";
}

async function fetchElevenLabsCatalog(apiKey) {
  const headers = {
    "xi-api-key": apiKey
  };

  const [modelsRes, voicesRes] = await Promise.all([
    fetch("https://api.elevenlabs.io/v1/models", { headers }),
    fetch("https://api.elevenlabs.io/v1/voices", { headers })
  ]);

  if (!modelsRes.ok) {
    throw new Error(`Could not load ElevenLabs models (${modelsRes.status})`);
  }

  if (!voicesRes.ok) {
    throw new Error(`Could not load ElevenLabs voices (${voicesRes.status})`);
  }

  const modelsJson = await modelsRes.json();
  const voicesJson = await voicesRes.json();

  const models = Array.isArray(modelsJson)
    ? modelsJson.map((model) => ({
      model_id: model.model_id,
      name: model.name
    })).filter((model) => model.model_id)
    : [];
  const voices = Array.isArray(voicesJson?.voices)
    ? voicesJson.voices.map((voice) => ({
      voice_id: voice.voice_id,
      name: voice.name || "Voice"
    })).filter((voice) => voice.voice_id)
    : [];

  return { models, voices };
}

async function refreshElevenLabsCatalog() {
  const apiKey = els.elevenLabsApiKey.value.trim();
  const selectedModelId = els.elevenLabsModelId.value || DEFAULT_SETTINGS.elevenLabsModelId;
  const selectedVoiceId = els.elevenLabsVoiceId.value.trim();

  if (!apiKey) {
    populateElevenLabsModels(FALLBACK_ELEVEN_MODELS, selectedModelId);
    populateElevenLabsVoices([], selectedVoiceId);
    setElevenLabsFetchStatus("Add an API key to load your ElevenLabs models and voices.");
    return;
  }

  setElevenLabsFetchStatus("Loading models and voices...");

  try {
    const catalog = await fetchElevenLabsCatalog(apiKey);
    populateElevenLabsModels(catalog.models.length ? catalog.models : FALLBACK_ELEVEN_MODELS, selectedModelId);
    populateElevenLabsVoices(catalog.voices, selectedVoiceId);
    setElevenLabsFetchStatus(`Loaded ${catalog.models.length} models and ${catalog.voices.length} voices.`);
  } catch (error) {
    populateElevenLabsModels(FALLBACK_ELEVEN_MODELS, selectedModelId);
    setElevenLabsFetchStatus(error.message || "Failed to load ElevenLabs catalog.", true);
  }
}

function loadVoices(selectedName) {
  const voices = speechSynthesis.getVoices();
  els.builtinVoice.innerHTML = "";

  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = "System default";
  els.builtinVoice.append(defaultOption);

  voices.forEach((voice) => {
    const option = document.createElement("option");
    option.value = voice.name;
    option.textContent = `${voice.name} (${voice.lang})`;
    option.selected = voice.name === selectedName;
    els.builtinVoice.append(option);
  });

  if (!voices.some((voice) => voice.name === selectedName)) {
    els.builtinVoice.value = "";
  }
}

async function init() {
  let settings;
  try {
    settings = await storageGet(DEFAULT_SETTINGS);
  } catch (error) {
    if (isContextInvalidated(error)) {
      showStatus("Extension updated. Reload this settings page.", true);
      return;
    }
    throw error;
  }

  els.provider.value = settings.provider;
  els.speed.value = settings.speed;
  els.pitch.value = settings.pitch;
  els.openaiApiKey.value = settings.openaiApiKey;
  els.openaiVoice.value = settings.openaiVoice;
  els.openaiModel.value = settings.openaiModel;
  els.elevenLabsApiKey.value = settings.elevenLabsApiKey;
  els.elevenLabsModelId.value = settings.elevenLabsModelId;
  els.elevenLabsVoiceId.value = settings.elevenLabsVoiceId;

  setRangeOutput();
  loadVoices(settings.builtinVoice);
  populateElevenLabsModels(FALLBACK_ELEVEN_MODELS, settings.elevenLabsModelId);
  populateElevenLabsVoices([], settings.elevenLabsVoiceId);
  updateProviderVisibility();
  if (els.provider.value === "elevenlabs") {
    await refreshElevenLabsCatalog();
  }

  speechSynthesis.addEventListener("voiceschanged", () => {
    loadVoices(els.builtinVoice.value);
  });

  state.isHydrating = false;
}

els.provider.addEventListener("change", async () => {
  updateProviderVisibility();
  if (els.provider.value === "elevenlabs") {
    await refreshElevenLabsCatalog();
  }
  scheduleSave();
});
els.speed.addEventListener("input", () => {
  setRangeOutput();
  scheduleSave();
});
els.pitch.addEventListener("input", () => {
  setRangeOutput();
  scheduleSave();
});
els.elevenLabsRefreshBtn.addEventListener("click", refreshElevenLabsCatalog);
els.elevenLabsVoiceSelect.addEventListener("change", () => {
  els.elevenLabsVoiceId.value = els.elevenLabsVoiceSelect.value;
  scheduleSave();
});

[els.builtinVoice, els.openaiVoice, els.openaiModel, els.elevenLabsModelId].forEach((el) => {
  el.addEventListener("change", scheduleSave);
});

[els.openaiApiKey, els.elevenLabsApiKey].forEach((el) => {
  el.addEventListener("input", scheduleSave);
  el.addEventListener("change", scheduleSave);
});

init().catch(() => {
  showStatus("Could not load settings", true);
});
