# VoxClip

VoxClip is a lightweight Chrome extension that reads selected text aloud.

It supports:

- Browser built-in speech voices (default)
- OpenAI text-to-speech (optional)
- ElevenLabs text-to-speech (optional)

## Install (Developer Mode)

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this project folder.

## How to Use

1. Highlight text on any webpage.
2. Click **Read aloud** from the floating toolbar.
3. Use **Pause**, **Resume**, and **Stop** as needed.

You can also right-click selected text and choose **Read with VoxClip**.

## Settings

Click the extension icon to open the popup settings.

All settings are saved automatically, including:

- Provider
- Voice/model
- Speed and pitch
- API keys for optional providers

## Local Validation

Run syntax and manifest checks:

```bash
node --check background.js
node --check contentScript.js
node --check settings.js
node -e "JSON.parse(require('fs').readFileSync('manifest.json','utf8')); console.log('manifest ok')"
git diff --check
```

## Privacy & Security Notes

- API keys are stored in `chrome.storage.local`.
- Built-in browser speech works without external APIs.
