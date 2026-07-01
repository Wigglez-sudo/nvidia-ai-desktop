/* NVIDIA AI Desktop - GitHub Pages / Cloudflare Worker build */
const APP_VERSION = '3.0.1';
const BUILD_ID = '2025-06-consolidated';
const NVIDIA_DIRECT_BASE = 'https://integrate.api.nvidia.com/v1';
const SETTINGS_KEY = 'nvidia_ai_desktop_settings_v8_plugins';
const MODEL_CACHE_KEY = 'nvidia_ai_desktop_live_models_v8_plugins';
const FAV_KEY = 'nvidia_ai_desktop_favourites_v8_plugins';
const CHATS_KEY = 'nvidia_ai_desktop_chats_v8_plugins';
const CURRENT_CHAT_KEY = 'nvidia_ai_desktop_current_chat_v8_plugins';

// Older key versions we migrate settings/chats/favourites forward from, so a
// version bump never silently wipes a returning user's data.
const LEGACY_KEY_SUFFIXES = ['_v7_plugins', '_v6_plugins', '_v5', '_v4', '_v3', '_v2', '_v1', ''];
function listLegacyKeys() {
  const bases = ['nvidia_ai_desktop_settings', 'nvidia_ai_desktop_live_models', 'nvidia_ai_desktop_favourites', 'nvidia_ai_desktop_chats', 'nvidia_ai_desktop_current_chat'];
  const keys = [];
  for (const base of bases) for (const suf of LEGACY_KEY_SUFFIXES) { const k = base + suf; if (k !== base + '_v8_plugins') keys.push(k); }
  return keys;
}


// Verified Free Endpoint fallback list.
// NVIDIA's /v1/models endpoint does not always include the Free Endpoint flag.
// This list is used as a local fallback based on NVIDIA Build Free Endpoint screenshots/catalog.
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

function isVerifiedFreeEndpoint(value, raw = {}) {
  const values = [value, raw.id, raw.modelId, raw.model, raw.slug, raw.catalogSlug, raw.name, raw.title, raw.display_name, raw.displayName];
  for (const v of values) {
    if (!v) continue;
    for (const key of modelMatchKeys(v)) {
      if (VERIFIED_FREE_ENDPOINT_SLUGS.has(key)) return true;
    }
  }
  return false;
}

const MODES = [
  { key: 'chat', icon: '💬', label: 'Chat', short: 'General assistant for normal questions and tasks.', prompt: 'You are a helpful NVIDIA AI desktop assistant. Be clear, practical and honest. When code or files are useful, use fenced code blocks with a filename line such as filename: app.js.' },
  { key: 'coding', icon: '💻', label: 'Coding', short: 'Programming, debugging, Docker, Git, APIs and file generation.', prompt: 'You are an expert software engineer. Prioritise working code, exact commands, debugging steps, and downloadable file blocks. Ask only when required. When generating files, use fenced code blocks and put filename: path/to/file.ext as the first line.' },
  { key: 'research', icon: '📚', label: 'Research', short: 'Deeper structured analysis and comparisons.', prompt: 'You are a careful research assistant. Give structured, evidence-aware analysis. Separate facts from assumptions. Say when live web access or a source is needed. Avoid pretending to have citations unless provided.' },
  { key: 'writing', icon: '📝', label: 'Writing', short: 'Emails, docs, rewriting, summaries and tone changes.', prompt: 'You are a writing assistant. Improve clarity, tone, grammar and structure. Preserve the user’s intent and avoid adding unsupported claims.' },
  { key: 'creative', icon: '🎨', label: 'Creative', short: 'Stories, ideas, roleplay, branding and brainstorming.', prompt: 'You are a creative assistant. Be imaginative, vivid and useful. Offer original ideas while staying aligned with the user’s request.' },
  { key: 'data', icon: '📊', label: 'Data', short: 'CSV, SQL, spreadsheets, analysis and datasets.', prompt: 'You are a data analyst. Prefer clear tables, CSV/JSON when requested, formulas, assumptions, and reproducible steps. Use downloadable file blocks where useful.' },
  { key: 'web', icon: '🌐', label: 'Web', short: 'HTML, CSS, JavaScript, websites and UI.', prompt: 'You are a web developer. Produce clean, responsive HTML/CSS/JS. Use accessible UI patterns. Put each generated file in a fenced code block with filename: as the first line.' },
  { key: 'images', icon: '🖼️', label: 'Images', short: 'Image prompts and image-capable model guidance.', prompt: 'You help with image generation prompts and image workflows. If the selected model is not image-capable, explain that a vision/image model may be needed.' },
  { key: 'voice', icon: '🎤', label: 'Voice', short: 'Dictation-friendly, concise speech-style responses.', prompt: 'You are a voice-friendly assistant. Keep responses conversational and easy to read aloud unless the user asks for detail.' },
  { key: 'custom', icon: '⚙️', label: 'Custom', short: 'Uses your custom system prompt from Settings.', prompt: '' }
];

const AGENTS = [
  { key: 'general', name: 'General', role: 'Balanced helper', emoji: '🟢', prompt: '' },
  { key: 'engineer', name: 'Senior Engineer', role: 'Strict coding reviewer', emoji: '💻', prompt: 'Act as a senior engineer. Check edge cases, give practical implementation details, and point out likely breakages.' },
  { key: 'researcher', name: 'Researcher', role: 'Careful analyst', emoji: '📚', prompt: 'Act as a cautious researcher. Avoid overclaiming, state uncertainty, and organise findings clearly.' },
  { key: 'data', name: 'Data Analyst', role: 'Tables and analysis', emoji: '📊', prompt: 'Act as a data analyst. Prefer structured outputs, tables, calculations, and repeatable analysis.' },
  { key: 'creative', name: 'Creative', role: 'Ideas and writing', emoji: '🎨', prompt: 'Act as a creative director. Offer bold options, names, concepts, and polished wording.' },
  { key: 'teacher', name: 'Teacher', role: 'Explains step by step', emoji: '👨‍🏫', prompt: 'Act as a patient teacher. Explain in plain English and build up step by step.' },
  { key: 'security', name: 'Security Reviewer', role: 'Safety and hardening', emoji: '🛡️', prompt: 'Act as a security reviewer. Highlight secrets, unsafe defaults, injection risks, and safer alternatives.' }
];


const DEFAULT_PLUGINS = {
  webSearch: false,
  webSearchProvider: 'brave',
  webSearchApiKey: '',
  webSearchResults: 6,
  webSearchMode: 'auto',
  webSearchSafe: 'moderate',
  fileReader: true,
  downloadButtons: true,
  thinkingDisplay: true,
  longContext: false,
  codeInterpreter: false
};

const state = {
  settings: {
    apiKey: '',
    proxyUrl: '',
    userName: 'Luke',
    temperature: 0.7,
    maxTokens: 2048,
    stream: true,
    showThinking: true,
    streamDiagnostics: true,
    forceReasoning: true,
    theme: 'dark',
    customPrompt: '',
    plugins: { ...DEFAULT_PLUGINS },
    currentMode: 'chat',
    currentAgent: 'general',
    currentModelId: ''
  },
  liveModels: [],
  favourites: new Set(),
  currentChat: null,
  chats: [],
  modelTab: 'all',
  isBusy: false,
  editingMessageId: null,
  lastConnection: null,
  voiceRecognition: null,
  pendingAttachments: [],
  chatSearch: '',
  loadedAt: '',
  diag: { swStatus: 'unknown', workerRoutes: [], workerVersion: '', lastStatus: '', lastContentType: '', lastEvents: null, lastError: '' }
};

function uid(prefix = 'id') { return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`; }
function nowTime() { return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
function escapeHtml(text) { return String(text ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c])); }
function escapeAttr(text) { return escapeHtml(text).replace(/`/g, '&#96;'); }
function escapeJsString(text) { return String(text ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, ''); }

