# NViMi AI

NViMi AI is a browser-based NVIDIA chat app with a Kimi-style UI, live model loading, Free Endpoint handling, plugins, generated-file downloads, diagnostics, and iOS/PWA support.

Final release: `v3.2.0`

Live app: <https://wigglez-sudo.github.io/nvidia-ai-desktop/>
Worker URL: <https://nvidia-ai-proxy.lukewai.workers.dev>

## Final Release

- Final beta merge using the best fixes from the Kimi, DeepSeek/NVIDIA, and Qwen/NVIDIA test builds.
- iOS composer now wraps downward correctly for long prompts.
- Individual chat delete buttons now work as real touch targets on iPhone.
- The default personal name was removed from the UI. Users can choose their own display name in Settings.
- The chat engine, model loading, plugins, file handling, diagnostics, and generated-file downloads were kept intact.
- API keys stay out of source code and are stored only in the browser.

## What The App Does

### Chat

- Streams NVIDIA model replies live.
- Supports stop response, regenerate, copy, edit, and download.
- Keeps chat history in local browser storage.
- Lets users delete individual chats or clear all chats from Diagnostics.

### Models

- Pulls the live model list from the Worker.
- Keeps verified Free Endpoint tags as a local fallback.
- Supports favourites, recent models, search, and capability badges.
- Keeps working free models visible instead of replacing the model catalog with a static list.

### Files

- Accepts supported text, code, data, and image files.
- Keeps uploaded file content hidden from the visible chat where possible.
- Detects generated files from model responses.
- Lets users copy or download each file, or download all generated files as a ZIP.

### Plugins

- `Web Search` calls Brave/Tavily through the Worker and injects results into the prompt.
- `File Reader` includes attached file text, code, CSV, and Markdown content in the prompt.
- `Download Buttons` shows copy/download actions for generated code and files.
- `Prefer File Outputs` nudges models to return complete downloadable files.
- `Artifact Preview` opens generated HTML/CSS/JS bundles in the preview drawer.
- `Thinking Display` shows model activity and reasoning when available.
- `Long Context` sends more chat history when enabled.

## Full Release History

### v3.2.0 - Final beta merge

- Merged the safest beta fixes back into the main app.
- Fixed iOS long-prompt wrapping in the composer.
- Fixed individual chat delete buttons on touch devices.
- Replaced the default personal display name with a generic user profile.
- Bumped service-worker cache to `nvidia-ai-desktop-v3-2-0`.
- Regenerated the standalone HTML build from the final app files.

### v3.1.7 - iOS focus composer

- Mobile keyboard-open mode now follows focused composer state directly instead of relying on a large viewport-difference threshold.
- Kept the refined send-scroll behavior from the earlier patch line.
- Bumped the service-worker cache to `nvidia-ai-desktop-v3-1-7`.

### v3.1.6 - send scroll polish

- Improved send-time auto-scroll so the chat stays pinned more naturally.
- Tightened the composer experience on mobile browsers.
- Bumped the service-worker cache to `nvidia-ai-desktop-v3-1-6`.

### v3.1.5 - iOS fixed composer

- Stabilised the mobile composer so iOS would not leave a huge dead gap.
- Kept the chat box anchored in the visible viewport.
- Bumped the service-worker cache to `nvidia-ai-desktop-v3-1-5`.

### v3.1.4 - iOS direct-browser keyboard gap

- Fixed the top-cut-off and keyboard gap problem when the app is opened directly in iOS Safari.
- Preserved the existing chat and model flow.
- Bumped the service-worker cache to `nvidia-ai-desktop-v3-1-4`.

### v3.1.3 - Activity panel scroll and retry polish

- Kept the Activity panel open state stable during streaming.
- Improved retry visibility so diagnostics stay readable.
- Bumped the service-worker cache to `nvidia-ai-desktop-v3-1-3`.

### v3.1.2 - vision image attachments

- Added image attachment support for vision-capable models.
- Kept the file-upload flow working on iOS and desktop.
- Bumped the service-worker cache to `nvidia-ai-desktop-v3-1-2`.

### v3.1.1 - iOS keyboard viewport fix

