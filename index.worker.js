// NVIDIA AI Desktop Cloudflare Worker Proxy
// Routes supported:
//   GET  /v1/models
//   POST /v1/chat/completions
//   POST /v1/web-search
//   GET  /v1/build-models
//
// Search providers:
//   Brave Search API (recommended): pass X-Search-Api-Key from the app or set BRAVE_SEARCH_API_KEY as a Worker secret.
//   Tavily: pass X-Search-Api-Key from the app or set TAVILY_API_KEY as a Worker secret.
//
// NVIDIA auth accepts either Authorization: Bearer nvapi-xxxx or X-Nvidia-Api-Key: nvapi-xxxx.

const NVIDIA_BASE = "https://integrate.api.nvidia.com";

// Verified Free Endpoint fallback slugs. Used because the public Build page/API can omit this flag in parsed metadata.
const VERIFIED_FREE_ENDPOINT_SLUGS = new Set([
  "minimax-m3",
  "diffusiongemma-26b-a4b-it",
  "nemotron-3-ultra-550b-a55b",
  "nemotron-3.5-content-safety",
  "cosmos3-nano",
  "cosmos3-nano-reasoner",
  "step-3.7-flash",
  "kimi-k2.6",
  "mistral-medium-3.5-128b",
  "nemotron-3-nano-omni-30b-a3b-reasoning",
  "deepseek-v4-flash",
  "deepseek-v4-pro",
  "glm-5.1",
  "nemotron-3-content-safety",
  "synthetic-video-detector",
  "active-speaker-detection",
  "ising-calibration-1-35b-a3b",
  "minimax-m2.7",
  "gemma-3-31b-it",
  "nemotron-voicechat",
  "qwen3.5-122b-a10b",
  "cosmos-transfer-2.5b",
  "step-3.5-flash",
  "nemotron-3-nano-30b-a3b",
  "mistral-small-4-1-9b-2509",
  "nemotron-3-super-128b-a12b",
  "qwen3.5-397b-a17b",
  "nemotron-content-safety-reasoning-9b",
  "nvidia-nemotron-translate-instruct-v1",
  "riva-translate-instruct-v1",
  "mistral-large-3.675b-instruct-2512",
  "gliner-v1",
  "mistral-14b-instruct-2512",
  "streamer",
  "nemotron-nano-12b-v2",
  "llama-3.1-nemotron-safety-guard-8b-v3",
  "qwen3-next-80b-a3b-thinking",
  "lightcone-preview-instruct",
  "mistral-nemotron-nano-9b-v2",
  "gpt-oss-20b",
  "gpt-oss-120b",
  "llama-3.1-nemotron-super-49b-v1.5",
  "sarvam-m",
  "llama-guard-4-12b",
  "gemma-3n-e4b-it",
  "gemma-3n-e2b-it",
  "cosmos-transfer1-7b",
  "background-noise-removal",
  "mistral-nemotron",
  "llama-3.1-nemotron-nano-vl-8b-v1",
  "magpie-tts-zero-shot",
  "llama-4-maverick-17b-128e-instruct",
  "llama-3.3-nemotron-super-49b-v1",
  "llama-3.1-nemotron-nano-8b-v1",
  "nv-embedcode-7b-v1",
  "phi-4-mini-instruct",
  "phi-4-multimodal-instruct",
  "whisper-large-v3",
  "gemma-7b",
  "llama-3.2-70b-instruct",
  "studio-voice",
  "llama-3.2-3b-instruct",
  "llama-3.2-11b-vision-instruct",
  "llama-3.2-90b-vision-instruct",
  "llama-3.2-1b-instruct",
  "dracarys-llama-3.1-70b-instruct",
  "nemotron-mini-4b-instruct",
  "gemma-2-9b-it",
  "llama-3.1-70b-instruct",
  "llama-3.1-8b-instruct",
  "nv-embed-v1",
  "bloom",
  "paligemma",
  "rerank-qa-mistral-4b",
  "seamlessm4t",
  "mistral-7b-instruct-v0.1"
]);
function normaliseSlug(value = "") { return String(value || "").toLowerCase().split("/").pop().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""); }
function isVerifiedFreeEndpointSlug(value = "") { return VERIFIED_FREE_ENDPOINT_SLUGS.has(normaliseSlug(value)); }