function stripVisibleAttachmentBlocks(text) {
  let value = String(text || '');
  // Older builds pasted uploads visibly as [Attached: file] followed by the full file/code.
  // Hide that old pasted block from chat display and editing, while real attachments are
  // still sent privately through attachmentPromptText().
  value = value.replace(/\n?\s*\[Attached(?: file)?:[\s\S]*$/i, '').trim();
  return value;
}
function stripSlash(url) { return String(url || '').trim().replace(/\/+$/, ''); }

function shortText(value, max = 1200) {
  const text = String(value ?? '');
  return text.length > max ? text.slice(0, max) + `… [truncated ${text.length - max} chars]` : text;
}

function modelSupportsReasoning(model) {
  if (!model) return false;
  const id = `${model.id || ''} ${model.name || ''}`.toLowerCase();
  const caps = model.capabilities || [];
  return caps.includes('reasoning') || /reason|thinking|deepseek|qwen|qwq|glm|nemotron|kimi|gemma-3|gpt-oss/.test(id);
}

function reasoningExtrasForModel(model) {
  if (!state.settings.forceReasoning || !state.settings.showThinking || !modelSupportsReasoning(model)) return {};
  const id = `${model.id || ''} ${model.name || ''}`.toLowerCase();
  const kwargs = { enable_thinking: true };
  // Some NVIDIA-hosted reasoning models expose extra template flags. Unknown flags can fail on some models,
  // so requestAssistantResponse retries once without these extras if NVIDIA rejects the request.
  if (/glm/.test(id)) kwargs.clear_thinking = false;
  if (/deepseek/.test(id) || /kimi/.test(id)) kwargs.thinking = true;
  const extras = {
    include_reasoning: true,
    chat_template_kwargs: kwargs
  };
  if (/nemotron-3|nemotron/.test(id)) extras.thinking_token_budget = Math.min(4096, Math.max(512, Math.floor(Number(state.settings.maxTokens || 4096) / 2)));
  return extras;
}

function ensureStreamDebug(msg, payload = null) {
  if (!msg || !state.settings.streamDiagnostics) return null;
  if (!msg.debug) {
    msg.debug = {
      startedAt: Date.now(),
      request: payload ? { model: payload.model, stream: payload.stream, max_tokens: payload.max_tokens, has_reasoning_params: !!payload.chat_template_kwargs || !!payload.include_reasoning, chat_template_kwargs: payload.chat_template_kwargs || null, include_reasoning: payload.include_reasoning || false } : {},
      http: {},
      counters: { chunks: 0, sseEvents: 0, jsonEvents: 0, contentDeltas: 0, reasoningDeltas: 0, emptyDeltas: 0 },
      events: [],
      rawSamples: []
    };
  }
  return msg.debug;
}

function recordStreamEvent(msg, label, details = '') {
  const debug = ensureStreamDebug(msg);
  if (!debug) return;
  const elapsed = ((Date.now() - debug.startedAt) / 1000).toFixed(1) + 's';
  debug.events.push({ t: elapsed, label, details: shortText(details, 700) });
  if (debug.events.length > 40) debug.events.shift();
}

function recordRawStreamSample(msg, sample) {
  const debug = ensureStreamDebug(msg);
  if (!debug) return;
  // Keep a tiny sample buffer for optional exported diagnostics, but do not render
  // raw payloads in chat. Luke only wants the readable event timeline in the UI.
  const text = shortText(sample, 400);
  if (text.trim() && debug.rawSamples.length < 3) debug.rawSamples.push(text);
}

function streamDebugSummary(msg) {
  if (!msg?.debug) return '';
  const d = msg.debug;
  const c = d.counters || {};
  const http = d.http || {};
  const elapsed = ((Date.now() - (d.startedAt || Date.now())) / 1000).toFixed(1) + 's';
  return [
    elapsed,
    http.status ? `HTTP ${http.status}` : 'waiting',
    `${c.chunks || 0} chunks`,
    `${c.sseEvents || 0} SSE`,
    `${c.jsonEvents || 0} JSON`,
    `${c.contentDeltas || 0} text`,
    `${c.reasoningDeltas || 0} thinking`
  ].filter(Boolean).join(' • ');
}

function streamEventsListHtml(msg) {
  if (!state.settings.streamDiagnostics || !msg?.debug) return '';
  const events = msg.debug.events || [];
  if (!events.length) return `<div class="stream-events-empty">No stream events yet.</div>`;
  return `<div class="stream-events-list">${events.map(e => `<div class="stream-event"><strong>${escapeHtml(e.t)}</strong><span>${escapeHtml(e.label)}${e.details ? ` — ${escapeHtml(e.details)}` : ''}</span></div>`).join('')}</div>`;
}

function thinkingDetailsHtml(msg) {
  if (!msg || msg.role === 'user') return '';
  const hasThinking = state.settings.showThinking && !!msg.thinking;
  const hasEvents = state.settings.streamDiagnostics && !!msg.debug;
  if (!hasThinking && !hasEvents) return '';
  const summary = streamDebugSummary(msg) || (msg.loading ? 'working' : 'complete');
  const thinkingText = hasThinking ? `<div class="thinking-section-title">Public reasoning / plugin notes</div><div class="thinking-public-text">${escapeHtml(msg.thinking)}</div>` : '';
  const eventText = hasEvents ? `<div class="thinking-section-title">Event timeline</div>${streamEventsListHtml(msg)}` : '';
  return `<details class="thinking-block thinking-details"><summary class="thinking-header"><span>🧠</span><div class="thinking-title">Thinking</div><span class="thinking-toggle">${escapeHtml(summary)}</span></summary><div class="thinking-body">${thinkingText}${eventText}</div></details>`;
}

function streamDebugHtml(msg) {
  // Kept as a compatibility alias for older call sites. The UI now shows only
  // the readable event timeline inside the collapsed Thinking block, not raw
  // request JSON or raw SSE payloads.
  return thinkingDetailsHtml(msg);
}

function appendPublicReasoning(msg, text) {
  const value = contentToString(text);
  if (!value) return false;
  msg.thinking = (msg.thinking || '') + value;
  return true;
}

function appendAssistantVisibleOrReasoning(msg, text) {
  let chunk = contentToString(text);
  if (!chunk) return false;

  // Some reasoning models expose public reasoning inside <think>...</think>,
  // <thinking>...</thinking>, or <reasoning>...</reasoning> tags instead of a
  // separate reasoning_content field. Capture those into the Thinking panel.
  let changed = false;
  while (chunk) {
    if (msg._reasoningTag) {
      const closeRe = new RegExp(`</${msg._reasoningTag}>`, 'i');
      const close = chunk.search(closeRe);
      if (close === -1) {
        msg.thinking = (msg.thinking || '') + chunk;
        changed = true;
        return changed;
      }
      msg.thinking = (msg.thinking || '') + chunk.slice(0, close);
      const closeMatch = chunk.slice(close).match(closeRe);
      chunk = chunk.slice(close + (closeMatch ? closeMatch[0].length : 0));
      msg._reasoningTag = '';
      changed = true;
      continue;
    }

    const openMatch = chunk.match(/<(think|thinking|reasoning)>/i);
    if (!openMatch) {
      msg.content = (msg.content || '') + chunk;
      changed = true;
      return changed;
    }

    const before = chunk.slice(0, openMatch.index);
    if (before) {
      msg.content = (msg.content || '') + before;
      changed = true;
    }
    msg._reasoningTag = openMatch[1].toLowerCase();
    chunk = chunk.slice(openMatch.index + openMatch[0].length);
  }
  return changed;
}


function loadJson(key, fallback) {
  try { const value = JSON.parse(localStorage.getItem(key) || 'null'); return value ?? fallback; } catch { return fallback; }
}
function saveJson(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {} }

function migrateLegacyStorage() {
  // If current keys are empty but an older build's keys exist, carry them forward once.
  const pairs = [
    [SETTINGS_KEY, 'nvidia_ai_desktop_settings'],
    [MODEL_CACHE_KEY, 'nvidia_ai_desktop_live_models'],
    [FAV_KEY, 'nvidia_ai_desktop_favourites'],
    [CHATS_KEY, 'nvidia_ai_desktop_chats'],
    [CURRENT_CHAT_KEY, 'nvidia_ai_desktop_current_chat']
  ];
  for (const [currentKey, base] of pairs) {
    try {
      if (localStorage.getItem(currentKey) != null) continue; // already have current data
      for (const suf of LEGACY_KEY_SUFFIXES) {
        const legacyKey = base + suf;
        if (legacyKey === currentKey) continue;
        const val = localStorage.getItem(legacyKey);
        if (val != null) { localStorage.setItem(currentKey, val); break; }
      }
    } catch (_) {}
  }
}

function loadState() {
  migrateLegacyStorage();
  state.settings = { ...state.settings, ...loadJson(SETTINGS_KEY, {}) };
  state.settings.plugins = { ...DEFAULT_PLUGINS, ...(state.settings.plugins || {}) };
  state.settings.showThinking = !!state.settings.plugins.thinkingDisplay;
  const cache = loadJson(MODEL_CACHE_KEY, { models: [], updatedAt: 0 });
  state.liveModels = Array.isArray(cache.models) ? cache.models.map(normalizeModel).filter(Boolean) : [];
  state.favourites = new Set(loadJson(FAV_KEY, []));
  state.chats = loadJson(CHATS_KEY, []);
  const currentId = localStorage.getItem(CURRENT_CHAT_KEY);
  state.currentChat = state.chats.find(c => c.id === currentId) || state.chats[0] || createChat(false);
  applyTheme();
}

function persistSettings() { saveJson(SETTINGS_KEY, state.settings); }
function persistChats() { saveJson(CHATS_KEY, state.chats); if (state.currentChat) localStorage.setItem(CURRENT_CHAT_KEY, state.currentChat.id); }
function persistModels() { saveJson(MODEL_CACHE_KEY, { models: state.liveModels.map(m => m.raw || m), updatedAt: Date.now() }); }
function persistFavourites() { saveJson(FAV_KEY, [...state.favourites]); }

function formatModelName(id) {
  const tail = String(id || '').split('/').pop() || 'Unknown model';
  return tail.replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    .replace(/\bAi\b/g, 'AI').replace(/\bGpt\b/g, 'GPT').replace(/\bLlm\b/g, 'LLM')
    .replace(/\bR1\b/g, 'R1').trim();
}

function rawModelText(raw = {}) {
  try {
    return JSON.stringify(raw, null, 0).toLowerCase();
  } catch (_) {
    return String(raw || '').toLowerCase();
  }
}

function modelHasTruthy(raw = {}, keys = []) {
  for (const key of keys) {
    if (raw && Object.prototype.hasOwnProperty.call(raw, key)) {
      const value = raw[key];
      if (value === true || value === 'true' || value === 1 || value === '1') return true;
      if (typeof value === 'string' && /free endpoint|free_endpoint|free-endpoint|free/.test(value.toLowerCase())) return true;
    }
  }
  return false;
}

function inferCapabilities(id, raw = {}) {
  // NVIDIA /v1/models can expose different metadata shapes over time, so inspect the full raw model object.
  const text = `${id} ${raw.id || ''} ${raw.name || ''} ${raw.description || ''} ${raw.owned_by || ''} ${raw.type || ''} ${raw.category || ''} ${rawModelText(raw)}`.toLowerCase();
  const caps = new Set(['chat', 'live']);
  if (/deepseek|\br1\b|qwq|reason|thinking|nemotron|llama-3\.1-nemotron/.test(text)) caps.add('reasoning');
  if (/coder|coding|code|codestral|devstral|program|software/.test(text)) caps.add('coding');
  if (/research|sonar|retrieval|rag|search/.test(text)) caps.add('research');
  if (/vision|visual|vl\b|multimodal|maverick|pixtral|ocr|image-to-text|llava/.test(text)) caps.add('vision');
  if (/image|stable-diffusion|flux|sdxl|generate-image|text-to-image/.test(text)) caps.add('image');
  if (/speech|audio|voice|whisper|parakeet|tts|asr/.test(text)) caps.add('speech');
  if (/128k|200k|256k|1m|million|long|kimi|context/.test(text)) caps.add('long');
  if (/nano|mini|small|fast|flash|7b|8b|9b|12b|phi|gemma-2b/.test(text)) caps.add('fast');

  const explicitlyFreeEndpoint = isVerifiedFreeEndpoint(id, raw) || modelHasTruthy(raw, [
    'free_endpoint', 'freeEndpoint', 'is_free_endpoint', 'isFreeEndpoint',
    'has_free_endpoint', 'hasFreeEndpoint', 'free', 'is_free', 'isFree'
  ]) || /free[\s_-]*endpoint|free_endpoint|free-endpoint|free endpoint available|endpoint[^a-z0-9]+free/.test(text);

  if (explicitlyFreeEndpoint) {
    caps.add('free_endpoint');
    caps.add('free');
  }
  if (/paid|credit|partner|premium|pay-as-you-go|billing/.test(text)) caps.add('paid');
  if (/enterprise|private|sla/.test(text)) caps.add('enterprise');
  return [...caps];
}


function normaliseModelSlug(value) {
  return String(value || '')
    .toLowerCase()
    .split('/').pop()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function modelMatchKeys(value) {
  const text = String(value || '').toLowerCase();
  const tail = text.split('/').pop() || text;
  const compact = text.replace(/[^a-z0-9]/g, '');
  const tailCompact = tail.replace(/[^a-z0-9]/g, '');
  const hyphen = normaliseModelSlug(text);
  const tailHyphen = normaliseModelSlug(tail);
  return [...new Set([text, tail, compact, tailCompact, hyphen, tailHyphen].filter(Boolean))];
}

function publisherToModelPrefix(publisher = '') {
  const p = String(publisher || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const map = {
    'nvidia': 'nvidia',
    'moonshotai': 'moonshotai',
    'moonshot ai': 'moonshotai',
    'deepseek ai': 'deepseek-ai',
    'deepseek': 'deepseek-ai',
    'z ai': 'z-ai',
    'zai': 'z-ai',
    'minimaxai': 'minimaxai',
    'minimax ai': 'minimaxai',
    'mistral ai': 'mistralai',
    'mistral': 'mistralai',
    'google': 'google',
    'qwen': 'qwen',
    'meta': 'meta',
    'stepfun ai': 'stepfun-ai',
    'stepfun': 'stepfun-ai',
    'resemble ai': 'resemble-ai',
    'black forest labs': 'black-forest-labs',
    'ibm': 'ibm',
    'cohere': 'cohere',
    'snowflake': 'snowflake',
    'databricks': 'databricks',
    '01 ai': '01-ai'
  };
  return map[p] || p.replace(/\s+/g, '-');
}

function modelSortName(m) {
  const sourceRank = m.source === 'api' ? 0 : m.source === 'api+catalog' ? 0 : 1;
  return `${sourceRank}-${m.name || m.id}`;
}

function normalizeModel(raw) {
  if (!raw) return null;
  const obj = typeof raw === 'object' ? raw : { id: raw };
  const id = obj.id || obj.name || obj.model || obj.modelId || obj.slug;
  if (!id) return null;
  const caps = inferCapabilities(id, obj);
  const source = obj.source || (obj.catalogOnly ? 'catalog' : 'api');
  if (source === 'catalog' && !caps.includes('catalog')) caps.push('catalog');
  if ((source === 'api' || source === 'api+catalog') && !caps.includes('api')) caps.push('api');
  return {
    id,
    name: obj.display_name || obj.displayName || obj.title || obj.name || formatModelName(id),
    desc: obj.description || obj.desc || obj.owned_by || (source === 'catalog' ? 'NVIDIA Build catalog model' : 'Live NVIDIA model'),
    capabilities: [...new Set(caps)],
    source,
    catalogOnly: !!obj.catalogOnly || source === 'catalog',
    raw: obj
  };
}
function getCurrentModel() {
  return state.liveModels.find(m => m.id === state.settings.currentModelId) || state.liveModels[0] || null;
}

function badgeLabel(cap) {
  const map = {
    chat: '💬 Chat', reasoning: '🧠 Reasoning', coding: '💻 Coding', research: '📚 Research', vision: '👁 Vision', image: '🖼️ Image', speech: '🎤 Speech', long: '📄 Long', fast: '⚡ Fast', free_endpoint: '🟢 Free Endpoint', free: '🟢 Free', paid: '💳 Paid', enterprise: '🏢 Enterprise', api: '✅ API Available', catalog: '📚 Catalog', catalog_only: '⚠️ Catalog Only', live: 'Live'
  };
  return map[cap] || cap;
}

function capabilityHtml(model) {
  const order = ['free_endpoint', 'api', 'catalog_only', 'reasoning', 'coding', 'research', 'vision', 'image', 'speech', 'long', 'fast', 'free', 'paid', 'enterprise', 'catalog', 'live'];
  const caps = order.filter(c => model.capabilities?.includes(c));
  return `<div class="capability-bar">${caps.map(c => `<span class="capability-tag ${escapeAttr(c)}">${escapeHtml(badgeLabel(c))}</span>`).join('')}</div>`;
}

function buildApiUrl(path) {
  const cleanPath = path.startsWith('/v1/') ? path : `/v1${path.startsWith('/') ? path : `/${path}`}`;
  const proxy = stripSlash(state.settings.proxyUrl);
  return proxy ? `${proxy}${cleanPath}` : `${NVIDIA_DIRECT_BASE}${cleanPath.replace(/^\/v1/, '')}`;
}

function apiHeaders(stream = false) {
  const headers = {
    'Content-Type': 'application/json',
    'Accept': stream ? 'text/event-stream' : 'application/json',
    'Authorization': `Bearer ${state.settings.apiKey || ''}`
  };
  if (stripSlash(state.settings.proxyUrl)) headers['X-Nvidia-Api-Key'] = state.settings.apiKey || '';
  return headers;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 45000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try { return await fetch(url, { ...options, signal: controller.signal }); }
  finally { clearTimeout(timer); }
}

function createChat(persist = true) {
  const chat = { id: uid('chat'), title: 'New Chat', createdAt: Date.now(), messages: [] };
  state.chats.unshift(chat);
  if (persist) persistChats();
  return chat;
}

function newChat() {
  state.currentChat = createChat();
  state.editingMessageId = null;
  renderAll();
}

function renderModeNav() {
  const el = document.getElementById('modeNav');
  if (!el) return;
  el.innerHTML = MODES.map(m => `
    <div class="nav-item ${state.settings.currentMode === m.key ? 'active' : ''}" data-action="set-mode" data-mode="${m.key}" title="${escapeAttr(m.short)}">
      <span style="width:18px;text-align:center;">${m.icon}</span>${escapeHtml(m.label)}
    </div>`).join('');
}

function setMode(modeKey) {
  state.settings.currentMode = modeKey;
  persistSettings();
  updateModeIndicator();
  renderModeNav();
  updateStatus();
  showToast(`Mode changed to ${getMode().label}`);
}

function getMode() { return MODES.find(m => m.key === state.settings.currentMode) || MODES[0]; }
function getAgent() { return AGENTS.find(a => a.key === state.settings.currentAgent) || AGENTS[0]; }

function updateModeIndicator() {
  const mode = getMode();
  const el = document.getElementById('modeIndicator');
  if (el) { el.style.display = 'inline-block'; el.textContent = `${mode.icon} ${mode.label}`; }
  const title = document.getElementById('chatTitle');
  if (title) title.textContent = `${mode.label} Mode`;
}

function renderChatHistory() {
  const el = document.getElementById('chatHistory');
  if (!el) return;
  const q = (state.chatSearch || '').toLowerCase().trim();
  let chats = state.chats.slice();
  if (q) chats = chats.filter(c => (c.title || 'New Chat').toLowerCase().includes(q));
  // Pinned chats float to the top, otherwise keep newest-first order.
  chats.sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned));
  if (!chats.length) {
    el.innerHTML = q ? `<div class="chat-history-empty">No chats match "${escapeHtml(q)}"</div>` : '';
    return;
  }
  el.innerHTML = chats.slice(0, 200).map(chat => {
    const id = escapeAttr(chat.id);
    const active = state.currentChat?.id === chat.id ? 'active' : '';
    const pinned = chat.pinned ? 'pinned' : '';
    return `<div class="chat-history-item ${active} ${pinned}" data-action="select-chat" data-chat-id="${id}" title="${escapeAttr(chat.title || 'New Chat')}">
      <svg class="chat-history-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
      <span class="chat-history-title">${escapeHtml(chat.title || 'New Chat')}</span>
      <span class="chat-history-actions">
        <button class="chat-mini-btn" data-action="pin-chat" data-chat-id="${id}" title="${chat.pinned ? 'Unpin' : 'Pin'}" aria-label="Pin chat">${chat.pinned ? '📌' : '📍'}</button>
        <button class="chat-mini-btn" data-action="rename-chat" data-chat-id="${id}" title="Rename" aria-label="Rename chat">✎</button>
        <button class="chat-mini-btn danger" data-action="delete-chat" data-chat-id="${id}" title="Delete" aria-label="Delete chat">×</button>
      </span>
    </div>`;
  }).join('');
}

function pinChat(id) {
  const chat = state.chats.find(c => c.id === id);
  if (!chat) return;
  chat.pinned = !chat.pinned;
  persistChats();
  renderChatHistory();
  showToast(chat.pinned ? 'Chat pinned' : 'Chat unpinned');
}

function renameChat(id) {
  const chat = state.chats.find(c => c.id === id);
  if (!chat) return;
  const next = prompt('Rename chat', chat.title || 'New Chat');
  if (next === null) return;
  chat.title = next.trim().slice(0, 80) || 'New Chat';
  persistChats();
  renderChatHistory();
  updateModeIndicator();
}

function deleteChat(id, event) {
  event?.preventDefault?.();
  event?.stopPropagation?.();
  const chat = state.chats.find(c => c.id === id);
  if (!chat) return;
  const title = chat.title || 'New Chat';
  if (!confirm(`Delete chat "${title}"?`)) return;
  state.chats = state.chats.filter(c => c.id !== id);
  if (!state.chats.length) {
    state.currentChat = createChat(false);
    state.chats.unshift(state.currentChat);
  } else if (state.currentChat?.id === id) {
    state.currentChat = state.chats[0];
  }
  state.editingMessageId = null;
  persistChats();
  renderAll();
  showToast('Chat deleted');
}

function clearAllChats() {
  if (!confirm('Delete all chats? This cannot be undone.')) return;
  state.chats = [];
  state.currentChat = createChat(false);
  state.chats.unshift(state.currentChat);
  state.editingMessageId = null;
  persistChats();
  renderAll();
  showToast('All chats deleted');
}

function selectChat(id) {
  const chat = state.chats.find(c => c.id === id);
  if (!chat) return;
  state.currentChat = chat;
  state.editingMessageId = null;
  persistChats();
  renderAll();
}

function welcomeHtml() {
  return `<div class="welcome-screen">
    <div class="welcome-logo">🟢</div>
    <div class="welcome-title">NVIDIA AI Desktop</div>
    <div class="welcome-subtitle">Use your NVIDIA Build key with live model loading, favourites, streaming, modes, editing, regeneration and downloads.</div>
    <div class="welcome-cards">
      <div class="welcome-card" data-action="open-settings"><div class="welcome-card-title">1. Settings</div><div class="welcome-card-desc">Add API key and Worker URL.</div></div>
      <div class="welcome-card" data-action="refresh-models"><div class="welcome-card-title">2. Refresh Models</div><div class="welcome-card-desc">Load live NVIDIA models.</div></div>
      <div class="welcome-card" data-action="help"><div class="welcome-card-title">3. Help</div><div class="welcome-card-desc">See what modes and badges do.</div></div>
    </div>
  </div>`;
}

function renderMessages() {
  const container = document.getElementById('chatMessages');
  if (!container || !state.currentChat) return;
  if (!state.currentChat.messages.length) { container.innerHTML = welcomeHtml(); return; }
  container.innerHTML = state.currentChat.messages.map((m, idx) => messageHtml(m, idx)).join('');
  scrollToBottom(false);
}

function messageHtml(m, idx) {
  const isUser = m.role === 'user';
  const avatar = isUser ? (state.settings.userName || 'U').slice(0, 1).toUpperCase() : '🟢';
  const author = isUser ? (state.settings.userName || 'User') : 'NVIDIA AI';
  const visibleContent = isUser ? stripVisibleAttachmentBlocks(m.content || '') : (m.content || '');
  const content = m.loading && !visibleContent ? thinkingHtml(m.status || 'Thinking') : renderMarkdown(visibleContent);
  const generatedFiles = (!isUser && visibleContent && state.settings.plugins.downloadButtons) ? generatedFilesPanelHtml(visibleContent) : '';
  const attachments = isUser ? attachmentSummaryHtml(m.attachments || []) : '';
  const thinking = !isUser ? thinkingDetailsHtml(m) : '';
  const debug = '';
  return `<div class="message" id="msg_${escapeAttr(m.id)}">
    <div class="message-avatar ${isUser ? 'user' : 'assistant'}">${escapeHtml(avatar)}</div>
    <div class="message-content">
      <div class="message-header"><div class="message-author">${escapeHtml(author)}</div><div class="message-time">${escapeHtml(m.time || '')}</div>${m.model ? `<div class="message-time">${escapeHtml(m.model)}</div>` : ''}</div>
      <div class="message-body" id="body_${escapeAttr(m.id)}">${thinking}${debug}${generatedFiles}${content}${attachments}</div>
      ${messageActions(m, idx)}
    </div>
  </div>`;
}

function thinkingHtml(label = 'Thinking') {
  const safeLabel = state.settings.showThinking ? label : 'Generating response';
  return `<span class="thinking-line">${escapeHtml(safeLabel)} <span class="thinking-dots"><span></span><span></span><span></span></span></span>`;
}

function messageActions(m, idx) {
  if (m.loading) return '';
  const id = escapeAttr(m.id);
  if (m.role === 'user') {
    return `<div class="message-actions">
      <button class="message-action" data-action="edit-message" data-id="${id}">Edit</button>
      <button class="message-action" data-action="copy-message" data-id="${id}">Copy</button>
    </div>`;
  }
  return `<div class="message-actions">
    <button class="message-action" data-action="regenerate" data-id="${id}">Regenerate</button>
    <button class="message-action" data-action="copy-message" data-id="${id}">Copy</button>
    <button class="message-action" data-action="download-message" data-id="${id}">Download</button>
  </div>`;
}

function parseGeneratedFilesFromMarkdown(text, options = {}) {
  const src = String(text || '');
  const includeInferred = !!options.includeInferred;
  const files = [];
  const seen = new Set();
  const fenceRe = /```([^\n`]*)\n([\s\S]*?)(?:```|$)/g;
  let match;
  while ((match = fenceRe.exec(src))) {
    const langRaw = (match[1] || '').trim();
    let code = (match[2] || '').replace(/\n$/, '');
    const before = src.slice(Math.max(0, match.index - 260), match.index);
    const meta = extractCodeBlockMeta(langRaw, code, before);
    code = meta.code;
    if (!code.trim()) continue;
    const filename = meta.filename || (includeInferred ? inferFilename(meta.lang) : '');
    if (!filename) continue;
    const key = `${filename.toLowerCase()}::${hashString(code)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    files.push({ filename, lang: meta.lang, code, explicit: meta.explicit });
  }
  return files;
}

