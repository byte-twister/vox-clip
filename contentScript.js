(() => {
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

  const BUILTIN_MAX_CHUNK_LENGTH = 220;
  const API_MAX_CHUNK_LENGTH = 420;

  const state = {
    toolbar: null,
    playBtn: null,
    pauseBtn: null,
    stopBtn: null,
    statusText: null,
    visibleSelectionText: "",
    activeText: "",
    currentMode: "idle",
    utterance: null,
    audio: null,
    playbackSessionId: 0,
    playbackAbortController: null
  };

  function setReadAloudLabel(button) {
    button.innerHTML = "";
    const icon = document.createElement("span");
    icon.className = "voxclip-btn-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = "🔊";

    const label = document.createElement("span");
    label.textContent = "Read aloud";

    button.append(icon, label);
  }

  function setStatusText(message) {
    const value = (message || "").trim();
    state.statusText.textContent = value;
    state.statusText.hidden = !value;
  }

  function isContextInvalidated(error) {
    const message = String(error?.message || "");
    return message.includes("Extension context invalidated");
  }

  function getSettings() {
    return new Promise((resolve, reject) => {
      try {
        chrome.storage.local.get(DEFAULT_SETTINGS, (saved) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          resolve({ ...DEFAULT_SETTINGS, ...saved });
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  function getSelectedText() {
    return (window.getSelection()?.toString() || "").trim();
  }

  function getSelectionRect() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    if (!rect || (!rect.width && !rect.height)) return null;
    return rect;
  }

  function ensureToolbar() {
    if (state.toolbar) return;

    const toolbar = document.createElement("div");
    toolbar.className = "voxclip-toolbar";
    toolbar.setAttribute("role", "toolbar");
    toolbar.setAttribute("aria-label", "VoxClip controls");

    const playBtn = document.createElement("button");
    playBtn.type = "button";
    playBtn.className = "voxclip-btn";
    setReadAloudLabel(playBtn);

    const pauseBtn = document.createElement("button");
    pauseBtn.type = "button";
    pauseBtn.className = "voxclip-btn";
    pauseBtn.textContent = "Pause";
    pauseBtn.hidden = true;

    const stopBtn = document.createElement("button");
    stopBtn.type = "button";
    stopBtn.className = "voxclip-btn";
    stopBtn.textContent = "Stop";
    stopBtn.hidden = true;

    const status = document.createElement("span");
    status.className = "voxclip-status";
    status.hidden = true;

    toolbar.append(playBtn, pauseBtn, stopBtn, status);
    document.documentElement.appendChild(toolbar);

    playBtn.addEventListener("click", () => {
      const text = state.visibleSelectionText || state.activeText || getSelectedText();
      if (text) {
        playText(text);
      }
    });

    pauseBtn.addEventListener("click", () => {
      if (state.currentMode === "playing") {
        pausePlayback();
      } else if (state.currentMode === "paused") {
        resumePlayback();
      }
    });

    stopBtn.addEventListener("click", () => {
      stopPlayback();
      setIdleControls();
    });

    state.toolbar = toolbar;
    state.playBtn = playBtn;
    state.pauseBtn = pauseBtn;
    state.stopBtn = stopBtn;
    state.statusText = status;
  }

  function placeToolbarNearSelection() {
    ensureToolbar();
    const rect = getSelectionRect();
    if (!rect) return;

    const top = window.scrollY + rect.top - 44;
    const left = window.scrollX + rect.left + rect.width / 2;

    state.toolbar.style.top = `${Math.max(window.scrollY + 6, top)}px`;
    state.toolbar.style.left = `${Math.max(6, left)}px`;
    state.toolbar.style.transform = "translateX(-50%)";
    state.toolbar.dataset.visible = "true";
  }

  function hideToolbar() {
    if (!state.toolbar) return;
    state.toolbar.dataset.visible = "false";
  }

  function setIdleControls() {
    state.currentMode = "idle";
    state.playBtn.hidden = false;
    setReadAloudLabel(state.playBtn);
    state.pauseBtn.hidden = true;
    state.stopBtn.hidden = true;
    setStatusText("");
  }

  function setPlayingControls() {
    state.currentMode = "playing";
    state.playBtn.hidden = true;
    state.pauseBtn.hidden = false;
    state.stopBtn.hidden = false;
    state.pauseBtn.textContent = "Pause";
    setStatusText("Playing");
  }

  function setProcessingControls() {
    state.currentMode = "processing";
    state.playBtn.hidden = true;
    state.pauseBtn.hidden = true;
    state.stopBtn.hidden = false;
    setStatusText("Processing");
  }

  function setPausedControls() {
    state.currentMode = "paused";
    state.playBtn.hidden = true;
    state.pauseBtn.hidden = false;
    state.stopBtn.hidden = false;
    state.pauseBtn.textContent = "Resume";
    setStatusText("Paused");
  }

  function setErrorStatus(message) {
    setStatusText(message);
    setTimeout(() => {
      if (state.currentMode === "idle") {
        setStatusText("");
      }
    }, 2200);
  }

  function cancelSpeech() {
    if (state.utterance) {
      state.utterance.onend = null;
      state.utterance.onerror = null;
    }
    speechSynthesis.cancel();
    state.utterance = null;
  }

  function cancelAudio() {
    if (state.audio) {
      state.audio.pause();
      URL.revokeObjectURL(state.audio.src);
      state.audio.src = "";
      state.audio = null;
    }
  }

  function isAbortError(error) {
    const name = String(error?.name || "");
    const message = String(error?.message || "");
    return name === "AbortError" || message === "playback-cancelled";
  }

  function beginPlaybackSession() {
    if (state.playbackAbortController) {
      state.playbackAbortController.abort();
      state.playbackAbortController = null;
    }
    state.playbackSessionId += 1;
    return state.playbackSessionId;
  }

  function stopPlayback() {
    beginPlaybackSession();
    cancelSpeech();
    cancelAudio();
    state.activeText = "";
  }

  function getVoices() {
    return new Promise((resolve) => {
      let settled = false;
      let pollInterval = null;
      let timeoutId = null;

      const finish = (voices) => {
        if (settled) return;
        settled = true;
        speechSynthesis.removeEventListener("voiceschanged", onChange);
        clearInterval(pollInterval);
        clearTimeout(timeoutId);
        resolve(voices);
      };

      const onChange = () => {
        const voices = speechSynthesis.getVoices();
        if (voices.length) finish(voices);
      };

      const initial = speechSynthesis.getVoices();
      if (initial.length) {
        finish(initial);
        return;
      }

      speechSynthesis.addEventListener("voiceschanged", onChange);
      pollInterval = setInterval(() => {
        const voices = speechSynthesis.getVoices();
        if (voices.length) finish(voices);
      }, 120);

      timeoutId = setTimeout(() => {
        finish(speechSynthesis.getVoices());
      }, 2400);
    });
  }

  function splitNormalizedTextIntoChunks(normalized, maxLength) {
    if (!normalized) return [];
    if (normalized.length <= maxLength) return [normalized];

    const segments = normalized.match(/[^.!?]+[.!?]*\s*/g) || [normalized];
    const chunks = [];
    let current = "";

    segments.forEach((segment) => {
      const piece = segment.trim();
      if (!piece) return;

      if (!current) {
        if (piece.length <= maxLength) {
          current = piece;
        } else {
          const words = piece.split(" ");
          let hardChunk = "";
          words.forEach((word) => {
            const next = hardChunk ? `${hardChunk} ${word}` : word;
            if (next.length <= maxLength) {
              hardChunk = next;
            } else {
              if (hardChunk) chunks.push(hardChunk);
              hardChunk = word;
            }
          });
          if (hardChunk) chunks.push(hardChunk);
        }
        return;
      }

      const nextChunk = `${current} ${piece}`;
      if (nextChunk.length <= maxLength) {
        current = nextChunk;
      } else {
        chunks.push(current);
        current = piece;
      }
    });

    if (current) chunks.push(current);
    return chunks;
  }

  function splitTextIntoChunks(text, maxLength = BUILTIN_MAX_CHUNK_LENGTH, splitOnParagraphs = false) {
    const raw = (text || "").trim();
    if (!raw) return [];

    if (!splitOnParagraphs) {
      return splitNormalizedTextIntoChunks(raw.replace(/\s+/g, " "), maxLength);
    }

    const paragraphs = raw
      .split(/\n\s*\n+/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean);

    if (paragraphs.length <= 1) {
      return splitNormalizedTextIntoChunks(raw.replace(/\s+/g, " "), maxLength);
    }

    const chunks = [];
    paragraphs.forEach((paragraph) => {
      const paragraphChunks = splitNormalizedTextIntoChunks(paragraph.replace(/\s+/g, " "), maxLength);
      chunks.push(...paragraphChunks);
    });
    return chunks;
  }

  function pickFallbackVoice(voices) {
    if (!voices.length) return null;
    const language = (navigator.language || "").toLowerCase();
    return voices.find((voice) => (voice.lang || "").toLowerCase() === language)
      || voices.find((voice) => (voice.lang || "").toLowerCase().startsWith(language.split("-")[0]))
      || voices.find((voice) => voice.default)
      || voices.find((voice) => voice.localService)
      || voices[0];
  }

  function speakBuiltInChunk(text, settings, voice) {
    const utterance = new SpeechSynthesisUtterance(text);
    if (voice) utterance.voice = voice;
    utterance.rate = Number(settings.speed) || 1;
    utterance.pitch = Number(settings.pitch) || 1;
    state.utterance = utterance;

    return new Promise((resolve, reject) => {
      utterance.onend = () => {
        state.utterance = null;
        resolve();
      };
      utterance.onerror = (event) => {
        state.utterance = null;
        reject(new Error(event.error || "Speech synthesis failed"));
      };
      speechSynthesis.speak(utterance);
    });
  }

  async function speakBuiltInChunks(chunks, settings, voice) {
    for (const chunk of chunks) {
      await speakBuiltInChunk(chunk, settings, voice);
    }
  }

  async function speakBuiltIn(text, settings) {
    const voices = await getVoices();
    const selectedVoice = settings.builtinVoice
      ? voices.find((voice) => voice.name === settings.builtinVoice)
      : null;
    const fallbackVoice = pickFallbackVoice(voices);
    const chunks = splitTextIntoChunks(text);

    speechSynthesis.cancel();
    speechSynthesis.resume();

    try {
      await speakBuiltInChunks(chunks, settings, selectedVoice || fallbackVoice);
    } catch (error) {
      const message = String(error?.message || "");
      const shouldRetry = message === "synthesis-failed" || message.includes("interrupted") || message.includes("canceled");
      if (!shouldRetry || !fallbackVoice || (selectedVoice && selectedVoice.name === fallbackVoice.name)) {
        throw error;
      }

      speechSynthesis.cancel();
      await speakBuiltInChunks(chunks, settings, fallbackVoice);
    }
  }

  async function synthesizeOpenAI(text, settings, signal) {
    const response = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${settings.openaiApiKey}`
      },
      body: JSON.stringify({
        model: settings.openaiModel || "gpt-4o-mini-tts",
        voice: settings.openaiVoice || "alloy",
        input: text,
        speed: Number(settings.speed) || 1
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI TTS failed (${response.status})`);
    }

    return response.blob();
  }

  async function synthesizeElevenLabs(text, settings, signal) {
    const voiceId = settings.elevenLabsVoiceId?.trim();
    if (!voiceId) {
      throw new Error("Set ElevenLabs Voice ID in settings");
    }

    const modelId = settings.elevenLabsModelId?.trim() || "eleven_multilingual_v2";

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`, {
      method: "POST",
      signal,
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": settings.elevenLabsApiKey
      },
      body: JSON.stringify({
        text,
        model_id: modelId,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.0,
          use_speaker_boost: true
        }
      })
    });

    if (!response.ok) {
      throw new Error(`ElevenLabs TTS failed (${response.status})`);
    }

    return response.blob();
  }

  function hasProviderKey(provider, settings) {
    if (provider === "openai") return !!settings.openaiApiKey?.trim();
    if (provider === "elevenlabs") return !!settings.elevenLabsApiKey?.trim();
    return true;
  }

  function normalizePlaybackRate(value) {
    const numeric = Number(value) || 1;
    return Math.max(0.5, Math.min(2, numeric));
  }

  async function resolveProvider(settings) {
    const preferred = settings.provider || "builtin";
    if (!hasProviderKey(preferred, settings)) return "builtin";
    if (preferred === "openai" || preferred === "elevenlabs" || preferred === "builtin") return preferred;
    return "builtin";
  }

  async function playAudioBlob(blob, settings, signal) {
    cancelAudio();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    const playbackRate = normalizePlaybackRate(settings?.speed);
    audio.defaultPlaybackRate = playbackRate;
    audio.playbackRate = playbackRate;
    state.audio = audio;

    return new Promise((resolve, reject) => {
      if (signal?.aborted) {
        cancelAudio();
        reject(new DOMException("Playback cancelled", "AbortError"));
        return;
      }

      const handleAbort = () => {
        cancelAudio();
        reject(new DOMException("Playback cancelled", "AbortError"));
      };

      signal?.addEventListener("abort", handleAbort, { once: true });

      audio.onended = () => {
        signal?.removeEventListener("abort", handleAbort);
        cancelAudio();
        resolve();
      };
      audio.onerror = () => {
        signal?.removeEventListener("abort", handleAbort);
        cancelAudio();
        reject(new Error("Audio playback failed"));
      };
      audio.play().catch((err) => {
        signal?.removeEventListener("abort", handleAbort);
        cancelAudio();
        reject(err);
      });
    });
  }

  async function playElevenLabsChunked(text, settings, signal, sessionId) {
    const chunks = splitTextIntoChunks(text, API_MAX_CHUNK_LENGTH, true);
    if (!chunks.length) return;

    for (let index = 0; index < chunks.length; index += 1) {
      if (signal.aborted || sessionId !== state.playbackSessionId) {
        throw new Error("playback-cancelled");
      }

      setProcessingControls();
      const blob = await synthesizeElevenLabs(chunks[index], settings, signal);

      setPlayingControls();
      await playAudioBlob(blob, settings, signal);
    }
  }

  async function playText(text) {
    stopPlayback();
    state.activeText = text;
    setProcessingControls();
    let provider = "builtin";
    const sessionId = state.playbackSessionId;
    const playbackAbortController = new AbortController();
    state.playbackAbortController = playbackAbortController;

    try {
      const settings = await getSettings();
      provider = await resolveProvider(settings);
      if (sessionId !== state.playbackSessionId) return;

      if (provider === "builtin") {
        setPlayingControls();
        await speakBuiltIn(text, settings);
      } else if (provider === "openai") {
        const blob = await synthesizeOpenAI(text, settings, playbackAbortController.signal);
        setPlayingControls();
        await playAudioBlob(blob, settings, playbackAbortController.signal);
      } else if (provider === "elevenlabs") {
        await playElevenLabsChunked(text, settings, playbackAbortController.signal, sessionId);
      }

      if (sessionId === state.playbackSessionId) {
        setIdleControls();
      }
    } catch (error) {
      if (isAbortError(error) || sessionId !== state.playbackSessionId) {
        return;
      }

      stopPlayback();
      setIdleControls();
      if (isContextInvalidated(error)) {
        setErrorStatus("Extension reloaded. Refresh this page.");
        return;
      }
      const rawMessage = error?.message || "Playback failed";
      const builtInSpeechFailed = provider === "builtin" && rawMessage === "synthesis-failed";
      setErrorStatus(
        builtInSpeechFailed
          ? "Browser voice unavailable. In Brave, try --enable-speech-dispatcher or use Chrome."
          : rawMessage,
      );
    } finally {
      if (state.playbackAbortController === playbackAbortController) {
        state.playbackAbortController = null;
      }
    }
  }

  function pausePlayback() {
    if (state.audio) {
      if (!state.audio.paused) {
        state.audio.pause();
      }
      setPausedControls();
      return;
    }
    if (state.utterance) {
      speechSynthesis.pause();
      setPausedControls();
    }
  }

  function resumePlayback() {
    if (state.audio) {
      state.audio.play().then(() => setPlayingControls()).catch(() => setErrorStatus("Could not resume"));
      return;
    }

    if (state.utterance || speechSynthesis.paused) {
      speechSynthesis.resume();
      setPlayingControls();
    }
  }

  function updateSelectionToolbar() {
    const text = getSelectedText();
    if (!text) {
      state.visibleSelectionText = "";
      hideToolbar();
      return;
    }

    state.visibleSelectionText = text;
    placeToolbarNearSelection();
  }

  document.addEventListener("mouseup", () => {
    setTimeout(updateSelectionToolbar, 0);
  });

  document.addEventListener("keyup", (event) => {
    if (event.key === "Shift" || event.key.startsWith("Arrow") || event.key === "Control") {
      setTimeout(updateSelectionToolbar, 0);
    }
  });

  document.addEventListener("mousedown", (event) => {
    if (!state.toolbar) return;
    if (event.target instanceof Node && state.toolbar.contains(event.target)) return;
    if (!getSelectedText()) hideToolbar();
  });

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type !== "VOXCLIP_READ_TEXT") return;
    const text = (message.text || "").trim();
    if (!text) return;

    ensureToolbar();
    state.visibleSelectionText = text;
    state.toolbar.style.top = `${window.scrollY + 14}px`;
    state.toolbar.style.left = `${window.scrollX + 14}px`;
    state.toolbar.style.transform = "none";
    state.toolbar.dataset.visible = "true";

    playText(text);
  });

  ensureToolbar();
  setIdleControls();
})();