- Kept the app height stable when the iOS keyboard opens.
- Removed the worst double-shrink behavior from the mobile viewport logic.
- Bumped the service-worker cache to `nvidia-ai-desktop-v3-1-1`.

### v3.1.0 - UI clarity and generated files

- Redesigned generated-file replies so file cards appear once, with copy/download actions and per-file collapsed source.
- Cleaned up the overall UI so the chat surface was easier to scan.
- Bumped the service-worker cache to `nvidia-ai-desktop-v3-1-0`.

### v3.0.9 - iOS upload, thinking state, and NViMi branding

- Rebranded the app to NViMi AI while keeping the NVIDIA/Kimi-style UI.
- Improved upload handling and thinking/activity presentation.
- Bumped the service-worker cache to `nvidia-ai-desktop-v3-0-9`.

### v3.0.8 - Artifact and model-picker polish

- Added the service-worker update banner.
- Improved artifact handling and the model picker layout.
- Bumped the service-worker cache to `nvidia-ai-desktop-v3-0-8`.

### v3.0.7 - Splash setup and force update

- Added a visible setup splash for first-run configuration.
- Added a force-update control for clearing stale cached builds.
- Bumped the service-worker cache to `nvidia-ai-desktop-v3-0-7`.

### v3.0.6 - Settings persistence on iOS

- Fixed settings persistence so API keys and proxy URLs survive refreshes on iPhone and desktop.
- Bumped the service-worker cache to `nvidia-ai-desktop-v3-0-6`.

### v3.0.5 - iOS safe-area toolbar fix

- Fixed the top toolbar and safe-area spacing on iOS.
- Bumped the service-worker cache to `nvidia-ai-desktop-v3-0-5`.

### v3.0.4 - Regenerate stop and Worker default

- Fixed regenerate so it uses the same stop flow as normal sends.
- Kept the Worker default path stable.
- Bumped the service-worker cache to `nvidia-ai-desktop-v3-0-4`.

### v3.0.3 - Stop response button

- Added a dedicated stop response control.
- Improved streamed reply control without breaking the main chat flow.

### v3.0.2 - generated-file download reliability

- Improved file download handling for generated code and app bundles.
- Added support for filename comments in generated output.

### v3.0.1 - chat and history cleanup

- Fixed the chat-history cleanup flow and the early UI clarity work that the later releases build on.

## Security Notes

- Do not hard-code NVIDIA API keys.
- Do not commit `.env` files or private Worker secrets.
- The browser frontend talks to NVIDIA through the Cloudflare Worker.
- The included Worker source is in `worker/index.js`.
- This `v3.2.0` release changes frontend files only. Cloudflare Worker redeploy is not required.

## Files

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

## Deploy

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

No Worker change is required for `v3.2.0`.

If you intentionally change `worker/index.js`, redeploy with:

```bash
cd C:\Users\lukew\OneDrive\Desktop\Nvidaapp\nvidia-ai-proxy\nvidia-ai-proxy
npx wrangler deploy
```

## Final Smoke Test

1. Open the app on iPhone Safari and desktop.
2. Go to Settings and confirm your API key and Worker URL are still saved.
3. Change the display name and confirm chat bubbles and sidebar update.
4. Tap `Refresh Models` and confirm live NVIDIA models load.
5. Type a long prompt on iOS and confirm the composer grows downward and wraps.
6. Create two chats, open the sidebar, delete one with the X button, and confirm it disappears.
7. Send a prompt to Kimi K2.6 or another known-working model.
8. Attach a supported file and confirm it appears as an attachment card.
9. Ask for a downloadable file and confirm Copy/Download/ZIP actions work.
10. Open Diagnostics and run Worker/model tests.

## Troubleshooting

- Old version still appears: Settings -> Diagnostics -> `Clear cache & reload latest`.
- Models do not load: check NVIDIA API key, Worker URL, and Worker availability.
- A model hangs: try another free endpoint. Some NVIDIA endpoints can be slow or temporarily unavailable.
- Image upload fails: use a vision-capable model and a supported image type (`png`, `jpg`, `jpeg`, `webp`, `gif`).
- Web Search fails: check Brave/Tavily key or Worker secret configuration.

Built by **Wigglez + Claude + ChatGPT Codex**