function extractCodeBlockMeta(langRaw, codeRaw, before = '') {
  let lang = (langRaw || '').trim() || 'text';
  let code = String(codeRaw || '').replace(/\n$/, '');
  let filename = '';
  let explicit = false;

  const langFile = lang.match(/(?:filename|file|path)\s*[:=]\s*([\w.\-@/\\() ]+)/i) || lang.match(/([\w.\-@/\\()]+\.[a-z0-9]{1,8})/i);
  if (langFile) {
    filename = cleanFilename(langFile[1]);
    lang = lang.replace(langFile[0], '').trim() || inferLanguageFromFilename(filename) || 'text';
    explicit = true;
  }

  const lines = code.split(/\r?\n/);
  const firstLine = lines[0] || '';
  const fileLine = firstLine.match(/^\s*(?:(?:\/\/|#|--|;)\s*)?(?:filename|file|path)\s*[:=]\s*(.+?)\s*(?:\*\/|-->|\*)?\s*$/i)
    || firstLine.match(/^\s*<!--\s*(?:filename|file|path)\s*[:=]\s*(.+?)\s*-->\s*$/i);
  if (!filename && fileLine) {
    filename = cleanFilename(fileLine[1]);
    code = lines.slice(1).join('\n');
    explicit = true;
  }

  if (!filename) {
    const beforeLines = before.split(/\r?\n/).map(x => x.trim()).filter(Boolean).slice(-4).reverse();
    for (const line of beforeLines) {
      const m = line.match(/(?:^|[\s>*_`-])(?:filename|file|path)\s*[:=]\s*`?([^`\n]+?)`?\s*$/i)
        || line.match(/^#{1,6}\s+`?([^`\n]+\.[a-z0-9]{1,8})`?\s*$/i)
        || line.match(/^\*\*`?([^`\n]+\.[a-z0-9]{1,8})`?\*\*\s*:?$/i)
        || line.match(/^`?([^`\n]+\.[a-z0-9]{1,8})`?\s*:?$/i);
      if (m && looksLikeFilename(m[1])) { filename = cleanFilename(m[1]); explicit = true; break; }
    }
  }

  if (filename && (!lang || lang === 'text')) lang = inferLanguageFromFilename(filename) || lang || 'text';
  return { lang: normaliseLang(lang), filename, code, explicit };
}

function generatedFilesPanelHtml(text) {
  const files = parseGeneratedFilesFromMarkdown(text, { includeInferred: false });
  if (!files.length) return '';
  const encoded = encodePayload(files.map(f => ({ filename: f.filename, code: f.code, lang: f.lang })));
  const cards = files.map(f => {
    const single = encodePayload({ filename: f.filename, code: f.code, lang: f.lang });
    return `<div class="generated-file-card">
      <div class="generated-file-icon">📄</div>
      <div class="generated-file-info"><div class="generated-file-name">${escapeHtml(f.filename)}</div><div class="generated-file-meta">${escapeHtml(f.lang)} · ${formatBytes(new Blob([f.code]).size)}</div></div>
      <div class="generated-file-actions"><button class="file-btn" data-action="copy-code" data-payload="${single}">Copy</button><button class="file-btn primary" data-action="download-code" data-payload="${single}">Download</button></div>
    </div>`;
  }).join('');
  const multi = files.length > 1
    ? `<button class="file-btn" data-action="copy-all-files" data-payload="${encoded}">Copy all</button><button class="file-btn primary" data-action="download-zip" data-payload="${encoded}">Download all as ZIP</button>`
    : `<button class="file-btn primary" data-action="download-all-files" data-payload="${encoded}">Download</button>`;
  return `<div class="generated-files-panel"><div class="generated-files-header"><div><strong>Generated files</strong><span>${files.length} file${files.length === 1 ? '' : 's'} detected from the model response</span></div><div class="generated-files-buttons">${multi}</div></div>${cards}</div>`;
}

function renderMarkdown(text) {
  let src = String(text || '');
  const codeBlocks = [];
  src = src.replace(/```([^\n`]*)\n([\s\S]*?)(?:```|$)/g, (full, langRaw, codeRaw, offset) => {
    const before = src.slice(Math.max(0, offset - 260), offset);
    const meta = extractCodeBlockMeta(langRaw, codeRaw, before);
    const id = uid('code');
    codeBlocks.push({ id, lang: meta.lang, code: meta.code, filename: meta.filename || inferFilename(meta.lang), explicit: meta.explicit });
    return `@@CODEBLOCK_${codeBlocks.length - 1}@@`;
  });
  let html = escapeHtml(src)
    .replace(/^### (.*)$/gm, '<h3>$1</h3>')
    .replace(/^## (.*)$/gm, '<h2>$1</h2>')
    .replace(/^# (.*)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>');
  html = html.replace(/@@CODEBLOCK_(\d+)@@/g, (_, n) => codeBlockHtml(codeBlocks[Number(n)]));
  return html;
}

function normaliseLang(lang) {
  const raw = String(lang || 'text').trim().toLowerCase();
  return raw.replace(/[^a-z0-9+#.-]/g, '') || 'text';
}

function inferLanguageFromFilename(filename) {
  const ext = String(filename || '').split('.').pop().toLowerCase();
  return ({ js:'javascript', jsx:'javascript', ts:'typescript', tsx:'typescript', py:'python', html:'html', htm:'html', css:'css', scss:'css', json:'json', md:'markdown', markdown:'markdown', sh:'bash', bash:'bash', ps1:'powershell', sql:'sql', csv:'csv', yml:'yaml', yaml:'yaml', xml:'xml', toml:'toml', txt:'text', dockerfile:'dockerfile' })[ext] || 'text';
}

function inferFilename(lang) {
  const ext = { javascript: 'js', js: 'js', typescript: 'ts', ts: 'ts', python: 'py', py: 'py', html: 'html', css: 'css', json: 'json', markdown: 'md', md: 'md', bash: 'sh', shell: 'sh', powershell: 'ps1', ps1: 'ps1', sql: 'sql', csv: 'csv', text: 'txt', yaml: 'yml', dockerfile: 'Dockerfile' }[String(lang || '').toLowerCase()] || 'txt';
  return ext === 'Dockerfile' ? 'Dockerfile' : `response.${ext}`;
}

function cleanFilename(value) {
  let name = String(value || '').trim().replace(/^['"`]+|['"`]+$/g, '').replace(/[<>:"|?*]/g, '-').replace(/\\/g, '/');
  name = name.split('/').filter(Boolean).join('/');
  if (!name || name.length > 140) return '';
  return name;
}

function looksLikeFilename(value) {
  const name = cleanFilename(value);
  return !!name && (/^[\w .@()\-\/]+\.[a-z0-9]{1,8}$/i.test(name) || /(^|\/)Dockerfile$/i.test(name) || /(^|\/)README$/i.test(name));
}

function hashString(text) {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = ((h << 5) - h + text.charCodeAt(i)) | 0;
  return String(h >>> 0);
}

function encodePayload(data) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(data))));
}

function decodePayload(encoded) {
  return JSON.parse(decodeURIComponent(escape(atob(encoded))));
}

function codeBlockHtml(block) {
  if (!block) return '';
  const encoded = encodePayload({ code: block.code, filename: block.filename, lang: block.lang });
  const actions = `<div class="code-actions"><button class="code-action-btn" data-action="copy-code" data-payload="${encoded}">Copy</button>${state.settings.plugins.downloadButtons ? `<button class="code-action-btn" data-action="download-code" data-payload="${encoded}">Download</button>` : ''}</div>`;
  const header = `<div class="code-block-header"><div><span class="code-lang">${escapeHtml(block.lang)}</span><span class="code-download-name">${escapeHtml(block.filename)}</span></div>${actions}</div>`;
  if (block.explicit) {
    return `<details class="code-block-wrapper generated-code-block"><summary>${header}<span class="preview-hint">Preview code</span></summary><pre><code>${escapeHtml(block.code)}</code></pre></details>`;
  }
  return `<div class="code-block-wrapper">${header}<pre><code>${escapeHtml(block.code)}</code></pre></div>`;
}

function getMessage(id) { return state.currentChat?.messages.find(m => m.id === id); }
function getMessageIndex(id) { return state.currentChat?.messages.findIndex(m => m.id === id) ?? -1; }

async function copyMessage(id) {
  const m = getMessage(id); if (!m) return;
  await navigator.clipboard?.writeText(m.content || '');
  showToast('Copied');
}
function downloadMessage(id) {
  const m = getMessage(id); if (!m) return;
  downloadText(`${m.role}-message.md`, m.content || '');
}
function copyEncodedCode(encoded) {
  const data = decodePayload(encoded);
  navigator.clipboard?.writeText(data.code || '');
  showToast('Code copied');
}
function downloadEncodedCode(encoded) {
  const data = decodePayload(encoded);
  downloadText(data.filename || 'response.txt', data.code || '');
}
function downloadAllEncodedFiles(encoded) {
  const files = decodePayload(encoded);
  if (!Array.isArray(files) || !files.length) return;
  files.forEach((file, index) => {
    setTimeout(() => downloadText(file.filename || `response-${index + 1}.txt`, file.code || ''), index * 250);
  });
  showToast(`Downloading ${files.length} file${files.length === 1 ? '' : 's'}`);
}
function downloadText(filename, text) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  downloadBlob(filename, blob);
}
function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function copyAllEncodedFiles(encoded) {
  const files = decodePayload(encoded);
  if (!Array.isArray(files) || !files.length) return;
  const joined = files.map(f => `/* ===== ${f.filename} ===== */\n${f.code}`).join('\n\n');
  navigator.clipboard?.writeText(joined);
  showToast(`Copied ${files.length} file${files.length === 1 ? '' : 's'} to clipboard`);
}

function downloadFilesAsZip(encoded) {
  const files = decodePayload(encoded);
  if (!Array.isArray(files) || !files.length) return;
  try {
    const blob = buildZipBlob(files.map(f => ({ name: f.filename || 'file.txt', content: String(f.code || '') })));
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    downloadBlob(`nvidia-ai-files-${stamp}.zip`, blob);
    showToast(`Downloaded ${files.length} file${files.length === 1 ? '' : 's'} as ZIP`);
  } catch (err) {
    showToast('ZIP failed, downloading files individually instead.', 'error');
    downloadAllEncodedFiles(encoded);
  }
}

// --- Minimal, dependency-free ZIP writer (store / no compression) ---
const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  return table;
})();
function crc32(bytes) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ bytes[i]) & 0xFF];
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
function buildZipBlob(entries) {
  const enc = new TextEncoder();
  const chunks = [];
  const central = [];
  let offset = 0;
  const u16 = v => new Uint8Array([v & 0xFF, (v >>> 8) & 0xFF]);
  const u32 = v => new Uint8Array([v & 0xFF, (v >>> 8) & 0xFF, (v >>> 16) & 0xFF, (v >>> 24) & 0xFF]);
  const push = (arr) => { chunks.push(arr); offset += arr.length; };
  const usedNames = new Set();

  for (const entry of entries) {
    let name = String(entry.name || 'file.txt').replace(/^\/+/, '');
    while (usedNames.has(name)) name = name.replace(/(\.[^.]*$|$)/, '_$&');
    usedNames.add(name);
    const nameBytes = enc.encode(name);
    const data = enc.encode(entry.content);
    const crc = crc32(data);
    const localHeaderOffset = offset;

    const local = concatBytes([
      u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0),
      u32(crc), u32(data.length), u32(data.length), u16(nameBytes.length), u16(0), nameBytes
    ]);
    push(local);
    push(data);

    central.push(concatBytes([
      u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0),
      u32(crc), u32(data.length), u32(data.length),
      u16(nameBytes.length), u16(0), u16(0), u16(0), u16(0), u32(0),
      u32(localHeaderOffset), nameBytes
    ]));
  }

  const centralStart = offset;
  let centralSize = 0;
  for (const c of central) { chunks.push(c); centralSize += c.length; offset += c.length; }

  const end = concatBytes([
    u32(0x06054b50), u16(0), u16(0), u16(central.length), u16(central.length),
    u32(centralSize), u32(centralStart), u16(0)
  ]);
  chunks.push(end);
  return new Blob(chunks, { type: 'application/zip' });
}
function concatBytes(parts) {
  let len = 0;
  for (const p of parts) len += p.length;
  const out = new Uint8Array(len);
  let pos = 0;
  for (const p of parts) { out.set(p, pos); pos += p.length; }
  return out;
}


