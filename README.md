# NViMi AI 🚀

**NVIDIA + Kimi-style AI desktop for GitHub Pages, powered by a Cloudflare Worker proxy.**

NViMi AI is a browser-based chat app for NVIDIA Build/API models. It keeps the NVIDIA/Kimi-inspired dark interface, live model loading, Free Endpoint favourites, streaming replies, file handling, web-search plugins, generated-file downloads, diagnostics, and iOS/PWA support.

Current final release: **v3.2.0**

Live app: <https://wigglez-sudo.github.io/nvidia-ai-desktop/>

Worker URL: <https://nvidia-ai-proxy.lukewai.workers.dev>

---

## ✨ Final Release Highlights

- ✅ Final beta merge pass using the best fixes from the Kimi, DeepSeek/NVIDIA, and Qwen/NVIDIA test builds.
- 📱 iOS composer polish: long prompts wrap downward again instead of running horizontally.
- 🧹 Fixed individual chat delete buttons on iOS by giving the delete control a real touch target.
- 👤 Removed the hard-coded personal default name. New installs show **User**, and Settings lets each user choose their own display name.
- 🧠 Preserved the existing chat engine: streaming, stop response, regenerate, edit, reasoning/activity panel, diagnostics, and model-specific fallbacks.
- 📦 Preserved generated-file UX: artifact cards, copy/download buttons, multi-file ZIP download, and collapsible code previews.
- 🔎 Preserved plugin system: Web Search, File Reader, Download Buttons, Prefer File Outputs, Artifact Preview, Thinking Display, and Long Context.
- 🔐 Kept API keys out of source code. Keys are stored locally in the browser and sent through the Cloudflare Worker.

---

## 🧩 What The App Does

### Chat

- Streams NVIDIA model replies live.
- Supports stop response, regenerate, copy, edit, and download.
- Keeps chat history in local browser storage.
- Lets users delete individual chats or clear all chats from Diagnostics.

### Models

- Pulls the live model list from the Worker.
- Keeps verified Free Endpoint tags as a local fallback.
- Supports favourites, recent models, search, and model capability badges.
- Keeps working free models visible instead of replacing the model catalog with a static list.

### Files

- Accepts supported text/code/data files and supported image files.
- Keeps uploaded file content hidden from the visible chat where possible.
- Detects generated files from model responses.
- Lets users copy/download each file or download all generated files as a ZIP.

### Plugins

- **Web Search** calls Brave/Tavily through the Worker, then injects results into the model prompt.
- **File Reader** includes attached file text/code/CSV/Markdown content in the prompt.
- **Download Buttons** shows copy/download actions for generated code and files.
- **Prefer File Outputs** nudges models to return complete downloadable files.
- **Artifact Preview** opens generated HTML/CSS/JS bundles in the preview drawer.
- **Thinking Display** shows model activity/reasoning when available.
- **Long Context** sends more chat history when enabled.

---

## 🔐 Security Notes

- Do **not** hard-code NVIDIA API keys.
- Do **not** commit `.env` files or private Worker secrets.
- The browser frontend talks to NVIDIA through the Cloudflare Worker.
- The included Worker source is in `worker/index.js`.
- This v3.2.0 release changes frontend files only. **Cloudflare Worker redeploy is not required.**

---

## 📁 Files

```text
index.html
styles.css
app.js
sw.js
manifest.webmanifest
icon.svg
nvidia-ai-desktop-standalone.html
README.md
worker/index.js
```

---

## 🚀 Deploy

### GitHub Pages

Push these files to the GitHub Pages repository:

```bash
git add index.html styles.css app.js sw.js manifest.webmanifest icon.svg nvidia-ai-desktop-standalone.html README.md worker/index.js
git commit -m "Release v3.2.0 final build"
git push
```

Then open:

```text
https://wigglez-sudo.github.io/nvidia-ai-desktop/?v=3.2.0
```

### Cloudflare Worker

No Worker change is required for v3.2.0.

If you ever intentionally change `worker/index.js`, redeploy with:

```bash
cd C:\Users\lukew\OneDrive\Desktop\Nvidaapp\nvidia-ai-proxy\nvidia-ai-proxy
npx wrangler deploy
```

---

## 🧪 Final Smoke Test

After GitHub Pages finishes deploying:

1. Open the app on iPhone Safari and desktop.
2. Go to Settings and confirm your API key and Worker URL are still saved.
3. Change the display name and confirm chat bubbles/sidebar update.
4. Tap **Refresh Models** and confirm live NVIDIA models load.
5. Type a long prompt on iOS and confirm the composer grows downward and wraps.
6. Create two chats, open the sidebar, delete one with the X button, and confirm it disappears.
7. Send a prompt to Kimi K2.6 or another known-working model.
8. Attach a supported file and confirm it appears as an attachment card.
9. Ask for a downloadable file and confirm Copy/Download/ZIP actions work.
10. Open Diagnostics and run Worker/model tests.

---

## 🛠 Troubleshooting

- **Old version still appears:** Settings → Diagnostics → **Clear cache & reload latest**.
- **Models do not load:** Check NVIDIA API key, Worker URL, and Worker availability.
- **A model hangs:** Try another free endpoint. Some NVIDIA endpoints can be slow or temporarily unavailable.
- **Image upload fails:** Use a vision-capable model and a supported image type (`png`, `jpg`, `jpeg`, `webp`, `gif`).
- **Web Search fails:** Check Brave/Tavily key or Worker secret configuration.

---

## 📝 Release Notes

### v3.2.0 — Final beta merge

- Merged the safest beta fixes back into the main app.
- Fixed iOS long-prompt wrapping in the composer.
- Fixed individual chat delete buttons on touch devices.
- Replaced the default personal display name with a generic user profile.
- Bumped service-worker cache to `nvidia-ai-desktop-v3-2-0`.
- Regenerated the standalone HTML build from the final app files.

### Previous major milestones

- v3.1.x: iOS keyboard, direct-browser, activity panel, send-scroll, and vision upload patches.
- v3.0.x: stop response, regenerate, settings persistence, forced update, artifact downloads, model catalog, and NViMi rebrand.

---

Built by **Wigglez + Claude + ChatGPT Codex** 💚
