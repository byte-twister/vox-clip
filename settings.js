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
  saveBtn: document.getElementById("saveBtn"),
  status: document.getElementById("status")
};

function storageGet(defaults) {
  return new Promise((resolve) => {
    chrome.storage.local.get(defaults, (items) => {
      resolve(items);
    });
  });
}

function storageSet(items) {
  return new Promise((resolve) => {
    chrome.storage.local.set(items, resolve);
  });
}

function updateProviderVisibility() {
  const provider = els.provider.value;
  els.builtinFields.style.display = provider === "builtin" ? "block" : "none";
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

  const customOption = document.createElement("option");
  customOption.value = "";
  customOption.textContent = "Custom voice ID";
  els.elevenLabsVoiceSelect.append(customOption);

  voices.forEach((voice) => {
    const option = document.createElement("option");
    option.value = voice.voice_id;
    option.textContent = `${voice.name} (${voice.voice_id})`;
    option.selected = voice.voice_id === selectedVoiceId;
    els.elevenLabsVoiceSelect.append(option);
  });

  if (!voices.some((voice) => voice.voice_id === selectedVoiceId)) {
    els.elevenLabsVoiceSelect.value = "";
  }
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
  const settings = await storageGet(DEFAULT_SETTINGS);

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
  await refreshElevenLabsCatalog();
  updateProviderVisibility();

  speechSynthesis.addEventListener("voiceschanged", () => {
    loadVoices(els.builtinVoice.value);
  });
}

els.provider.addEventListener("change", updateProviderVisibility);
els.speed.addEventListener("input", setRangeOutput);
els.pitch.addEventListener("input", setRangeOutput);
els.elevenLabsRefreshBtn.addEventListener("click", refreshElevenLabsCatalog);
els.elevenLabsVoiceSelect.addEventListener("change", () => {
  if (els.elevenLabsVoiceSelect.value) {
    els.elevenLabsVoiceId.value = els.elevenLabsVoiceSelect.value;
  }
});
els.elevenLabsVoiceId.addEventListener("input", () => {
  const trimmed = els.elevenLabsVoiceId.value.trim();
  const hasMatchingOption = Array.from(els.elevenLabsVoiceSelect.options).some((option) => option.value === trimmed);
  els.elevenLabsVoiceSelect.value = hasMatchingOption ? trimmed : "";
});

els.saveBtn.addEventListener("click", async () => {
  const payload = {
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

  await storageSet(payload);
  els.status.textContent = "Saved";
  setTimeout(() => {
    els.status.textContent = "";
  }, 1400);
});

init();