function formatBytes(bytes) {
  const n = Number(bytes || 0);
  if (!n) return '0 B';
  const units = ['B', 'KB', 'MB'];
  let value = n;
  let idx = 0;
  while (value >= 1024 && idx < units.length - 1) { value /= 1024; idx++; }
  return `${value.toFixed(value >= 10 || idx === 0 ? 0 : 1)} ${units[idx]}`;
}

function isSupportedTextFile(file) {
  const name = String(file?.name || '').toLowerCase();
  const type = String(file?.type || '').toLowerCase();
  return type.startsWith('text/') || /\.(txt|md|markdown|json|csv|tsv|py|js|jsx|ts|tsx|html|css|scss|xml|yaml|yml|toml|ini|cfg|conf|log|ps1|bat|cmd|sh|sql|java|c|cpp|h|hpp|cs|go|rs|php|rb|swift|kt|dockerfile|env)$/i.test(name);
}

function renderPendingAttachments() {
  const el = document.getElementById('pendingAttachments');
  if (!el) return;
  if (!state.pendingAttachments.length) { el.innerHTML = ''; el.style.display = 'none'; return; }
  el.style.display = 'flex';
  el.innerHTML = state.pendingAttachments.map(att => `
    <div class="attachment-chip" title="${escapeAttr(att.name)}">
      <span class="attachment-icon">📎</span>
      <div class="attachment-info">
        <div class="attachment-name">${escapeHtml(att.name)}</div>
        <div class="attachment-meta">${escapeHtml(att.language || 'text')} • ${escapeHtml(formatBytes(att.size))}</div>
      </div>
      <button class="attachment-remove" type="button" data-action="remove-attachment" data-att-id="${escapeAttr(att.id)}" title="Remove attachment">×</button>
    </div>`).join('');
}

function removePendingAttachment(id) {
  state.pendingAttachments = state.pendingAttachments.filter(a => a.id !== id);
  renderPendingAttachments();
  updateSendButton();
}

function clearPendingAttachments() {
  state.pendingAttachments = [];
  renderPendingAttachments();
  updateSendButton();
}

function attachmentSummaryHtml(attachments = []) {
  if (!attachments.length) return '';
  return `<div class="message-attachments">${attachments.map(att => `
    <div class="message-attachment-card">
      <span>📎</span>
      <div><strong>${escapeHtml(att.name)}</strong><br><small>${escapeHtml(att.language || 'text')} • ${escapeHtml(formatBytes(att.size))}</small></div>
    </div>`).join('')}</div>`;
}

function attachmentPromptText(attachments = []) {
  if (!attachments.length || !state.settings.plugins.fileReader) return '';
  return attachments.map(att => {
    const content = String(att.content || '').slice(0, 200000);
    const truncated = String(att.content || '').length > content.length ? '\n\n[File truncated to 200,000 characters.]' : '';
    return `\n\n[Attached file: ${att.name}\nType: ${att.type || 'text/plain'}\nSize: ${formatBytes(att.size)}]\n\n\`\`\`${att.language || 'text'}\n${content}${truncated}\n\`\`\``;
  }).join('');
}

function updateSendButton() {
  const input = document.getElementById('inputBox');
  const btn = document.getElementById('sendBtn');
  if (!btn || !input) return;
  const hasText = !!input.value.trim();
  const hasFiles = state.pendingAttachments.length > 0;
  btn.disabled = state.isBusy || (!hasText && !hasFiles) || !state.settings.apiKey || !getCurrentModel();
}

function handleKeydown(event) {
  if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendMessage(); }
}
function autoResize(el) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 200) + 'px'; }
function scrollToBottom(smooth = true) { const c = document.getElementById('chatContainer'); if (c) c.scrollTo({ top: c.scrollHeight, behavior: smooth ? 'smooth' : 'auto' }); }

async function sendMessage(overrideText = null) {
  if (state.isBusy) return;
  const input = document.getElementById('inputBox');
  let text = String(overrideText ?? input?.value ?? '').trim();
  const attachments = overrideText === null ? state.pendingAttachments.map(a => ({ ...a })) : [];
  if (!text && attachments.length) text = 'Please review the attached file(s).';
  if (!text && !attachments.length) return;
  if (!state.settings.apiKey) { showToast('Add your NVIDIA API key in Settings first.', 'error'); openSettings(); return; }
  const model = getCurrentModel();
  if (!model) { showToast('Refresh and select a live NVIDIA model first.', 'error'); toggleModelDropdown(); return; }

  let userMsg;
  if (state.editingMessageId) {
    const idx = getMessageIndex(state.editingMessageId);
    if (idx >= 0) {
      userMsg = state.currentChat.messages[idx];
      userMsg.content = text;
      userMsg.attachments = attachments.length ? attachments : (userMsg.attachments || []);
      userMsg.time = nowTime();
      state.currentChat.messages = state.currentChat.messages.slice(0, idx + 1);
    }
    cancelEdit(false);
  } else {
    userMsg = { id: uid('msg'), role: 'user', content: text, attachments, time: nowTime() };
    state.currentChat.messages.push(userMsg);
  }

  if (input && overrideText === null) { input.value = ''; autoResize(input); clearPendingAttachments(); }
  if (state.currentChat.messages.filter(m => m.role === 'user').length === 1) state.currentChat.title = text.slice(0, 42) || 'New Chat';

  const assistantMsg = { id: uid('msg'), role: 'assistant', content: '', thinking: '', loading: true, time: nowTime(), model: model.name, mode: getMode().key };
  state.currentChat.messages.push(assistantMsg);
  persistChats();
  state.isBusy = true;
  renderAll();
  updateSendButton();

  try {
    await requestAssistantResponse(assistantMsg.id);
  } catch (err) {
    const msg = getMessage(assistantMsg.id);
    if (msg) msg.content = `Error: ${friendlyError(err)}`;
    state.diag.lastError = friendlyError(err);
    showToast('Request failed', 'error');
  } finally {
    const msg = getMessage(assistantMsg.id);
    if (msg) msg.loading = false;
    if (msg && msg.debug) state.diag.lastEvents = (msg.debug.counters.sseEvents || 0) + (msg.debug.counters.jsonEvents || 0);
    state.isBusy = false;
    persistChats();
    renderMessages();
    updateSendButton();
  }
}

function friendlyError(err) {
  const raw = err?.message || String(err);
  if (/failed to fetch/i.test(raw)) return 'Failed to fetch. Check your Cloudflare Worker proxy URL, internet connection, and CORS.';
  if (/401/.test(raw)) return 'HTTP 401. Check your NVIDIA API key.';
  if (/404/.test(raw)) return 'HTTP 404. Check the proxy URL and model endpoint.';
  return raw;
}

function buildConversationMessages(extraSystemContext = '') {
  const mode = getMode();
  const agent = getAgent();
  const systemParts = [
    mode.key === 'custom' ? state.settings.customPrompt : mode.prompt,
    agent.prompt,
    state.settings.plugins.thinkingDisplay ? 'If you expose public reasoning via the API, put it in the provider reasoning field. If not, do not reveal hidden chain-of-thought; include a concise reasoning summary only when useful.' : '',
    state.settings.plugins.downloadButtons ? 'When the user asks for files, fixes, patches, full updated files, or downloadable code, output each complete file in its own fenced code block. Put a filename line as the first line inside each block, exactly like: filename: app.js. Do not only describe changes; include the full changed file content when requested.' : '',
    extraSystemContext
  ].filter(Boolean);
  const messages = [];
  if (systemParts.length) messages.push({ role: 'system', content: systemParts.join('\n\n') });
  for (const m of state.currentChat.messages) {
    if (m.loading) continue;
    if (m.role === 'user' || m.role === 'assistant') {
      let content = m.role === 'user' ? stripVisibleAttachmentBlocks(m.content || '') : (m.content || '');
      if (m.role === 'user' && Array.isArray(m.attachments) && m.attachments.length) content += attachmentPromptText(m.attachments);
      messages.push({ role: m.role, content });
    }
  }
  const limit = state.settings.plugins.longContext ? 80 : 30;
  return messages.slice(-limit);
}

function latestUserText() {
  const msgs = state.currentChat?.messages || [];
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (msgs[i].role === 'user') return msgs[i].content || '';
  }
  return '';
}

function shouldSearchWeb(text) {
  const p = state.settings.plugins;
  if (!p.webSearch) return false;
  if (!p.webSearchApiKey && p.webSearchProvider !== 'worker-secret') return false;
  if (p.webSearchMode === 'always') return true;
  return /\b(today|latest|current|now|news|price|release|released|update|updates|changed|2026|2027|this week|this month|weather|score|schedule|available|availability|stock|deal|discount|law|rules|version|models|api|search)\b/i.test(text);
}

async function maybeBuildWebSearchContext(assistantId) {
  const text = latestUserText();
  if (!shouldSearchWeb(text)) return '';
  const msg = getMessage(assistantId);
  if (msg) {
    msg.status = 'Searching the web';
    if (state.settings.showThinking) msg.thinking += `Web Search plugin: searching ${state.settings.plugins.webSearchProvider} for current results...\n`;
    updateAssistantDom(msg);
  }
  try {
    const results = await runWebSearch(text);
    if (!results.length) return 'WEB SEARCH PLUGIN: Search ran but returned no useful results. Tell the user that live search produced no useful result and answer cautiously.';
    if (msg) {
      msg.status = 'Building answer from web results';
      if (state.settings.showThinking) msg.thinking += `Web Search plugin: found ${results.length} result(s).\n`;
      updateAssistantDom(msg);
    }
    return formatWebSearchContext(text, results);
  } catch (err) {
    if (msg) {
      msg.thinking += `Web Search plugin failed: ${friendlyError(err)}\n`;
      updateAssistantDom(msg);
    }
    return `WEB SEARCH PLUGIN ERROR: ${friendlyError(err)}. Do not pretend to have live web results. Explain briefly if the answer needs current information.`;
  }
}

async function runWebSearch(query) {
  const p = state.settings.plugins;
  const response = await fetchWithTimeout(buildApiUrl('/web-search'), {
    method: 'POST',
    headers: {
      ...apiHeaders(false),
      'X-Search-Provider': p.webSearchProvider || 'brave',
      'X-Search-Api-Key': p.webSearchProvider === 'worker-secret' ? '' : (p.webSearchApiKey || '')
    },
    body: JSON.stringify({
      query,
      provider: p.webSearchProvider || 'brave',
      count: Number(p.webSearchResults || 6),
      safe: p.webSearchSafe || 'moderate'
    })
  }, 45000);
  if (!response.ok) throw new Error(await errorFromResponse(response));
  const data = await response.json();
  const results = Array.isArray(data.results) ? data.results : [];
  return results.slice(0, Number(p.webSearchResults || 6));
}

function formatWebSearchContext(query, results) {
  const lines = results.map((r, i) => `${i + 1}. ${r.title || 'Untitled'}\nURL: ${r.url || ''}\nSnippet: ${r.snippet || ''}`).join('\n\n');
  return `WEB SEARCH RESULTS - retrieved live for this user request.\nQuery: ${query}\nDate: ${new Date().toISOString()}\n\nUse these results as current context. Cite source names/URLs in the answer when they are used. If the results do not support a claim, say so.\n\n${lines}`;
}


async function requestAssistantResponse(assistantId) {
  const model = getCurrentModel();
  const startMsg = getMessage(assistantId);
  if (startMsg) { startMsg.status = 'Thinking'; ensureStreamDebug(startMsg); recordStreamEvent(startMsg, 'Prompt queued'); updateAssistantDom(startMsg); }
  const webContext = await maybeBuildWebSearchContext(assistantId);
  const basePayload = {
    model: model.id,
    messages: buildConversationMessages(webContext),
    temperature: Number(state.settings.temperature || 0.7),
    max_tokens: Math.max(Number(state.settings.maxTokens || 2048), modelSupportsReasoning(model) && state.settings.showThinking ? 4096 : 1),
    stream: !!state.settings.stream
  };
  const payload = { ...basePayload, ...reasoningExtrasForModel(model) };

  const sendPayload = async (bodyPayload, retryLabel = '') => {
    const responseMsg = getMessage(assistantId);
    if (responseMsg) {
      responseMsg.status = bodyPayload.stream ? `Waiting for NVIDIA stream${retryLabel}` : `Waiting for NVIDIA response${retryLabel}`;
      responseMsg.debug = null;
      ensureStreamDebug(responseMsg, bodyPayload);
      recordStreamEvent(responseMsg, 'Request started', `${bodyPayload.model} stream=${bodyPayload.stream}${bodyPayload.chat_template_kwargs ? ' reasoning params on' : ''}`);
      updateAssistantDom(responseMsg);
    }

    let seconds = 0;
    const ticker = setInterval(() => {
      const m = getMessage(assistantId);
      if (!m || !m.loading) { clearInterval(ticker); return; }
      seconds += 1;
      if (!m.content) {
        m.status = `Waiting for first token (${seconds}s)`;
        recordStreamEvent(m, 'Still waiting', `${seconds}s since request start`);
        updateAssistantDom(m);
      }
    }, 1000);

    try {
      const response = await fetchWithTimeout(buildApiUrl('/chat/completions'), {
        method: 'POST', headers: apiHeaders(bodyPayload.stream), body: JSON.stringify(bodyPayload)
      }, 120000);
      clearInterval(ticker);
      const msg = getMessage(assistantId);
      if (msg) {
        ensureStreamDebug(msg, bodyPayload);
        msg.debug.http = {
          status: response.status,
          statusText: response.statusText,
          contentType: response.headers.get('content-type') || '',
          transferEncoding: response.headers.get('transfer-encoding') || ''
        };
        recordStreamEvent(msg, 'Response headers received', `${response.status} ${msg.debug.http.contentType}`);
        updateAssistantDom(msg);
      }
      state.diag.lastStatus = response.status;
      state.diag.lastContentType = response.headers.get('content-type') || '';
      if (response.ok) state.diag.lastError = '';
      if (!response.ok) throw new Error(await errorFromResponse(response));
      const contentType = response.headers.get('content-type') || '';
      if (bodyPayload.stream && response.body && /text\/event-stream|application\/x-ndjson|text\/plain/i.test(contentType + response.headers.get('transfer-encoding'))) {
        await readStream(response, assistantId);
      } else if (bodyPayload.stream && response.body) {
        const streamed = await readStream(response, assistantId, true);
        if (!streamed) await readJsonResponse(response, assistantId);
      } else {
        await readJsonResponse(response, assistantId);
      }
    } catch (err) {
      clearInterval(ticker);
      throw err;
    }
  };

  try {
    await sendPayload(payload);
  } catch (err) {
    const text = err?.message || String(err);
    if ((payload.chat_template_kwargs || payload.include_reasoning || payload.thinking_token_budget) && /HTTP (400|422|500)|invalid|unsupported|chat_template|thinking|reasoning/i.test(text)) {
      const msg = getMessage(assistantId);
      if (msg) {
        msg.content = '';
        msg.thinking += `Reasoning params were rejected by NVIDIA for this model, retrying without extra thinking flags. Original error: ${text}\n`;
        recordStreamEvent(msg, 'Retrying without reasoning parameters', text);
        updateAssistantDom(msg);
      }
      await sendPayload(basePayload, ' (retry without reasoning flags)');
    } else {
      throw err;
    }
  }
}

