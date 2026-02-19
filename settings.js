const DEFAULT_SETTINGS = {
  provider: "builtin",
  builtinVoice: "",
  speed: 1,
  pitch: 1,
  openaiApiKey: "",
  openaiVoice: "alloy",
  openaiModel: "gpt-4o-mini-tts",
  elevenLabsApiKey: "",
  elevenLabsVoiceId: ""
};

const els = {
  provider: document.getElementById("provider"),
  builtinVoice: document.getElementById("builtinVoice"),
  speed: document.getElementById("speed"),
  speedOut: document.getElementById("speedOut"),
  pitch: document.getElementById("pitch"),
  pitchOut: document.getElementById("pitchOut"),
  openaiApiKey: document.getElementById("openaiApiKey"),
  openaiVoice: document.getElementById("openaiVoice"),
  openaiModel: document.getElementById("openaiModel"),
  elevenLabsApiKey: document.getElementById("elevenLabsApiKey"),
  elevenLabsVoiceId: document.getElementById("elevenLabsVoiceId"),
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
  els.openaiFields.style.display = provider === "openai" ? "block" : "none";
  els.elevenLabsFields.style.display = provider === "elevenlabs" ? "block" : "none";
}

function setRangeOutput() {
  els.speedOut.value = Number(els.speed.value).toFixed(1);
  els.pitchOut.value = Number(els.pitch.value).toFixed(1);
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
  els.elevenLabsVoiceId.value = settings.elevenLabsVoiceId;

  setRangeOutput();
  loadVoices(settings.builtinVoice);
  updateProviderVisibility();

  speechSynthesis.addEventListener("voiceschanged", () => {
    loadVoices(els.builtinVoice.value);
  });
}

els.provider.addEventListener("change", updateProviderVisibility);
els.speed.addEventListener("input", setRangeOutput);
els.pitch.addEventListener("input", setRangeOutput);

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
    elevenLabsVoiceId: els.elevenLabsVoiceId.value.trim()
  };

  await storageSet(payload);
  els.status.textContent = "Saved";
  setTimeout(() => {
    els.status.textContent = "";
  }, 1400);
});

init();
