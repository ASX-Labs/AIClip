<div align="center">

<img src="icons/icon128.png" alt="AIClip" width="80">

# AIClip

### AI Response Clipper Chrome Extension

**Clip and save AI chatbot responses with one click. Organize into notebooks, search, and export as JSON or Markdown.**

[![Chrome Web Store](https://img.shields.io/badge/Chrome%20Web%20Store-Available-black?style=for-the-badge&logo=googlechrome&logoColor=white)](https://chrome.google.com/webstore)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-black?style=for-the-badge&logo=googlechrome&logoColor=white)](https://developer.chrome.com/docs/extensions/mv3/)
[![License: MIT](https://img.shields.io/badge/License-MIT-black?style=for-the-badge)](LICENSE)
[![Version](https://img.shields.io/badge/Version-1.0.0-black?style=for-the-badge)](manifest.json)

</div>

---

## What It Does

You get great outputs from AI chatbots but they disappear into long conversation threads. AIClip fixes this:

- **Clip button** appears on every AI response — one click to save
- **Right-click any selected text** to clip it
- **Organize** clips into notebooks with tags
- **Search** your entire clip library instantly
- **Export** as JSON or Markdown

Works 100% locally with Chrome Sync for cross-device access.

---

## Features

- One-click Clip button on every AI response
- Right-click context menu to clip selected text
- Notebooks for organizing clips by topic
- Tags for fine-grained filtering
- Favorite clips for quick access
- Instant search by title, content, or tag
- Export as JSON (full backup) or Markdown (readable)
- Import clips from JSON
- In-page overlay with `Alt + C` keyboard shortcut
- Insert clipped text back into any AI input field
- Cross-device sync via Chrome storage
- 100% local — no external APIs or servers

---

## Project Structure

```
AIClip/
├── manifest.json                 # Manifest V3 config
├── background/
│   └── service_worker.js         # Context menu, storage, messaging
├── content/
│   └── clipper.js                # Clip buttons, overlay, AI platform injection
├── popup/
│   ├── popup.html
│   ├── popup.css
│   └── popup.js                  # Main popup UI
├── options/
│   ├── options.html
│   ├── options.css
│   └── options.js                # Settings page
├── styles/
│   └── clipper.css               # Clip button + overlay styles
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

---

## Installation

1. Clone this repo:
   ```bash
   git clone https://github.com/ASX-Labs/AIClip.git
   ```

2. Open `chrome://extensions`

3. Enable **Developer mode**

4. Click **Load unpacked** → select the `AIClip` folder

5. Visit any supported AI chatbot and start clipping

---

## How to Use

### Clip a Response
- **From AI chatbots:** Hover over any AI response → click the **Clip** button
- **From anywhere:** Select text → right-click → "Clip to AIClip"

### Browse Clips
- Click the extension icon to open the popup
- Press `Alt + C` on AI sites to open the overlay
- Search, filter by notebook, or view favorites only

### Organize
- Create notebooks in the Settings page
- Add tags when editing clips
- Mark clips as favorites for quick access

### Export
- **JSON** — full backup, re-importable into AIClip
- **Markdown** — readable format for notes or sharing

---

## Privacy

- All data stored in Chrome Sync Storage
- No external API calls
- No servers or accounts required
- No tracking or analytics

---

## License

MIT License — see [LICENSE](LICENSE) for details.

---

<div align="center">

Made by ASX Labs

**[Report a Bug](https://github.com/ASX-Labs/AIClip/issues) · [Request a Feature](https://github.com/ASX-Labs/AIClip/issues)**

</div>