async function errorFromResponse(response) {
  const text = await response.text().catch(() => '');
  try { const json = JSON.parse(text); return `HTTP ${response.status}: ${json.error?.message || json.error || text}`; }
  catch { return `HTTP ${response.status}: ${text || response.statusText}`; }
}

async function readJsonResponse(response, assistantId) {
  const data = await response.json();
  const msg = getMessage(assistantId); if (!msg) return;
  ensureStreamDebug(msg);
  recordStreamEvent(msg, 'Non-stream JSON parsed');
  recordRawStreamSample(msg, JSON.stringify(data, null, 2));
  const reasoning = extractFullReasoning(data);
  if (reasoning && state.settings.showThinking) appendPublicReasoning(msg, reasoning);
  const content = extractFullResponse(data) || JSON.stringify(data, null, 2);
  appendAssistantVisibleOrReasoning(msg, content);
  msg.status = 'Done';
  updateAssistantDom(msg);
}

async function readStream(response, assistantId, mayFail = false) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let rawText = '';
  let sawChunk = false;

  const msgAtStart = getMessage(assistantId);
  if (msgAtStart) {
    msgAtStart.status = 'Streaming response';
    updateAssistantDom(msgAtStart);
  }

  const applyDelta = (delta) => {
    const msg = getMessage(assistantId);
    if (!msg) return false;
    const debug = ensureStreamDebug(msg);
    if (!delta.content && !delta.thinking) { if (debug) debug.counters.emptyDeltas++; return false; }
    if (delta.thinking && state.settings.showThinking) { appendPublicReasoning(msg, delta.thinking); if (debug) debug.counters.reasoningDeltas++; recordStreamEvent(msg, 'Reasoning delta', shortText(delta.thinking, 160)); }
    if (delta.content) { appendAssistantVisibleOrReasoning(msg, delta.content); if (debug) debug.counters.contentDeltas++; recordStreamEvent(msg, 'Content delta', shortText(delta.content, 160)); }
    if (delta.content || delta.thinking) msg.status = delta.thinking && !delta.content ? 'Receiving public reasoning' : 'Writing response';
    updateAssistantDom(msg);
    return true;
  };

  const tryJsonPayload = (payload) => {
    const clean = String(payload || '').trim();
    if (!clean || clean === '[DONE]' || clean.startsWith('event:')) return false;
    try {
      const json = JSON.parse(clean);
      const msg = getMessage(assistantId);
      if (msg) { const debug = ensureStreamDebug(msg); if (debug) debug.counters.jsonEvents++; }
      return applyDelta(extractDelta(json));
    } catch (_) {
      return false;
    }
  };

  const processLine = (line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith(':') || trimmed.startsWith('event:')) return;
    if (trimmed.startsWith('data:')) {
      const payload = trimmed.slice(5).trim();
      const msg = getMessage(assistantId);
      if (msg) { const debug = ensureStreamDebug(msg); if (debug) debug.counters.sseEvents++; recordRawStreamSample(msg, payload); }
      if (tryJsonPayload(payload)) sawChunk = true;
      return;
    }
    if (tryJsonPayload(trimmed)) {
      sawChunk = true;
      return;
    }
    if (!mayFail) {
      const msg = getMessage(assistantId);
      if (msg && trimmed && trimmed !== '[DONE]') {
        appendAssistantVisibleOrReasoning(msg, trimmed);
        msg.status = 'Writing response';
        updateAssistantDom(msg);
        sawChunk = true;
      }
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    const text = decoder.decode(value, { stream: true });
    rawText += text;
    buffer += text;
    const chunkMsg = getMessage(assistantId);
    if (chunkMsg) { const debug = ensureStreamDebug(chunkMsg); if (debug) { debug.counters.chunks++; recordRawStreamSample(chunkMsg, text); } }

    const waitingMsg = getMessage(assistantId);
    if (waitingMsg && !waitingMsg.content) {
      waitingMsg.status = sawChunk ? 'Writing response' : 'Receiving response';
      updateAssistantDom(waitingMsg);
    }

    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || '';
    for (const line of lines) processLine(line);
  }

  if (buffer.trim()) processLine(buffer);

  if (!sawChunk) {
    // Some proxies/models ignore streaming and send one full JSON object through a readable body.
    try {
      const json = JSON.parse(rawText.trim());
      const content = extractFullResponse(json);
      if (content) {
        const msg = getMessage(assistantId);
        if (msg) {
          appendAssistantVisibleOrReasoning(msg, content);
          msg.status = 'Done';
          updateAssistantDom(msg);
          sawChunk = true;
        }
      }
    } catch (_) {
      if (!mayFail && rawText.trim()) {
        const msg = getMessage(assistantId);
        if (msg) {
          appendAssistantVisibleOrReasoning(msg, rawText.trim());
          msg.status = 'Done';
          updateAssistantDom(msg);
          sawChunk = true;
        }
      }
    }
  }

  return sawChunk;
}

function contentToString(value) {
  if (value === null || value === undefined || value === false) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map(part => contentToString(part)).join('');
  if (typeof value === 'object') {
    if (typeof value.text === 'string') return value.text;
    if (typeof value.content === 'string') return value.content;
    if (Array.isArray(value.content)) return contentToString(value.content);
    if (typeof value.value === 'string') return value.value;
    if (typeof value.output_text === 'string') return value.output_text;
  }
  return String(value);
}

function extractFullResponse(json) {
  const choice = json?.choices?.[0] || {};
  const msg = choice?.message || choice || {};
  return contentToString(msg.content) || contentToString(choice?.text) || contentToString(json?.output_text) || contentToString(json?.content) || contentToString(json?.response);
}

function extractFullReasoning(json) {
  const choice = json?.choices?.[0] || {};
  const msg = choice?.message || choice || {};
  return contentToString(msg.reasoning_content) || contentToString(msg.reasoning) || contentToString(msg.thinking) || contentToString(msg.thought) || contentToString(msg.reasoning_details) || contentToString(json?.reasoning_content) || contentToString(json?.reasoning) || contentToString(json?.thinking);
}

function extractDelta(json) {
  const choice = json?.choices?.[0] || {};
  const delta = choice.delta || choice.message || choice;
  return {
    content: contentToString(delta.content) || contentToString(delta.text) || contentToString(json.output_text) || contentToString(json.content),
    thinking: contentToString(delta.reasoning_content) || contentToString(delta.reasoning) || contentToString(delta.thinking) || contentToString(delta.thought) || contentToString(delta.reasoning_details) || contentToString(json.reasoning_content) || contentToString(json.reasoning) || contentToString(json.thinking)
  };
}

function updateAssistantDom(msg) {
  const body = document.getElementById(`body_${msg.id}`);
  if (body) {
    const thinking = thinkingDetailsHtml(msg);
    const debug = '';
    const progress = msg.loading && !msg.content ? thinkingHtml(msg.status || 'Thinking') : '';
    const generatedFiles = (msg.content && state.settings.plugins.downloadButtons) ? generatedFilesPanelHtml(msg.content) : '';
    body.innerHTML = thinking + debug + generatedFiles + (msg.content ? renderMarkdown(msg.content) : progress);
  }
  scrollToBottom(true);
}

function editUserMessage(id) {
  const msg = getMessage(id); if (!msg || msg.role !== 'user') return;
  const input = document.getElementById('inputBox');
  input.value = stripVisibleAttachmentBlocks(msg.content || '');
  state.pendingAttachments = Array.isArray(msg.attachments) ? msg.attachments.map(a => ({ ...a, id: uid('att') })) : [];
  renderPendingAttachments();
  autoResize(input);
  state.editingMessageId = id;
  document.getElementById('editingBanner').style.display = 'flex';
  input.focus();
  updateSendButton();
}
function cancelEdit(show = true) {
  state.editingMessageId = null;
  const banner = document.getElementById('editingBanner'); if (banner) banner.style.display = 'none';
  if (show) { clearPendingAttachments(); showToast('Edit cancelled'); }
}

async function regenerateResponse(assistantId) {
  if (state.isBusy) return;
  const idx = getMessageIndex(assistantId);
  if (idx < 0) return;
  let userIdx = -1;
  for (let i = idx - 1; i >= 0; i--) {
    if (state.currentChat.messages[i].role === 'user') { userIdx = i; break; }
  }
  if (userIdx < 0) return;
  const model = getCurrentModel();
  if (!model) { showToast('Refresh and select a live NVIDIA model first.', 'error'); return; }
  state.currentChat.messages = state.currentChat.messages.slice(0, userIdx + 1);
  state.editingMessageId = null;
  const assistantMsg = { id: uid('msg'), role: 'assistant', content: '', thinking: '', loading: true, time: nowTime(), model: model.name, mode: getMode().key };
  state.currentChat.messages.push(assistantMsg);
  state.isBusy = true;
  persistChats(); renderAll(); updateSendButton();
  try {
    await requestAssistantResponse(assistantMsg.id);
  } catch (err) {
    const msg = getMessage(assistantMsg.id);
    if (msg) msg.content = `Error: ${friendlyError(err)}`;
    showToast('Regenerate failed', 'error');
  } finally {
    const msg = getMessage(assistantMsg.id); if (msg) msg.loading = false;
    state.isBusy = false; persistChats(); renderMessages(); updateSendButton();
  }
}


function buildModelIndex(models) {
  const index = new Map();
  for (const model of models) {
    for (const key of modelMatchKeys(model.id)) index.set(key, model);
    for (const key of modelMatchKeys(model.name)) index.set(key, model);
    const raw = model.raw || {};
    for (const key of modelMatchKeys(raw.slug || raw.catalogSlug || raw.modelSlug || '')) index.set(key, model);
  }
  return index;
}

function mergeCatalogIntoApiModels(apiModels, catalogModels) {
  const models = [...apiModels];
  const index = buildModelIndex(models);
  let matched = 0;
  let added = 0;

  for (const rawCat of catalogModels) {
    const cat = normalizeModel({ ...rawCat, source: 'catalog', catalogOnly: true });
    if (!cat) continue;
    const keys = [
      ...modelMatchKeys(cat.id),
      ...modelMatchKeys(cat.name),
      ...modelMatchKeys(rawCat.slug),
      ...modelMatchKeys(rawCat.catalogSlug)
    ];
    let existing = null;
    for (const key of keys) {
      if (index.has(key)) { existing = index.get(key); break; }
    }

    if (existing) {
      existing.name = existing.name || cat.name;
      if (cat.desc && (!existing.desc || existing.desc === 'Live NVIDIA model')) existing.desc = cat.desc;
      existing.capabilities = [...new Set([...(existing.capabilities || []), ...(cat.capabilities || []), 'api'])].filter(c => c !== 'catalog_only');
      existing.source = 'api+catalog';
      existing.catalogOnly = false;
      existing.raw = { ...(existing.raw || {}), catalog: rawCat, source: 'api+catalog' };
      matched++;
    } else {
      cat.capabilities = [...new Set([...(cat.capabilities || []), 'catalog', 'catalog_only'])];
      cat.catalogOnly = true;
      models.push(cat);
      for (const key of keys) if (!index.has(key)) index.set(key, cat);
      added++;
    }
  }
  return { models, matched, added };
}

async function fetchBuildCatalogModels() {
  if (!stripSlash(state.settings.proxyUrl)) return { models: [], ok: false, skipped: true, message: 'Build catalog requires the Cloudflare Worker.' };
  try {
    const response = await fetchWithTimeout(buildApiUrl('/build-models'), { method: 'GET', headers: apiHeaders(false) }, 60000);
    if (!response.ok) throw new Error(await errorFromResponse(response));
    const data = await response.json();
    const models = Array.isArray(data?.models) ? data.models : [];
    return { models, ok: true, total: data.total || models.length, freeEndpointCount: data.freeEndpointCount || 0 };
  } catch (err) {
    console.warn('Build catalog refresh failed:', err);
    return { models: [], ok: false, message: friendlyError(err) };
  }
}

async function refreshModelsFromNvidia(manual = false) {
  if (!state.settings.apiKey) { showToast('Add your API key first.', 'error'); openSettings(); return 0; }
  setModelMeta('Refreshing NVIDIA API models and Build catalog…');
  try {
    const response = await fetchWithTimeout(buildApiUrl('/models'), { method: 'GET', headers: apiHeaders(false) }, 45000);
    if (!response.ok) throw new Error(await errorFromResponse(response));
    const data = await response.json();
    const rawModels = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
    if (!rawModels.length) throw new Error('NVIDIA returned no API models.');

    const byId = new Map();
    for (const raw of rawModels) {
      const m = normalizeModel({ ...raw, source: 'api' });
      if (m) byId.set(m.id, m);
    }

    const apiModels = [...byId.values()];
    const catalog = await fetchBuildCatalogModels();
    let merged = { models: apiModels, matched: 0, added: 0 };
    if (catalog.models.length) merged = mergeCatalogIntoApiModels(apiModels, catalog.models);

    state.liveModels = merged.models.sort((a, b) => modelSortName(a).localeCompare(modelSortName(b)));
    if (!getCurrentModel()) state.settings.currentModelId = state.liveModels.find(m => !m.catalogOnly)?.id || state.liveModels[0]?.id || '';
    persistModels(); persistSettings();
    renderModelList(); updateSelectedModelLabel(); updateStatus(); updateSendButton();

    const freeCount = state.liveModels.filter(m => m.capabilities?.includes('free_endpoint')).length;
    const catalogNote = catalog.ok ? ` • ${catalog.models.length} Build catalog models merged` : ` • Build catalog unavailable${catalog.message ? ': ' + catalog.message : ''}`;
    setModelMeta(`${apiModels.length} API models • ${state.liveModels.length} shown • ${freeCount} Free Endpoint${catalogNote}`);
    if (manual) showToast(`Loaded ${state.liveModels.length} models (${freeCount} Free Endpoint)`);
    return state.liveModels.length;
  } catch (err) {
    setModelMeta(`Could not refresh models: ${friendlyError(err)}`);
    if (manual) showToast(friendlyError(err), 'error');
    return 0;
  }
}
function setModelMeta(text) { const el = document.getElementById('modelMeta'); if (el) el.textContent = text; }
function getModelsForCurrentTab() {
  const search = (document.getElementById('modelSearch')?.value || '').toLowerCase().trim();
  let models = state.liveModels.slice();
  if (state.modelTab === 'favorites') models = models.filter(m => state.favourites.has(m.id));
  else if (state.modelTab !== 'all') models = models.filter(m => m.capabilities?.includes(state.modelTab));
  if (search) models = models.filter(m => `${m.name} ${m.id} ${m.desc} ${(m.capabilities || []).join(' ')}`.toLowerCase().includes(search));
  return models.sort((a, b) => Number(state.favourites.has(b.id)) - Number(state.favourites.has(a.id)) || a.name.localeCompare(b.name));
}

