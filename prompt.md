Build a Chrome extension called VoxClip that reads selected text aloud using AI voice.
Core features:

Detect text selection on any webpage
Show a small floating toolbar near the selection with a play button
Stop and pause controls while audio is playing
Right-click context menu option "Read with VoxClip" as an alternative trigger
Settings page to control voice, speed, and pitch
Default to browser's built-in voice with no setup required
Pluggable TTS provider architecture so OpenAI TTS and ElevenLabs can be enabled later by simply adding an API key in settings
Auto fallback to built-in voice if no API key is set
API keys saved securely in extension storage
Adding a new voice provider in the future should require minimal code changes to the core app

General expectations:

Clean minimal UI
No unnecessary browser permissions
Settings should persist between sessions