function corsHeaders(origin = "*") {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Nvidia-Api-Key, x-nvidia-api-key, X-Search-Provider, X-Search-Api-Key, x-search-provider, x-search-api-key, Accept",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function jsonResponse(data, status = 200, origin = "*") {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      ...corsHeaders(origin),
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function getBearerAuth(request, env) {
  const authorization = request.headers.get("Authorization");
  if (authorization && authorization.startsWith("Bearer ")) return authorization;

  const keyHeader = request.headers.get("X-Nvidia-Api-Key") || request.headers.get("x-nvidia-api-key");
  if (keyHeader) return `Bearer ${keyHeader.trim()}`;

  if (env && env.NVIDIA_API_KEY) return `Bearer ${String(env.NVIDIA_API_KEY).trim()}`;
  return null;
}

function cleanResult(item) {
  return {
    title: item.title || item.name || item.heading || "Untitled",
    url: item.url || item.link || item.href || "",
    snippet: item.description || item.snippet || item.content || item.body || "",
    source: item.profile?.name || item.source || item.displayed_url || "",
  };
}

async function braveSearch(query, count, safe, apiKey) {
  if (!apiKey) throw new Error("Missing Brave Search API key.");
  const url = new URL("https://api.search.brave.com/res/v1/web/search");
  url.searchParams.set("q", query);
  url.searchParams.set("count", String(Math.max(1, Math.min(10, count || 6))));
  url.searchParams.set("safe", safe || "moderate");
  url.searchParams.set("text_decorations", "false");
  url.searchParams.set("extra_snippets", "true");

  const res = await fetch(url.toString(), {
    headers: {
      "Accept": "application/json",
      "X-Subscription-Token": apiKey,
    },
  });
  if (!res.ok) throw new Error(`Brave Search HTTP ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const web = data.web?.results || [];
  const news = data.news?.results || [];
  return [...web, ...news].map(cleanResult).filter(r => r.url);
}

async function tavilySearch(query, count, apiKey) {
  if (!apiKey) throw new Error("Missing Tavily API key.");
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      query,
      max_results: Math.max(1, Math.min(10, count || 6)),
      search_depth: "basic",
      include_answer: false,
      include_raw_content: false,
    }),
  });
  if (!res.ok) throw new Error(`Tavily HTTP ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return (data.results || []).map(cleanResult).filter(r => r.url);
}


const BUILD_MODELS_URL = "https://build.nvidia.com/models";

function decodeHtmlEntities(value = "") {
  return String(value)
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function textFromHtml(fragment = "") {
  return decodeHtmlEntities(String(fragment)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, "\n"))
    .split(/\n+/)
    .map(line => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

function publisherPrefix(publisher = "") {
  const key = String(publisher || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const map = {
    "nvidia": "nvidia",
    "moonshotai": "moonshotai",
    "moonshot ai": "moonshotai",
    "deepseek ai": "deepseek-ai",
    "deepseek": "deepseek-ai",
    "z ai": "z-ai",
    "zai": "z-ai",
    "minimaxai": "minimaxai",
    "minimax ai": "minimaxai",
    "mistral ai": "mistralai",
    "mistral": "mistralai",
    "google": "google",
    "qwen": "qwen",
    "meta": "meta",
    "stepfun ai": "stepfun-ai",
    "stepfun-ai": "stepfun-ai",
    "stepfun": "stepfun-ai",
    "resemble ai": "resemble-ai",
    "black forest labs": "black-forest-labs",
    "black-forest-labs": "black-forest-labs",
    "ibm": "ibm",
    "cohere": "cohere",
    "snowflake": "snowflake",
    "databricks": "databricks",
    "01 ai": "01-ai"
  };
  return map[key] || key.replace(/\s+/g, "-") || "catalog";
}

function findPublisher(text = "") {
  const publishers = [
    "Black-forest-labs", "Black Forest Labs", "DeepSeek AI", "Mistral AI", "Moonshotai", "Moonshot AI",
    "Minimaxai", "MiniMax AI", "Resemble.AI", "Stepfun-ai", "Stepfun AI", "NVIDIA", "Google", "Qwen", "Meta", "Z.ai", "IBM", "Cohere", "Snowflake", "Databricks", "01-ai", "01 AI"
  ];
  let found = "";
  let best = -1;
  const lower = text.toLowerCase();
  for (const pub of publishers) {
    const idx = lower.lastIndexOf(pub.toLowerCase());
    if (idx > best) { best = idx; found = pub; }
  }
  return found;
}

function isProbablyDescription(line = "") {
  const value = String(line).trim();
  if (value.length < 25) return false;
  if (/^(items per page|filters|sort by|most recent|of \d+ pages|reset apply)$/i.test(value)) return false;
  if (/^\d+(k|m)?$/i.test(value) || /^\d+[dwmy]$/i.test(value) || /^\+\d+$/.test(value)) return false;
  return true;
}

function inferUseCaseCaps(text = "") {
  const t = String(text || "").toLowerCase();
  const caps = ["catalog", "live"];
  if (/free endpoint/.test(t)) caps.push("free_endpoint", "free");
  if (/downloadable/.test(t)) caps.push("downloadable");
  if (/partner endpoint/.test(t)) caps.push("paid");
  if (/reason|thinking|agentic|agent|planning|tool/.test(t)) caps.push("reasoning");
  if (/code|coding|software|program/.test(t)) caps.push("coding");
  if (/rag|retrieval|rerank|embedding|embed|search/.test(t)) caps.push("research");
  if (/vision|visual|vlm|multimodal|image-to-text|video|ocr|document|table extraction/.test(t)) caps.push("vision");
  if (/image generation|text-to-image|diffusion|flux|sdxl|image editing|qwen-image/.test(t)) caps.push("image");
  if (/speech|audio|voice|tts|asr|automatic speech recognition|translation/.test(t)) caps.push("speech");
  if (/1m|million|128k|200k|256k|long context|context/.test(t)) caps.push("long");
  if (/flash|fast|nano|mini|small|klein|\b[1-9]b\b|\b1b\b/.test(t)) caps.push("fast");
  return [...new Set(caps)];
}

function parseBuildModelsHtml(html = "", page = 1) {
  const models = [];
  const anchorRe = /<a\b[^>]*href=["']\/models\/([^"'?#/]+)[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = anchorRe.exec(html))) {
    const slug = decodeURIComponent(match[1] || "").trim();
    const name = textFromHtml(match[2] || "").replace(/\n+/g, " ").trim();
    if (!slug || !name || name.length > 120) continue;
    if (/^(models|skills|blueprints|docs|explore)$/i.test(slug)) continue;

    const beforeHtml = html.slice(Math.max(0, match.index - 1800), match.index);
    const afterHtml = html.slice(match.index + match[0].length, match.index + match[0].length + 1600);
    const before = textFromHtml(beforeHtml);
    const afterLines = textFromHtml(afterHtml).split("\n").map(x => x.trim()).filter(Boolean);
    const statusWindow = before.split("\n").slice(-12).join(" ");
    const publisher = findPublisher(before) || "";
    const description = afterLines.find(isProbablyDescription) || "";
    const capabilityText = [name, slug, publisher, description, statusWindow, afterLines.slice(0, 10).join(" ")].join(" ");
    const verifiedFreeEndpoint = isVerifiedFreeEndpointSlug(slug) || isVerifiedFreeEndpointSlug(name);
    const prefix = publisherPrefix(publisher);
    const modelId = prefix && prefix !== "catalog" ? `${prefix}/${slug}` : slug;
    const caps = inferUseCaseCaps(capabilityText);
    if (verifiedFreeEndpoint) { caps.push("free_endpoint", "free"); }

    models.push({
      id: modelId,
      modelId,
      slug,
      catalogSlug: slug,
      name,
      title: name,
      publisher,
      description,
      freeEndpoint: verifiedFreeEndpoint || /free endpoint/i.test(statusWindow),
      downloadable: /downloadable/i.test(statusWindow),
      partnerEndpoint: /partner endpoint/i.test(statusWindow),
      capabilities: [...new Set(caps)],
      source: "catalog",
      catalogOnly: true,
      page,
      url: `${BUILD_MODELS_URL}/${slug}`
    });
  }
  return models;
}

async function handleBuildModels(request, origin) {
  if (request.method !== "GET") return jsonResponse({ ok: false, error: "Use GET for /v1/build-models" }, 405, origin);
  const all = [];
  const errors = [];
  for (let page = 1; page <= 6; page++) {
    const url = page === 1 ? BUILD_MODELS_URL : `${BUILD_MODELS_URL}?page=${page}`;
    try {
      const res = await fetch(url, { headers: { "Accept": "text/html", "User-Agent": "Mozilla/5.0 NVIDIA-AI-Desktop-Model-Catalog" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      all.push(...parseBuildModelsHtml(html, page));
    } catch (err) {
      errors.push({ page, message: err && err.message ? err.message : String(err) });
    }
  }
  const bySlug = new Map();
  for (const model of all) {
    if (!bySlug.has(model.slug)) bySlug.set(model.slug, model);
    else {
      const existing = bySlug.get(model.slug);
      existing.capabilities = [...new Set([...(existing.capabilities || []), ...(model.capabilities || [])])];
      existing.freeEndpoint = existing.freeEndpoint || model.freeEndpoint;
      existing.downloadable = existing.downloadable || model.downloadable;
      existing.partnerEndpoint = existing.partnerEndpoint || model.partnerEndpoint;
    }
  }
  const models = [...bySlug.values()].sort((a, b) => a.name.localeCompare(b.name));
  return jsonResponse({
    ok: true,
    source: BUILD_MODELS_URL,
    total: models.length,
    freeEndpointCount: models.filter(m => m.freeEndpoint || (m.capabilities || []).includes("free_endpoint")).length,
    models,
    errors
  }, 200, origin);
}

async function handleWebSearch(request, env, origin) {
  if (request.method !== "POST") return jsonResponse({ ok: false, error: "Use POST for /v1/web-search" }, 405, origin);
  let body = {};
  try { body = await request.json(); } catch (_) {}
  const query = String(body.query || "").trim();
  if (!query) return jsonResponse({ ok: false, error: "Missing search query." }, 400, origin);

  const provider = String(body.provider || request.headers.get("X-Search-Provider") || "brave").toLowerCase();
  const count = Number(body.count || 6);
  const safe = body.safe || "moderate";
  const headerKey = request.headers.get("X-Search-Api-Key") || request.headers.get("x-search-api-key") || "";

  try {
    let results = [];
    if (provider === "tavily") {
      results = await tavilySearch(query, count, headerKey || env.TAVILY_API_KEY);
    } else {
      results = await braveSearch(query, count, safe, headerKey || env.BRAVE_SEARCH_API_KEY);
    }
    return jsonResponse({ ok: true, provider: provider === "tavily" ? "tavily" : "brave", query, results: results.slice(0, Math.max(1, Math.min(10, count || 6))) }, 200, origin);
  } catch (err) {
    return jsonResponse({ ok: false, error: "Web search failed", message: err && err.message ? err.message : String(err) }, 502, origin);
  }
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "*";
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (url.pathname === "/" || url.pathname === "") {
      return jsonResponse({
        ok: true,
        name: "NVIDIA AI Desktop proxy",
        routes: ["/v1/models", "/v1/chat/completions", "/v1/web-search", "/v1/build-models"],
        search: "Brave Search API recommended; Tavily also supported.",
      }, 200, origin);
    }

    if (url.pathname === "/v1/web-search") return handleWebSearch(request, env, origin);

    if (url.pathname === "/v1/build-models") return handleBuildModels(request, origin);

    const allowedPaths = ["/v1/models", "/v1/chat/completions"];
    if (!allowedPaths.includes(url.pathname)) {
      return jsonResponse({ ok: false, error: "Route not allowed", path: url.pathname, allowed: [...allowedPaths, "/v1/web-search", "/v1/build-models"] }, 404, origin);
    }

    const auth = getBearerAuth(request, env);
    if (!auth) {
      return jsonResponse({ ok: false, error: "Missing API key. Send Authorization: Bearer nvapi-xxxx or X-Nvidia-Api-Key: nvapi-xxxx." }, 401, origin);
    }

    const targetUrl = NVIDIA_BASE + url.pathname + url.search;
    const headers = new Headers();
    headers.set("Authorization", auth);
    headers.set("Accept", request.headers.get("Accept") || "application/json");
    if (request.method !== "GET" && request.method !== "HEAD") {
      headers.set("Content-Type", request.headers.get("Content-Type") || "application/json");
    }

    try {
      const upstream = await fetch(targetUrl, {
        method: request.method,
        headers,
        body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
      });

      const responseHeaders = new Headers(upstream.headers);
      for (const [key, value] of Object.entries(corsHeaders(origin))) responseHeaders.set(key, value);
      responseHeaders.delete("content-encoding");
      responseHeaders.delete("content-security-policy");

      return new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers: responseHeaders });
    } catch (err) {
      return jsonResponse({ ok: false, error: "Proxy fetch failed", message: err && err.message ? err.message : String(err) }, 502, origin);
    }
  },
};