function renderModelList() {
  const list = document.getElementById('modelList'); if (!list) return;
  const models = getModelsForCurrentTab();
  const current = getCurrentModel();
  if (!state.liveModels.length) {
    list.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🟢</div><div class="empty-state-title">No live models loaded</div><div class="empty-state-desc">Add your API key and Worker URL, then click Refresh Models.</div></div>`;
    setModelMeta('No live models loaded. Click Refresh Models.');
    return;
  }
  if (!models.length) {
    list.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⭐</div><div class="empty-state-title">No models here</div><div class="empty-state-desc">Try Refresh Models. If this is the Free Endpoint tab, the app now uses verified fallback tags as well as NVIDIA metadata.</div></div>`;
    setModelMeta(`${state.liveModels.length} live models loaded • ${state.favourites.size} favourites`);
    return;
  }
  list.innerHTML = models.map(m => `
    <div class="model-item ${current?.id === m.id ? 'selected' : ''}">
      <button class="model-star ${state.favourites.has(m.id) ? 'active' : ''}" data-action="toggle-fav" data-model-id="${escapeAttr(m.id)}" title="Favourite">${state.favourites.has(m.id) ? '★' : '☆'}</button>
      <div class="model-item-info" data-action="select-model" data-model-id="${escapeAttr(m.id)}">
        <div class="model-item-name">${escapeHtml(m.name)}${m.catalogOnly ? ' <span class="capability-tag catalog_only">Catalog only</span>' : ''}</div>
        <div class="model-item-desc">${escapeHtml(m.desc || 'Live NVIDIA model')}</div>
        <div class="model-item-desc"><code>${escapeHtml(m.id)}</code></div>
        ${capabilityHtml(m)}
      </div>
    </div>`).join('');
  setModelMeta(`${models.length} shown • ${state.liveModels.length} live models • ${state.favourites.size} favourites`);
}

function switchModelTab(tab, el) {
  state.modelTab = tab;
  document.querySelectorAll('.model-tab').forEach(b => b.classList.toggle('active', el ? b === el : b.dataset.tab === tab));
  renderModelList();
}
function filterModels() { renderModelList(); }
function toggleModelDropdown() { const dd = document.getElementById('modelDropdown'); if (dd) { dd.classList.toggle('open'); renderModelList(); } }
function selectModel(id) {
  const model = state.liveModels.find(m => m.id === id);
  if (model?.catalogOnly) showToast('Catalog-only model selected. If chat fails, NVIDIA may require a different exact model ID or endpoint.', 'error');
  state.settings.currentModelId = id;
  persistSettings();
  updateSelectedModelLabel();
  renderModelList();
  updateStatus(); updateSendButton();
  document.getElementById('modelDropdown')?.classList.remove('open');
}
function toggleFavourite(id, event) {
  event?.stopPropagation();
  if (state.favourites.has(id)) state.favourites.delete(id); else state.favourites.add(id);
  persistFavourites(); renderModelList(); updateStatus();
}
function updateSelectedModelLabel() {
  const model = getCurrentModel();
  const label = document.getElementById('selectedModelName');
  if (label) label.textContent = model ? model.name : 'Load models';
}

function openSettings() {
  document.getElementById('apiKeyInput').value = state.settings.apiKey || '';
  document.getElementById('proxyUrlInput').value = state.settings.proxyUrl || '';
  document.getElementById('userNameInput').value = state.settings.userName || '';
  document.getElementById('tempSlider').value = state.settings.temperature;
  document.getElementById('tempValue').textContent = state.settings.temperature;
  document.getElementById('maxTokensSelect').value = String(state.settings.maxTokens);
  document.getElementById('streamSelect').value = state.settings.stream ? 'yes' : 'no';
  document.getElementById('thinkingSelect').value = state.settings.plugins.thinkingDisplay ? 'yes' : 'no';
  const diagSelect = document.getElementById('diagnosticsSelect'); if (diagSelect) diagSelect.value = state.settings.streamDiagnostics ? 'yes' : 'no';
  const forceReasoningSelect = document.getElementById('forceReasoningSelect'); if (forceReasoningSelect) forceReasoningSelect.value = state.settings.forceReasoning ? 'yes' : 'no';
  document.getElementById('themeSelect').value = state.settings.theme || 'dark';
  document.getElementById('customPromptInput').value = state.settings.customPrompt || '';
  document.getElementById('settingsModal').classList.add('open');
}
function closeSettings() { document.getElementById('settingsModal').classList.remove('open'); }
function saveSettings() {
  state.settings.apiKey = document.getElementById('apiKeyInput').value.trim();
  state.settings.proxyUrl = stripSlash(document.getElementById('proxyUrlInput').value);
  state.settings.userName = document.getElementById('userNameInput').value.trim() || 'Luke';
  state.settings.temperature = Number(document.getElementById('tempSlider').value || 0.7);
  state.settings.maxTokens = Number(document.getElementById('maxTokensSelect').value || 2048);
  state.settings.stream = document.getElementById('streamSelect').value === 'yes';
  state.settings.plugins.thinkingDisplay = document.getElementById('thinkingSelect').value === 'yes';
  state.settings.showThinking = state.settings.plugins.thinkingDisplay;
  const diagSelect = document.getElementById('diagnosticsSelect'); if (diagSelect) state.settings.streamDiagnostics = diagSelect.value === 'yes';
  const forceReasoningSelect = document.getElementById('forceReasoningSelect'); if (forceReasoningSelect) state.settings.forceReasoning = forceReasoningSelect.value === 'yes';
  state.settings.theme = document.getElementById('themeSelect').value;
  state.settings.customPrompt = document.getElementById('customPromptInput').value;
  persistSettings(); applyTheme(); updateStatus(); updateSendButton(); renderMessages();
  showConnectionStatus('Saved settings.', true);
  showToast('Settings saved');
}
function clearApiKey() { state.settings.apiKey = ''; persistSettings(); openSettings(); updateStatus(); updateSendButton(); showToast('API key cleared'); }

function exportSettings() {
  const includeSecrets = confirm('Include your NVIDIA API key and search key in the export?\n\nOK = include secrets (keep the file private)\nCancel = export without secrets (safe to share)');
  const s = JSON.parse(JSON.stringify(state.settings));
  if (!includeSecrets) {
    s.apiKey = '';
    if (s.plugins) s.plugins.webSearchApiKey = '';
  }
  const payload = { type: 'nvidia-ai-desktop-settings', version: APP_VERSION, exportedAt: new Date().toISOString(), settings: s, favourites: [...state.favourites] };
  downloadText(`nvidia-ai-settings-${Date.now()}.json`, JSON.stringify(payload, null, 2));
  showToast(includeSecrets ? 'Settings exported (includes secrets)' : 'Settings exported (no secrets)');
}

function importSettings() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json,.json';
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const incoming = data.settings || data;
      if (!incoming || typeof incoming !== 'object') throw new Error('Not a settings file.');
      // Preserve existing API key if the imported file omitted it.
      const keepKey = state.settings.apiKey;
      const keepSearchKey = state.settings.plugins?.webSearchApiKey;
      state.settings = { ...state.settings, ...incoming };
      state.settings.plugins = { ...DEFAULT_PLUGINS, ...(incoming.plugins || {}) };
      if (!state.settings.apiKey) state.settings.apiKey = keepKey || '';
      if (!state.settings.plugins.webSearchApiKey) state.settings.plugins.webSearchApiKey = keepSearchKey || '';
      state.settings.showThinking = !!state.settings.plugins.thinkingDisplay;
      if (Array.isArray(data.favourites)) state.favourites = new Set(data.favourites);
      persistSettings(); persistFavourites(); applyTheme();
      closePanel(); renderAll();
      showToast('Settings imported');
    } catch (err) {
      showToast(`Import failed: ${err.message || err}`, 'error');
    }
  });
  input.click();
}
async function testConnection() {
  saveSettings();
  showConnectionStatus('Testing connection…', true);
  const count = await refreshModelsFromNvidia(false);
  if (count) {
    state.lastConnection = { ok: true, at: Date.now(), count };
    showConnectionStatus(`Connection OK. Loaded ${count} live models.\nMode: ${state.settings.proxyUrl ? 'Proxy' : 'Direct'}`, true);
  } else {
    state.lastConnection = { ok: false, at: Date.now() };
    showConnectionStatus('Connection failed. Check API key and Worker URL.', false);
  }
  updateStatus();
}
async function refreshModelsFromSettings() { saveSettings(); await refreshModelsFromNvidia(true); }
function showConnectionStatus(text, success) { const el = document.getElementById('connectionStatus'); if (el) { el.style.display = 'block'; el.textContent = text; el.className = `connection-status ${success ? 'success' : 'error'}`; } }
function applyTheme() { document.body.classList.toggle('light-theme', state.settings.theme === 'light'); }

function updateStatus() {
  const status = document.getElementById('statusText');
  const name = document.getElementById('statusName');
  const avatar = document.getElementById('statusAvatar');
  const connected = !!state.settings.apiKey && !!state.liveModels.length;
  if (name) name.textContent = state.settings.userName || 'User';
  if (avatar) {
    avatar.textContent = (state.settings.userName || 'U').slice(0, 1).toUpperCase();
    avatar.style.background = 'rgba(118,185,0,0.15)';
    avatar.style.color = '#76B900';
    avatar.style.border = '1px solid rgba(118,185,0,0.35)';
  }
  const card = document.getElementById('statusCard');
  if (card) card.title = 'Open account and app status';
  if (status) status.textContent = connected ? `🟢 ${state.liveModels.length} live models` : state.settings.apiKey ? '🟡 Key saved' : '🔴 Disconnected';
  const agentBadge = document.getElementById('agentBadge'); if (agentBadge) agentBadge.textContent = getAgent().name;
}

function ensurePanelElements() {
  let overlay = document.getElementById('panelOverlay');
  let panel = document.getElementById('sidePanel');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'panelOverlay';
    overlay.className = 'panel-overlay';
    overlay.addEventListener('click', closePanel);
    document.body.appendChild(overlay);
  }
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'sidePanel';
    panel.className = 'side-panel';
    panel.innerHTML = '<div class="panel-header"><div class="panel-title" id="panelTitle">Panel</div><button class="panel-close" data-action="close-panel">×</button></div><div class="panel-body" id="panelBody"></div>';
    document.body.appendChild(panel);
  }
  if (!document.getElementById('panelTitle')) {
    panel.innerHTML = '<div class="panel-header"><div class="panel-title" id="panelTitle">Panel</div><button class="panel-close" data-action="close-panel">×</button></div><div class="panel-body" id="panelBody"></div>';
  }
}

function openPanel(title, html) {
  ensurePanelElements();
  const titleEl = document.getElementById('panelTitle');
  const bodyEl = document.getElementById('panelBody');
  const overlay = document.getElementById('panelOverlay');
  const panel = document.getElementById('sidePanel');
  if (titleEl) titleEl.textContent = title;
  if (bodyEl) bodyEl.innerHTML = html;
  overlay?.classList.add('open');
  panel?.classList.add('open');
  // Inline fallback makes the panel appear even if an old/cached CSS file is still loaded.
  if (overlay) overlay.style.display = 'block';
  if (panel) panel.style.transform = 'translateX(0)';
}

function closePanel() {
  const overlay = document.getElementById('panelOverlay');
  const panel = document.getElementById('sidePanel');
  overlay?.classList.remove('open');
  panel?.classList.remove('open');
  if (overlay) overlay.style.display = '';
  if (panel) panel.style.transform = '';
}


function boolText(value) { return value ? 'On' : 'Off'; }
function pluginToggleHtml(key, icon, name, desc, disabled = false) {
  const enabled = !!state.settings.plugins[key];
  return `<div class="plugin-item ${disabled ? 'disabled' : ''}">
    <div class="plugin-icon">${icon}</div>
    <div class="plugin-info"><div class="plugin-name">${escapeHtml(name)}</div><div class="plugin-desc">${escapeHtml(desc)}</div></div>
    <button class="toggle-switch ${enabled ? 'on' : ''}" ${disabled ? 'disabled' : ''} data-action="toggle-plugin" data-key="${key}" title="${boolText(enabled)}"></button>
  </div>`;
}

function openPluginsPanel() {
  const p = state.settings.plugins;
  const html = `
    <div class="mode-help-card"><h3>Real plugins</h3><p>These toggles now change what the app does. Web Search uses your Cloudflare Worker plus a search provider, then injects results into the NVIDIA model prompt.</p></div>
    ${pluginToggleHtml('webSearch', '🌐', 'Web Search', 'Uses Brave Search/Tavily through your Worker before asking the model.')}
    <div class="plugin-settings ${p.webSearch ? '' : 'muted'}">
      <label class="setting-label">Search provider</label>
      <select class="setting-select" data-action="plugin-set" data-key="webSearchProvider">
        <option value="brave" ${p.webSearchProvider === 'brave' ? 'selected' : ''}>Brave Search API - recommended</option>
        <option value="tavily" ${p.webSearchProvider === 'tavily' ? 'selected' : ''}>Tavily Search API - LLM/RAG focused</option>
        <option value="worker-secret" ${p.webSearchProvider === 'worker-secret' ? 'selected' : ''}>Use Worker secret BRAVE_SEARCH_API_KEY</option>
      </select>
      <label class="setting-label" style="margin-top:10px;">Search API key</label>
      <input class="setting-input" type="password" value="${escapeAttr(p.webSearchApiKey || '')}" placeholder="Brave or Tavily API key" autocomplete="off" data-action="plugin-set-input" data-key="webSearchApiKey">
      <div class="setting-desc">Recommended: Brave Search API. Or store the key as a Worker secret (BRAVE_SEARCH_API_KEY) and choose the Worker-secret option so the key never touches the browser. DuckDuckGo is not included because its free Instant Answer API is not a full web search results API.</div>
      <div class="form-row plugin-form-row">
        <div><label class="setting-label">Results</label><input class="setting-input" type="number" min="1" max="10" value="${Number(p.webSearchResults || 6)}" data-action="plugin-set" data-key="webSearchResults"></div>
        <div><label class="setting-label">Behaviour</label><select class="setting-select" data-action="plugin-set" data-key="webSearchMode"><option value="auto" ${p.webSearchMode === 'auto' ? 'selected' : ''}>Auto-detect current queries</option><option value="always" ${p.webSearchMode === 'always' ? 'selected' : ''}>Search every prompt</option></select></div>
      </div>
      <div class="btn-row" style="margin-top:10px;"><button class="btn btn-secondary" data-action="test-web-search">Test Web Search</button></div>
      <div id="pluginTestStatus" class="connection-status" style="display:none;"></div>
    </div>
    ${pluginToggleHtml('fileReader', '📁', 'File Reader', 'Reads attached text/code/CSV/Markdown files into the prompt.')}
    ${pluginToggleHtml('downloadButtons', '⬇️', 'Download Buttons', 'Shows Download buttons on generated code/file blocks.')}
    ${pluginToggleHtml('thinkingDisplay', '🧠', 'Thinking Display', 'Shows Thinking… and plugin progress while waiting/streaming.')}
    ${pluginToggleHtml('longContext', '📄', 'Long Context', 'Sends more chat history to the model. Uses more tokens.')}
    ${pluginToggleHtml('codeInterpreter', '💻', 'Code Interpreter', 'Disabled: needs a real backend sandbox, not just GitHub Pages.', true)}
  `;
  openPanel('Plugins', html);
}

