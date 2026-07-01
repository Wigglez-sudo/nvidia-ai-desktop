# NVIDIA AI Desktop — Model Picker Catalog Fix

This build fixes the model picker so it can show both:

1. **NVIDIA API models** from `GET /v1/models` — these are the models your API key can actually call.
2. **NVIDIA Build catalog models** from `https://build.nvidia.com/models` via the Cloudflare Worker route `GET /v1/build-models`.

The model picker now includes:

- **All** tab
- **Favorites** tab
- **Free Endpoint** tab
- **API Available** tab
- **Catalog** tab
- reasoning/coding/vision/image/speech/long/fast tabs

Free Endpoint badges are read from the NVIDIA Build catalog, because NVIDIA's `/v1/models` response may not include the public catalog tags.

## Important

This update requires BOTH:

- GitHub Pages frontend update
- Cloudflare Worker update

Without the Worker update, the app will still load API models, but it will not be able to enrich them with Build catalog / Free Endpoint metadata.

## GitHub upload

Replace these files in your GitHub repo root:

```text
index.html
styles.css
app.js
manifest.webmanifest
sw.js
icon.svg
README.md
cloudflare-worker.js
nvidia-ai-desktop-standalone.html
index.worker.js
```

Commit and wait for GitHub Pages to redeploy.

Open with a cache buster:

```text
https://wigglez-sudo.github.io/nvidia-ai-desktop/?v=modelcatalog1
```

Then press Ctrl+F5.

## Cloudflare Worker update

Replace:

```text
C:\Users\lukew\OneDrive\Desktop\Nvidaapp\nvidia-ai-proxy\nvidia-ai-proxy\src\index.js
```

with either:

```text
cloudflare-worker.js
```

or:

```text
index.worker.js
```

Then deploy:

```powershell
cd C:\Users\lukew\OneDrive\Desktop\Nvidaapp\nvidia-ai-proxy\nvidia-ai-proxy
npx wrangler deploy
```

After deploy, open your Worker root URL:

```text
https://nvidia-ai-proxy.lukewai.workers.dev
```

It should list:

```text
/v1/build-models
```

You can test the catalog route directly:

```text
https://nvidia-ai-proxy.lukewai.workers.dev/v1/build-models
```

It should return JSON with a `models` array and a `freeEndpointCount`.

## After updating

In the app:

1. Settings → make sure API Proxy URL is `https://nvidia-ai-proxy.lukewai.workers.dev`
2. Save Settings
3. Click Refresh Models
4. Open model picker
5. Check Free Endpoint tab

Some models may show **Catalog Only**. Those came from the Build catalog but were not matched to your `/v1/models` response. They are shown so you can see the full catalog, but if one fails in chat, NVIDIA may require a different endpoint or exact model ID.


## Free Endpoint verified fallback update

This build adds a verified Free Endpoint fallback list (76 slugs) so the model picker can show Free Endpoint badges even when NVIDIA's `/v1/models` response does not include the `Free Endpoint` flag.

After uploading:
1. Hard refresh with `?v=freeverified1`.
2. Open Settings and confirm your Worker URL is saved.
3. Click Refresh Models.
4. Open the model picker and use the Free Endpoint tab.

For the strongest catalogue metadata, also update the Cloudflare Worker using `index.worker.js` / `cloudflare-worker.js` from this package.