function togglePlugin(key) {
  if (key === 'codeInterpreter') { showToast('Code Interpreter needs a backend sandbox before it can be enabled.', 'error'); return; }
  state.settings.plugins[key] = !state.settings.plugins[key];
  if (key === 'thinkingDisplay') state.settings.showThinking = !!state.settings.plugins.thinkingDisplay;
  persistSettings();
  openPluginsPanel();
  updateStatus();
  showToast(`${key} ${state.settings.plugins[key] ? 'enabled' : 'disabled'}`);
}

function setPluginSetting(key, value, reopen = false) {
  if (key === 'webSearchResults') value = Math.max(1, Math.min(10, Number(value || 6)));
  state.settings.plugins[key] = value;
  persistSettings();
  if (reopen) openPluginsPanel();
}

function showPluginTestStatus(text, success) {
  const el = document.getElementById('pluginTestStatus');
  if (!el) return;
  el.style.display = 'block';
  el.textContent = text;
  el.className = `connection-status ${success ? 'success' : 'error'}`;
}

async function testWebSearchPlugin() {
  const p = state.settings.plugins;
  if (!p.webSearch) { showPluginTestStatus('Turn Web Search on first.', false); return; }
  if (!p.webSearchApiKey && p.webSearchProvider !== 'worker-secret') { showPluginTestStatus('Add a Brave/Tavily search API key first.', false); return; }
  showPluginTestStatus('Testing web search…', true);
  try {
    const results = await runWebSearch('NVIDIA latest AI models');
    showPluginTestStatus(`Web Search OK. Found ${results.length} result(s).\n${results.slice(0, 3).map((r, i) => `${i + 1}. ${r.title}`).join('\n')}`, true);
  } catch (err) {
    showPluginTestStatus(friendlyError(err), false);
  }
}

function openAgentPanel() {
  const cards = AGENTS.map(a => `<div class="agent-card ${state.settings.currentAgent === a.key ? 'selected' : ''}" data-action="select-agent" data-agent="${a.key}">
    <div class="agent-header"><div class="agent-avatar">${a.emoji}</div><div><div class="agent-name">${escapeHtml(a.name)}</div><div class="agent-role">${escapeHtml(a.role)}</div></div></div>
    <div class="agent-desc">${escapeHtml(a.prompt || 'No extra prompt. Balanced default behaviour.')}</div>
  </div>`).join('');
  openPanel('Agent Swarm', `<div class="mode-help-card"><h3>Agent Swarm is active</h3><p>Pick one agent below. The selected agent is added to the system prompt for every new message, so it changes how the model answers. Current agent: <strong>${escapeHtml(getAgent().name)}</strong>.</p></div>${cards}`);
}
function selectAgent(key) { state.settings.currentAgent = key; persistSettings(); openAgentPanel(); updateStatus(); showToast(`Agent: ${getAgent().name}`); }

function openHelpPanel() {
  const modes = MODES.map(m => `<div class="mode-help-card"><h3>${m.icon} ${escapeHtml(m.label)}</h3><p>${escapeHtml(m.short)}</p><p style="margin-top:6px;color:var(--text-muted);">Changes the system prompt sent to the model.</p></div>`).join('');
  const badges = ['free_endpoint','reasoning','coding','research','vision','image','speech','long','fast','free','paid','enterprise','live'].map(c => `<span class="capability-tag ${c}">${escapeHtml(badgeLabel(c))}</span>`).join(' ');
  openPanel('Help / Modes and Badges', `${modes}<div class="mode-help-card"><h3>Model capability badges</h3><p>Badges are inferred from NVIDIA live model metadata and model names. They help you pick models, but the app will not fake pricing or capabilities when NVIDIA does not expose them.</p><div class="capability-bar" style="margin-top:10px;">${badges}</div></div><div class="mode-help-card"><h3>Reasoning / Thinking</h3><p>The app now requests NVIDIA thinking fields for reasoning-capable models when Thinking Display is on. It shows public reasoning only when NVIDIA returns it, such as reasoning, reasoning_content or visible &lt;think&gt; blocks. Stream Diagnostics shows raw chunks/counters so you can tell whether NVIDIA sent reasoning, sent only final text, or sent nothing yet.</p></div><div class="mode-help-card"><h3>Plugins</h3><p>Web Search is real when enabled: the app calls your Worker, the Worker calls Brave/Tavily, then the results are injected into the model prompt. File Reader, Download Buttons, Thinking Display and Long Context also change app behaviour. Code Interpreter is shown as disabled because browser-only GitHub Pages cannot safely run Python.</p></div>`);
}

function openStatusPanel() {
  const model = getCurrentModel();
  const d = state.diag || {};
  const p = state.settings.plugins;
  const freeCount = state.liveModels.filter(m => m.capabilities?.includes('free_endpoint')).length;
  const conn = !!state.settings.apiKey && !!state.liveModels.length;
  const connLabel = conn ? '🟢 Connected' : state.settings.apiKey ? '🟡 Key saved, models not loaded' : '🔴 No API key';
  const routes = Array.isArray(d.workerRoutes) && d.workerRoutes.length ? d.workerRoutes.join(', ') : 'Not probed yet';
  const html = `
    <div class="status-grid-card"><h3>App</h3><p>Version: <code>${escapeHtml(APP_VERSION)}</code><br>Build: <code>${escapeHtml(BUILD_ID)}</code><br>Loaded: ${escapeHtml(state.loadedAt || '—')}<br>Service worker: ${escapeHtml(d.swStatus || 'unknown')}</p></div>
    <div class="status-grid-card"><h3>Connection</h3><p>${escapeHtml(connLabel)}<br>Proxy: ${escapeHtml(state.settings.proxyUrl || 'Direct NVIDIA call')}<br>Worker version: ${escapeHtml(d.workerVersion || 'Not probed')}<br>Worker routes: ${escapeHtml(routes)}</p></div>
    <div class="status-grid-card"><h3>Models</h3><p>Live models: ${state.liveModels.length}<br>Free Endpoint: ${freeCount}<br>Favourites: ${state.favourites.size}<br>Chats: ${state.chats.length}</p></div>
    <div class="status-grid-card"><h3>Current setup</h3><p>Model: ${escapeHtml(model?.name || 'None')}<br>Mode: ${escapeHtml(getMode().label)}<br>Agent: ${escapeHtml(getAgent().name)}<br>Streaming: ${state.settings.stream ? 'On' : 'Off'}<br>Reasoning req: ${state.settings.forceReasoning ? 'On' : 'Off'}<br>Web Search: ${p.webSearch ? 'On (' + escapeHtml(p.webSearchProvider) + ')' : 'Off'}<br>Long Context: ${p.longContext ? 'On' : 'Off'}</p></div>
    <div class="status-grid-card"><h3>Last request</h3><p>Status: ${escapeHtml(String(d.lastStatus || '—'))}<br>Content-type: ${escapeHtml(d.lastContentType || '—')}<br>Stream events: ${escapeHtml(String(d.lastEvents ?? '—'))}<br>Last error: ${d.lastError ? escapeHtml(shortText(d.lastError, 240)) : 'None'}</p></div>
    <div id="diagTestStatus" class="connection-status" style="display:none;"></div>
    <div class="panel-section-label">Tests</div>
    <div class="btn-row">
      <button class="btn btn-secondary" data-action="diag-probe-worker">Probe Worker</button>
      <button class="btn btn-secondary" data-action="diag-test-models">Test NVIDIA models</button>
      <button class="btn btn-secondary" data-action="diag-test-chat">Test chat completion</button>
      <button class="btn btn-secondary" data-action="diag-test-search">Test web search</button>
      <button class="btn btn-secondary" data-action="diag-test-catalog">Test build catalog</button>
    </div>
    <div class="panel-section-label">Maintenance</div>
    <div class="btn-row">
      <button class="btn btn-secondary" data-action="new-chat-close">New chat</button>
      <button class="btn btn-secondary" data-action="export-debug">Export debug logs</button>
      <button class="btn btn-secondary" data-action="export-settings">Export settings</button>
      <button class="btn btn-secondary" data-action="import-settings">Import settings</button>
    </div>
    <div class="btn-row">
      <button class="btn btn-primary" data-action="clear-cache">Clear cache &amp; reload latest</button>
    </div>
    <div class="btn-row">
      <button class="btn btn-danger" data-action="delete-all-chats">Delete all chats</button>
      <button class="btn btn-danger" data-action="clear-key-close">Clear API key</button>
      <button class="btn btn-danger" data-action="clear-all-data">Clear all local data</button>
    </div>`;
  openPanel('Diagnostics & Status', html);
}

function showDiagStatus(text, success) {
  const el = document.getElementById('diagTestStatus');
  if (!el) { showToast(text, success ? 'success' : 'error'); return; }
  el.style.display = 'block';
  el.textContent = text;
  el.className = `connection-status ${success ? 'success' : 'error'}`;
}

async function probeWorker() {
  const base = stripSlash(state.settings.proxyUrl);
  if (!base) { showDiagStatus('No proxy URL set. Add your Cloudflare Worker URL in Settings.', false); return; }
  showDiagStatus('Probing Worker…', true);
  try {
    const res = await fetchWithTimeout(base + '/', { method: 'GET' }, 20000);
    const data = await res.json();
    state.diag.workerRoutes = data.routes || [];
    state.diag.workerVersion = data.version || 'unknown';
    showDiagStatus(`Worker OK. Version ${data.version || 'unknown'}. Routes: ${(data.routes || []).join(', ')}`, true);
    openStatusPanel();
  } catch (err) {
    showDiagStatus(`Worker probe failed: ${friendlyError(err)}`, false);
  }
}

async function diagTestModels() {
  showDiagStatus('Testing /v1/models…', true);
  const n = await refreshModelsFromNvidia(false);
  if (n) { showDiagStatus(`Models OK. Loaded ${n} live models.`, true); openStatusPanel(); }
  else showDiagStatus('Models test failed. Check API key and Worker URL.', false);
}

async function diagTestChat() {
  const model = getCurrentModel();
  if (!model) { showDiagStatus('Select a model first.', false); return; }
  showDiagStatus(`Testing chat completion on ${model.name}…`, true);
  try {
    const res = await fetchWithTimeout(buildApiUrl('/chat/completions'), {
      method: 'POST', headers: apiHeaders(false),
      body: JSON.stringify({ model: model.id, messages: [{ role: 'user', content: 'Reply with the single word: OK' }], max_tokens: 16, stream: false })
    }, 45000);
    state.diag.lastStatus = res.status;
    state.diag.lastContentType = res.headers.get('content-type') || '';
    if (!res.ok) throw new Error(await errorFromResponse(res));
    const data = await res.json();
    const text = extractFullResponse(data) || '(no text field returned)';
    showDiagStatus(`Chat OK (HTTP ${res.status}). Model replied: ${shortText(text, 120)}`, true);
  } catch (err) {
    state.diag.lastError = friendlyError(err);
    showDiagStatus(`Chat test failed: ${friendlyError(err)}`, false);
  }
}

async function diagTestCatalog() {
  showDiagStatus('Testing /v1/build-models…', true);
  const res = await fetchBuildCatalogModels();
  if (res.ok) showDiagStatus(`Build catalog OK. ${res.models.length} models, ${res.freeEndpointCount || 0} Free Endpoint.`, true);
  else showDiagStatus(`Build catalog failed: ${res.message || 'unknown error'}`, false);
}

function exportDebugLogs() {
  const model = getCurrentModel();
  const payload = {
    app: { version: APP_VERSION, build: BUILD_ID, loadedAt: state.loadedAt, userAgent: navigator.userAgent },
    diagnostics: state.diag,
    settingsSummary: {
      proxyUrl: state.settings.proxyUrl, hasApiKey: !!state.settings.apiKey, stream: state.settings.stream,
      forceReasoning: state.settings.forceReasoning, streamDiagnostics: state.settings.streamDiagnostics,
      maxTokens: state.settings.maxTokens, temperature: state.settings.temperature, plugins: { ...state.settings.plugins, webSearchApiKey: state.settings.plugins.webSearchApiKey ? '(set)' : '' }
    },
    models: { total: state.liveModels.length, freeEndpoint: state.liveModels.filter(m => m.capabilities?.includes('free_endpoint')).length, current: model?.id || null },
    lastChatDebug: (state.currentChat?.messages || []).filter(m => m.debug).slice(-1).map(m => m.debug)
  };
  downloadText(`nvidia-ai-debug-${Date.now()}.json`, JSON.stringify(payload, null, 2));
  showDiagStatus('Debug log downloaded (no API key included).', true);
}

function clearAllLocalData() {
  if (!confirm('Clear ALL local data (chats, settings, API key, favourites, cached models)? This cannot be undone.')) return;
  try {
    [SETTINGS_KEY, MODEL_CACHE_KEY, FAV_KEY, CHATS_KEY, CURRENT_CHAT_KEY].forEach(k => localStorage.removeItem(k));
    for (const k of listLegacyKeys()) localStorage.removeItem(k);
  } catch (_) {}
  showToast('Local data cleared. Reloading…');
  setTimeout(() => location.reload(), 600);
}

async function clearCacheAndReload() {
  showDiagStatus('Clearing caches and service worker…', true);
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister()));
    }
    if (window.caches && caches.keys) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
  } catch (_) {}
  const url = new URL(location.href);
  url.searchParams.set('v', Date.now().toString(36));
  location.replace(url.toString());
}


const MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024;
const MAX_PENDING_ATTACHMENTS = 10;

function attachmentLanguageForFile(name) {
  const ext = (String(name || '').split('.').pop() || 'txt').toLowerCase();
  const languageMap = {
    js: 'javascript', jsx: 'javascript', mjs: 'javascript', cjs: 'javascript',
    ts: 'typescript', tsx: 'typescript', py: 'python', md: 'markdown', markdown: 'markdown',
    html: 'html', htm: 'html', css: 'css', scss: 'scss', json: 'json', csv: 'csv', tsv: 'tsv',
    txt: 'text', log: 'text', ps1: 'powershell', bat: 'batch', cmd: 'batch', sh: 'bash',
    sql: 'sql', yml: 'yaml', yaml: 'yaml', toml: 'toml', xml: 'xml', java: 'java',
    c: 'c', cpp: 'cpp', h: 'c', hpp: 'cpp', cs: 'csharp', go: 'go', rs: 'rust',
    php: 'php', rb: 'ruby', swift: 'swift', kt: 'kotlin', env: 'env'
  };
  return languageMap[ext] || ext || 'text';
}

function readFileAsTextPromise(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error(`Could not read ${file?.name || 'file'}`));
    reader.readAsText(file);
  });
}

async function addFilesToPending(fileList) {
  const files = Array.from(fileList || []).filter(Boolean);
  if (!files.length) return;

  if (!state.settings.plugins.fileReader) {
    showToast('File Reader plugin is off. Enable it in Plugins first.', 'error');
    return;
  }

  let added = 0;
  const skipped = [];

  for (const file of files) {
    const name = file.name || 'attachment.txt';

    if (state.pendingAttachments.length >= MAX_PENDING_ATTACHMENTS) {
      skipped.push(`${name} (maximum ${MAX_PENDING_ATTACHMENTS} attachments)`);
      continue;
    }

    if (!isSupportedTextFile(file)) {
      skipped.push(`${name} (unsupported file type)`);
      continue;
    }

    if (file.size > MAX_ATTACHMENT_BYTES) {
      skipped.push(`${name} (over 2 MB)`);
      continue;
    }

    try {
      const content = await readFileAsTextPromise(file);
      state.pendingAttachments.push({
        id: uid('att'),
        name,
        size: file.size,
        type: file.type || 'text/plain',
        language: attachmentLanguageForFile(name),
        content
      });
      added++;
    } catch (err) {
      skipped.push(`${name} (could not read)`);
    }
  }

  renderPendingAttachments();
  updateSendButton();

  if (added) {
    showToast(`Attached ${added} file${added === 1 ? '' : 's'}. Content will be sent privately with your prompt.`);
  }
  if (skipped.length) {
    showToast(`Skipped ${skipped.length} file${skipped.length === 1 ? '' : 's'}: ${skipped.slice(0, 3).join(', ')}${skipped.length > 3 ? '…' : ''}`, 'error');
  }
}

function handleFileSelect(event) {
  const files = event.target.files;
  event.target.value = '';
  addFilesToPending(files);
}

function eventHasFiles(event) {
  return Array.from(event.dataTransfer?.types || []).includes('Files');
}

function setDragActive(active) {
  document.body.classList.toggle('dragging-files', !!active);
  document.querySelector('.input-wrapper')?.classList.toggle('drag-over', !!active);
}

function registerFileDropZone() {
  let dragDepth = 0;

  document.addEventListener('dragenter', event => {
    if (!eventHasFiles(event)) return;
    event.preventDefault();
    dragDepth++;
    setDragActive(true);
  });

  document.addEventListener('dragover', event => {
    if (!eventHasFiles(event)) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
  });

  document.addEventListener('dragleave', event => {
    if (!eventHasFiles(event)) return;
    dragDepth = Math.max(0, dragDepth - 1);
    if (!dragDepth) setDragActive(false);
  });

  document.addEventListener('drop', event => {
    if (!eventHasFiles(event)) return;
    event.preventDefault();
    dragDepth = 0;
    setDragActive(false);
    addFilesToPending(event.dataTransfer?.files);
  });
}


function toggleVoiceInput() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) { showToast('Voice input is not supported in this browser.', 'error'); return; }
  const btn = document.getElementById('voiceBtn');
  if (state.voiceRecognition) { state.voiceRecognition.stop(); state.voiceRecognition = null; btn?.classList.remove('recording'); return; }
  const rec = new SpeechRecognition();
  rec.lang = 'en-GB'; rec.continuous = false; rec.interimResults = true;
  rec.onresult = ev => {
    let text = '';
    for (let i = ev.resultIndex; i < ev.results.length; i++) text += ev.results[i][0].transcript;
    const input = document.getElementById('inputBox'); input.value = (input.value + ' ' + text).trim(); autoResize(input); updateSendButton();
  };
  rec.onend = () => { state.voiceRecognition = null; btn?.classList.remove('recording'); };
  state.voiceRecognition = rec; btn?.classList.add('recording'); rec.start();
}

function exportToPDF() {
  if (!state.currentChat?.messages.length) { showToast('No chat to export.', 'error'); return; }
  const html = `<html><head><title>${escapeHtml(state.currentChat.title)}</title><style>body{font-family:Arial,sans-serif;padding:32px;line-height:1.5}pre{white-space:pre-wrap;background:#f2f2f2;padding:12px;border-radius:8px}.role{font-weight:bold;margin-top:18px}</style></head><body><h1>${escapeHtml(state.currentChat.title)}</h1>${state.currentChat.messages.map(m => `<div class="role">${escapeHtml(m.role)}</div><div>${renderMarkdown(m.role === 'user' ? stripVisibleAttachmentBlocks(m.content || '') : (m.content || ''))}</div>`).join('')}<script>print()<\/script></body></html>`;
  const w = window.open('', '_blank'); if (w) { w.document.write(html); w.document.close(); } else showToast('Popup blocked. Allow popups to export PDF.', 'error');
}
async function shareChat() {
  const text = state.currentChat?.messages.map(m => `${m.role.toUpperCase()}: ${m.role === 'user' ? stripVisibleAttachmentBlocks(m.content || '') : (m.content || '')}`).join('\n\n') || '';
  if (navigator.share) await navigator.share({ title: state.currentChat?.title || 'NVIDIA AI Chat', text }).catch(() => {});
  else { await navigator.clipboard?.writeText(text); showToast('Chat copied'); }
}
function toggleSidebar() {
  const sb = document.getElementById('sidebar');
  if (!sb) return;
  const collapsed = sb.classList.toggle('collapsed');
  document.body.classList.toggle('sidebar-open', !collapsed);
}

function showToast(text, type = 'success') {
  const c = document.getElementById('toastContainer'); if (!c) return;
  const t = document.createElement('div'); t.className = `toast ${type}`; t.innerHTML = `<div class="toast-icon">${type === 'error' ? '⚠️' : '✓'}</div><div class="toast-text">${escapeHtml(text)}</div>`; c.appendChild(t); setTimeout(() => t.remove(), 3500);
}

function safeRun(label, fn) {
  try { fn(); }
  catch (err) {
    console.error(`[NVIDIA AI] ${label} failed:`, err);
    state.diag.lastError = `${label}: ${err && err.message ? err.message : err}`;
  }
}

function renderAll() {
  safeRun('renderModeNav', renderModeNav);
  safeRun('renderChatHistory', renderChatHistory);
  safeRun('renderMessages', renderMessages);
  safeRun('renderModelList', renderModelList);
  safeRun('updateModeIndicator', updateModeIndicator);
  safeRun('updateSelectedModelLabel', updateSelectedModelLabel);
  safeRun('updateStatus', updateStatus);
  safeRun('updateSendButton', updateSendButton);
}

function isMobile() { return window.matchMedia('(max-width: 768px)').matches; }
function collapseSidebar() { document.getElementById('sidebar')?.classList.add('collapsed'); document.body.classList.remove('sidebar-open'); }
function maybeCollapseSidebarMobile() { if (isMobile()) collapseSidebar(); }

async function diagTestSearch() {
  const p = state.settings.plugins;
  if (!p.webSearch) { showDiagStatus('Turn Web Search on in Plugins first.', false); return; }
  if (!p.webSearchApiKey && p.webSearchProvider !== 'worker-secret') { showDiagStatus('Add a Brave/Tavily key or use the Worker-secret option.', false); return; }
  showDiagStatus('Testing web search…', true);
  try {
    const results = await runWebSearch('NVIDIA latest AI models');
    showDiagStatus(`Web search OK. ${results.length} result(s). Top: ${results[0]?.title || '—'}`, true);
  } catch (err) {
    showDiagStatus(`Web search failed: ${friendlyError(err)}`, false);
  }
}

// ---- One delegated click router for the whole app (no inline onclick) ----
const CLICK_ACTIONS = {
  'new-chat': () => newChat(),
  'new-chat-close': () => { newChat(); closePanel(); },
  'plugins': () => openPluginsPanel(),
  'agents': () => openAgentPanel(),
  'help': () => openHelpPanel(),
  'status': () => openStatusPanel(),
  'toggle-sidebar': () => toggleSidebar(),
  'close-sidebar': () => collapseSidebar(),
  'export-pdf': () => exportToPDF(),
  'share': () => shareChat(),
  'open-settings': () => openSettings(),
  'close-settings': () => closeSettings(),
  'save-settings': () => saveSettings(),
  'test-connection': () => testConnection(),
  'refresh-models': () => refreshModelsFromNvidia(true),
  'refresh-models-settings': () => refreshModelsFromSettings(),
  'clear-key': () => clearApiKey(),
  'clear-key-close': () => { clearApiKey(); closePanel(); },
  'close-panel': () => closePanel(),
  'cancel-edit': () => cancelEdit(),
  'toggle-model-dropdown': () => toggleModelDropdown(),
  'attach': () => document.getElementById('fileInput')?.click(),
  'voice': () => toggleVoiceInput(),
  'send': () => sendMessage(),
  'model-tab': (el) => switchModelTab(el.dataset.tab, el),
  'set-mode': (el) => { setMode(el.dataset.mode); maybeCollapseSidebarMobile(); },
  'select-chat': (el) => { selectChat(el.dataset.chatId); maybeCollapseSidebarMobile(); },
  'pin-chat': (el) => pinChat(el.dataset.chatId),
  'rename-chat': (el) => renameChat(el.dataset.chatId),
  'delete-chat': (el) => deleteChat(el.dataset.chatId),
  'edit-message': (el) => editUserMessage(el.dataset.id),
  'copy-message': (el) => copyMessage(el.dataset.id),
  'regenerate': (el) => regenerateResponse(el.dataset.id),
  'download-message': (el) => downloadMessage(el.dataset.id),
  'copy-code': (el) => copyEncodedCode(el.dataset.payload),
  'download-code': (el) => downloadEncodedCode(el.dataset.payload),
  'download-all-files': (el) => downloadAllEncodedFiles(el.dataset.payload),
  'download-zip': (el) => downloadFilesAsZip(el.dataset.payload),
  'copy-all-files': (el) => copyAllEncodedFiles(el.dataset.payload),
  'remove-attachment': (el) => removePendingAttachment(el.dataset.attId),
  'toggle-fav': (el, ev) => toggleFavourite(el.dataset.modelId, ev),
  'select-model': (el) => selectModel(el.dataset.modelId),
  'toggle-plugin': (el) => togglePlugin(el.dataset.key),
  'test-web-search': () => testWebSearchPlugin(),
  'select-agent': (el) => selectAgent(el.dataset.agent),
  'diag-probe-worker': () => probeWorker(),
  'diag-test-models': () => diagTestModels(),
  'diag-test-chat': () => diagTestChat(),
  'diag-test-search': () => diagTestSearch(),
  'diag-test-catalog': () => diagTestCatalog(),
  'export-debug': () => exportDebugLogs(),
  'export-settings': () => exportSettings(),
  'import-settings': () => importSettings(),
  'clear-cache': () => clearCacheAndReload(),
  'delete-all-chats': () => { clearAllChats(); closePanel(); },
  'clear-all-data': () => clearAllLocalData(),
};

function registerDelegatedEvents() {
  document.addEventListener('click', (event) => {
    const el = event.target.closest('[data-action]');
    if (!el) return;
    const action = el.getAttribute('data-action');
    const handler = CLICK_ACTIONS[action];
    if (!handler) return;
    event.preventDefault();
    event.stopPropagation();
    safeRun(`action:${action}`, () => handler(el, event));
  });

  document.addEventListener('change', (event) => {
    const el = event.target.closest('[data-action]');
    if (!el) return;
    const action = el.getAttribute('data-action');
    if (action === 'plugin-set') setPluginSetting(el.dataset.key, el.value);
    else if (action === 'file-select') handleFileSelect(event);
  });

  document.addEventListener('input', (event) => {
    const el = event.target.closest('[data-action]');
    if (!el) return;
    const action = el.getAttribute('data-action');
    if (action === 'plugin-set-input') setPluginSetting(el.dataset.key, el.value, false);
    else if (action === 'model-search') renderModelList();
    else if (action === 'chat-search') { state.chatSearch = el.value; renderChatHistory(); }
    else if (action === 'temp-slider') { const out = document.getElementById('tempValue'); if (out) out.textContent = el.value; }
  });
}

function bindInputHandlers() {
  const input = document.getElementById('inputBox');
  if (input) {
    input.addEventListener('keydown', handleKeydown);
    input.addEventListener('input', () => { autoResize(input); updateSendButton(); });
  }
}

function registerShortcuts() {
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); newChat(); }
    if (e.key === 'Escape') { closeSettings(); closePanel(); document.getElementById('modelDropdown')?.classList.remove('open'); }
  });
  document.addEventListener('click', e => {
    const dd = document.getElementById('modelDropdown');
    if (dd && !e.target.closest('.model-selector')) dd.classList.remove('open');
  });
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) { state.diag.swStatus = 'unsupported'; return; }
  navigator.serviceWorker.register('sw.js').then(reg => {
    state.diag.swStatus = 'registered';
    reg.addEventListener('updatefound', () => {
      const sw = reg.installing;
      if (!sw) return;
      sw.addEventListener('statechange', () => {
        if (sw.state === 'installed' && navigator.serviceWorker.controller) {
          state.diag.swStatus = 'update available';
          showToast('A new version is ready. Use Clear cache & reload latest to update.');
        }
      });
    });
  }).catch(() => { state.diag.swStatus = 'registration failed'; });
}

function surfaceGlobalErrors() {
  window.addEventListener('error', (e) => {
    state.diag.lastError = e?.message || 'Unknown error';
    console.error('[NVIDIA AI] error:', e?.error || e?.message);
  });
  window.addEventListener('unhandledrejection', (e) => {
    state.diag.lastError = e?.reason?.message || String(e?.reason || 'Unhandled rejection');
    console.error('[NVIDIA AI] unhandled promise rejection:', e?.reason);
  });
}

function init() {
  surfaceGlobalErrors();
  loadState();
  if (!state.currentChat) state.currentChat = createChat(false);
  if (!state.chats.includes(state.currentChat)) state.chats.unshift(state.currentChat);
  state.loadedAt = new Date().toLocaleString();
  const verEl = document.getElementById('appVersionLabel');
  if (verEl) verEl.textContent = `v${APP_VERSION}`;
  registerShortcuts();
  registerDelegatedEvents();
  bindInputHandlers();
  registerFileDropZone();
  if (isMobile()) collapseSidebar();
  renderAll();
  registerServiceWorker();
}

// Kept on window for console/debugging convenience and maximum backward safety.
// The app itself is wired entirely through data-action delegation above.
Object.assign(window, {
  newChat, selectChat, deleteChat, clearAllChats, pinChat, renameChat,
  openPluginsPanel, openAgentPanel, openHelpPanel, openStatusPanel, closePanel,
  setMode, selectAgent, togglePlugin, setPluginSetting, testWebSearchPlugin,
  editUserMessage, regenerateResponse, copyMessage, downloadMessage,
  copyEncodedCode, downloadEncodedCode, downloadAllEncodedFiles, downloadFilesAsZip, copyAllEncodedFiles,
  toggleSidebar, handleFileSelect, addFilesToPending, removePendingAttachment, clearPendingAttachments,
  refreshModelsFromNvidia, switchModelTab, selectModel, toggleFavourite,
  openSettings, closeSettings, saveSettings, testConnection, clearApiKey,
  exportSettings, importSettings, exportDebugLogs, clearCacheAndReload, clearAllLocalData,
  probeWorker, diagTestModels, diagTestChat, diagTestSearch, diagTestCatalog,
});

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
