/* NVIDIA AI Desktop - GitHub Pages / Cloudflare Worker build */
const NVIDIA_DIRECT_BASE = 'https://integrate.api.nvidia.com/v1';
const SETTINGS_KEY = 'nvidia_ai_desktop_settings_v8_plugins';
const MODEL_CACHE_KEY = 'nvidia_ai_desktop_live_models_v8_plugins';
const FAV_KEY = 'nvidia_ai_desktop_favourites_v8_plugins';
const CHATS_KEY = 'nvidia_ai_desktop_chats_v8_plugins';
const CURRENT_CHAT_KEY = 'nvidia_ai_desktop_current_chat_v8_plugins';


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
  pendingAttachments: []
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

function loadState() {
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
    <div class="nav-item ${state.settings.currentMode === m.key ? 'active' : ''}" onclick="setMode('${m.key}')" title="${escapeAttr(m.short)}">
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
  if (!state.chats.length) { el.innerHTML = ''; return; }
  el.innerHTML = state.chats.slice(0, 60).map(chat => `
    <div class="chat-history-item ${state.currentChat?.id === chat.id ? 'active' : ''}" onclick="selectChat('${chat.id}')" title="${escapeAttr(chat.title || 'New Chat')}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
      <span class="chat-history-title">${escapeHtml(chat.title || 'New Chat')}</span>
      <button class="chat-delete-btn" onclick="deleteChat('${chat.id}', event)" title="Delete chat" aria-label="Delete chat">×</button>
    </div>`).join('');
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
      <div class="welcome-card" onclick="openSettings()"><div class="welcome-card-title">1. Settings</div><div class="welcome-card-desc">Add API key and Worker URL.</div></div>
      <div class="welcome-card" onclick="refreshModelsFromNvidia(true)"><div class="welcome-card-title">2. Refresh Models</div><div class="welcome-card-desc">Load live NVIDIA models.</div></div>
      <div class="welcome-card" onclick="openHelpPanel()"><div class="welcome-card-title">3. Help</div><div class="welcome-card-desc">See what modes and badges do.</div></div>
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
  const attachments = isUser ? attachmentSummaryHtml(m.attachments || []) : '';
  const thinking = m.thinking ? `<div class="thinking-block expanded"><div class="thinking-header"><span>🧠</span><div class="thinking-title">Thinking</div></div><div class="thinking-body" style="display:block;">${escapeHtml(m.thinking)}</div></div>` : '';
  return `<div class="message" id="msg_${escapeAttr(m.id)}">
    <div class="message-avatar ${isUser ? 'user' : 'assistant'}">${escapeHtml(avatar)}</div>
    <div class="message-content">
      <div class="message-header"><div class="message-author">${escapeHtml(author)}</div><div class="message-time">${escapeHtml(m.time || '')}</div>${m.model ? `<div class="message-time">${escapeHtml(m.model)}</div>` : ''}</div>
      <div class="message-body" id="body_${escapeAttr(m.id)}">${thinking}${content}${attachments}</div>
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
  if (m.role === 'user') {
    return `<div class="message-actions">
      <button class="message-action" onclick="editUserMessage('${escapeJsString(m.id)}')">Edit</button>
      <button class="message-action" onclick="copyMessage('${escapeJsString(m.id)}')">Copy</button>
    </div>`;
  }
  return `<div class="message-actions">
    <button class="message-action" onclick="regenerateResponse('${escapeJsString(m.id)}')">Regenerate</button>
    <button class="message-action" onclick="copyMessage('${escapeJsString(m.id)}')">Copy</button>
    <button class="message-action" onclick="downloadMessage('${escapeJsString(m.id)}')">Download</button>
  </div>`;
}

function renderMarkdown(text) {
  let src = String(text || '');
  const codeBlocks = [];
  src = src.replace(/```([^\n`]*)\n([\s\S]*?)```/g, (_, langRaw, codeRaw) => {
    const lang = (langRaw || '').trim() || 'text';
    let code = codeRaw.replace(/\n$/, '');
    let filename = '';
    const firstLine = code.split(/\r?\n/)[0] || '';
    const match = firstLine.match(/^\s*(?:filename|file|path)\s*:\s*(.+?)\s*$/i);
    if (match) {
      filename = match[1].trim();
      code = code.split(/\r?\n/).slice(1).join('\n');
    } else {
      filename = inferFilename(lang);
    }
    const id = uid('code');
    codeBlocks.push({ id, lang, code, filename });
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

function inferFilename(lang) {
  const ext = { javascript: 'js', js: 'js', typescript: 'ts', ts: 'ts', python: 'py', py: 'py', html: 'html', css: 'css', json: 'json', markdown: 'md', md: 'md', bash: 'sh', shell: 'sh', powershell: 'ps1', ps1: 'ps1', sql: 'sql', csv: 'csv', text: 'txt' }[String(lang || '').toLowerCase()] || 'txt';
  return `response.${ext}`;
}

function codeBlockHtml(block) {
  if (!block) return '';
  const encoded = btoa(unescape(encodeURIComponent(JSON.stringify({ code: block.code, filename: block.filename }))));
  return `<div class="code-block-wrapper">
    <div class="code-block-header"><div><span class="code-lang">${escapeHtml(block.lang)}</span><span class="code-download-name">${escapeHtml(block.filename)}</span></div><div class="code-actions"><button class="code-action-btn" onclick="copyEncodedCode('${encoded}')">Copy</button>${state.settings.plugins.downloadButtons ? `<button class="code-action-btn" onclick="downloadEncodedCode('${encoded}')">Download</button>` : ''}</div></div>
    <pre><code>${escapeHtml(block.code)}</code></pre>
  </div>`;
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
  const data = JSON.parse(decodeURIComponent(escape(atob(encoded))));
  navigator.clipboard?.writeText(data.code || '');
  showToast('Code copied');
}
function downloadEncodedCode(encoded) {
  const data = JSON.parse(decodeURIComponent(escape(atob(encoded))));
  downloadText(data.filename || 'response.txt', data.code || '');
}
function downloadText(filename, text) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
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
      <button class="attachment-remove" type="button" onclick="removePendingAttachment('${escapeJsString(att.id)}')" title="Remove attachment">×</button>
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
    showToast('Request failed', 'error');
  } finally {
    const msg = getMessage(assistantMsg.id);
    if (msg) msg.loading = false;
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
  if (startMsg) { startMsg.status = 'Thinking'; updateAssistantDom(startMsg); }
  const webContext = await maybeBuildWebSearchContext(assistantId);
  const payload = {
    model: model.id,
    messages: buildConversationMessages(webContext),
    temperature: Number(state.settings.temperature || 0.7),
    max_tokens: Number(state.settings.maxTokens || 2048),
    stream: !!state.settings.stream
  };
  const responseMsg = getMessage(assistantId);
  if (responseMsg) { responseMsg.status = payload.stream ? 'Streaming response' : 'Waiting for response'; updateAssistantDom(responseMsg); }
  const response = await fetchWithTimeout(buildApiUrl('/chat/completions'), {
    method: 'POST', headers: apiHeaders(payload.stream), body: JSON.stringify(payload)
  }, 120000);
  if (!response.ok) throw new Error(await errorFromResponse(response));
  const contentType = response.headers.get('content-type') || '';
  if (payload.stream && response.body && /text\/event-stream|application\/x-ndjson|text\/plain/i.test(contentType + response.headers.get('transfer-encoding'))) {
    await readStream(response, assistantId);
  } else if (payload.stream && response.body) {
    // Try streaming anyway; NVIDIA often returns SSE even when content-type is changed by proxies.
    const streamed = await readStream(response, assistantId, true);
    if (!streamed) await readJsonResponse(response, assistantId);
  } else {
    await readJsonResponse(response, assistantId);
  }
}

async function errorFromResponse(response) {
  const text = await response.text().catch(() => '');
  try { const json = JSON.parse(text); return `HTTP ${response.status}: ${json.error?.message || json.error || text}`; }
  catch { return `HTTP ${response.status}: ${text || response.statusText}`; }
}

async function readJsonResponse(response, assistantId) {
  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content || data?.choices?.[0]?.text || data?.output_text || JSON.stringify(data, null, 2);
  const msg = getMessage(assistantId); if (!msg) return;
  appendAssistantVisibleOrReasoning(msg, content);
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
    if (!delta.content && !delta.thinking) return false;
    const msg = getMessage(assistantId);
    if (!msg) return false;
    if (delta.thinking && state.settings.showThinking) appendPublicReasoning(msg, delta.thinking);
    if (delta.content) appendAssistantVisibleOrReasoning(msg, delta.content);
    if (delta.content || delta.thinking) msg.status = delta.thinking && !delta.content ? 'Receiving public reasoning' : 'Writing response';
    updateAssistantDom(msg);
    return true;
  };

  const tryJsonPayload = (payload) => {
    const clean = String(payload || '').trim();
    if (!clean || clean === '[DONE]' || clean.startsWith('event:')) return false;
    try {
      const json = JSON.parse(clean);
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
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(part => {
    if (typeof part === 'string') return part;
    return part.text || part.content || part.value || '';
  }).join('');
  if (typeof value === 'object') return value.text || value.content || value.value || '';
  return String(value);
}

function extractFullResponse(json) {
  const choice = json?.choices?.[0] || {};
  return contentToString(choice?.message?.content) || contentToString(choice?.text) || contentToString(json?.output_text) || contentToString(json?.content);
}

function extractFullReasoning(json) {
  const choice = json?.choices?.[0] || {};
  const msg = choice?.message || choice || {};
  return contentToString(msg.reasoning_content) || contentToString(msg.reasoning) || contentToString(msg.thinking) || contentToString(msg.thought) || contentToString(json?.reasoning_content) || contentToString(json?.reasoning);
}

function extractDelta(json) {
  const choice = json?.choices?.[0] || {};
  const delta = choice.delta || choice.message || choice;
  return {
    content: contentToString(delta.content) || contentToString(delta.text) || contentToString(json.output_text),
    thinking: contentToString(delta.reasoning_content) || contentToString(delta.reasoning) || contentToString(delta.thinking) || contentToString(delta.thought) || contentToString(json.reasoning_content) || contentToString(json.reasoning)
  };
}

function updateAssistantDom(msg) {
  const body = document.getElementById(`body_${msg.id}`);
  if (body) {
    const thinking = (state.settings.showThinking && msg.thinking) ? `<div class="thinking-block expanded"><div class="thinking-header"><span>🧠</span><div class="thinking-title">Thinking</div></div><div class="thinking-body" style="display:block;">${escapeHtml(msg.thinking)}</div></div>` : '';
    const progress = msg.loading && !msg.content ? thinkingHtml(msg.status || 'Thinking') : '';
    body.innerHTML = thinking + (msg.content ? renderMarkdown(msg.content) : progress);
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
      <button class="model-star ${state.favourites.has(m.id) ? 'active' : ''}" onclick="toggleFavourite('${escapeJsString(m.id)}', event)" title="Favourite">${state.favourites.has(m.id) ? '★' : '☆'}</button>
      <div class="model-item-info" onclick="selectModel('${escapeJsString(m.id)}')">
        <div class="model-item-name">${escapeHtml(m.name)}${m.catalogOnly ? ' <span class="capability-tag catalog_only">Catalog only</span>' : ''}</div>
        <div class="model-item-desc">${escapeHtml(m.desc || 'Live NVIDIA model')}</div>
        <div class="model-item-desc"><code>${escapeHtml(m.id)}</code></div>
        ${capabilityHtml(m)}
      </div>
    </div>`).join('');
  setModelMeta(`${models.length} shown • ${state.liveModels.length} live models • ${state.favourites.size} favourites`);
}

function switchModelTab(tab, event) {
  state.modelTab = tab;
  document.querySelectorAll('.model-tab').forEach(b => b.classList.remove('active'));
  if (event?.currentTarget) event.currentTarget.classList.add('active');
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
  state.settings.theme = document.getElementById('themeSelect').value;
  state.settings.customPrompt = document.getElementById('customPromptInput').value;
  persistSettings(); applyTheme(); updateStatus(); updateSendButton(); renderMessages();
  showConnectionStatus('Saved settings.', true);
  showToast('Settings saved');
}
function clearApiKey() { state.settings.apiKey = ''; persistSettings(); openSettings(); updateStatus(); updateSendButton(); showToast('API key cleared'); }
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
    panel.innerHTML = '<div class="panel-header"><div class="panel-title" id="panelTitle">Panel</div><button class="panel-close" onclick="closePanel()">×</button></div><div class="panel-body" id="panelBody"></div>';
    document.body.appendChild(panel);
  }
  if (!document.getElementById('panelTitle')) {
    panel.innerHTML = '<div class="panel-header"><div class="panel-title" id="panelTitle">Panel</div><button class="panel-close" onclick="closePanel()">×</button></div><div class="panel-body" id="panelBody"></div>';
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
    <button class="toggle-switch ${enabled ? 'on' : ''}" ${disabled ? 'disabled' : ''} onclick="togglePlugin('${key}')" title="${boolText(enabled)}"></button>
  </div>`;
}

function openPluginsPanel() {
  const p = state.settings.plugins;
  const html = `
    <div class="mode-help-card"><h3>Real plugins</h3><p>These toggles now change what the app does. Web Search uses your Cloudflare Worker plus a search provider, then injects results into the NVIDIA model prompt.</p></div>
    ${pluginToggleHtml('webSearch', '🌐', 'Web Search', 'Uses Brave Search/Tavily through your Worker before asking the model.')}
    <div class="plugin-settings ${p.webSearch ? '' : 'muted'}">
      <label class="setting-label">Search provider</label>
      <select class="setting-select" onchange="setPluginSetting('webSearchProvider', this.value)">
        <option value="brave" ${p.webSearchProvider === 'brave' ? 'selected' : ''}>Brave Search API - recommended</option>
        <option value="tavily" ${p.webSearchProvider === 'tavily' ? 'selected' : ''}>Tavily Search API - LLM/RAG focused</option>
        <option value="worker-secret" ${p.webSearchProvider === 'worker-secret' ? 'selected' : ''}>Use Worker secret BRAVE_SEARCH_API_KEY</option>
      </select>
      <label class="setting-label" style="margin-top:10px;">Search API key</label>
      <input class="setting-input" type="password" value="${escapeAttr(p.webSearchApiKey || '')}" placeholder="Brave or Tavily API key" autocomplete="off" oninput="setPluginSetting('webSearchApiKey', this.value, false)">
      <div class="setting-desc">Recommended: Brave Search API. DuckDuckGo is not included because its free Instant Answer API is not a full web search results API.</div>
      <div class="form-row plugin-form-row">
        <div><label class="setting-label">Results</label><input class="setting-input" type="number" min="1" max="10" value="${Number(p.webSearchResults || 6)}" onchange="setPluginSetting('webSearchResults', this.value)"></div>
        <div><label class="setting-label">Behaviour</label><select class="setting-select" onchange="setPluginSetting('webSearchMode', this.value)"><option value="auto" ${p.webSearchMode === 'auto' ? 'selected' : ''}>Auto-detect current queries</option><option value="always" ${p.webSearchMode === 'always' ? 'selected' : ''}>Search every prompt</option></select></div>
      </div>
      <div class="btn-row" style="margin-top:10px;"><button class="btn btn-secondary" onclick="testWebSearchPlugin()">Test Web Search</button></div>
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
  const cards = AGENTS.map(a => `<div class="agent-card ${state.settings.currentAgent === a.key ? 'selected' : ''}" onclick="selectAgent('${a.key}')">
    <div class="agent-header"><div class="agent-avatar">${a.emoji}</div><div><div class="agent-name">${escapeHtml(a.name)}</div><div class="agent-role">${escapeHtml(a.role)}</div></div></div>
    <div class="agent-desc">${escapeHtml(a.prompt || 'No extra prompt. Balanced default behaviour.')}</div>
  </div>`).join('');
  openPanel('Agent Swarm', `<div class="mode-help-card"><h3>Agent Swarm is active</h3><p>Pick one agent below. The selected agent is added to the system prompt for every new message, so it changes how the model answers. Current agent: <strong>${escapeHtml(getAgent().name)}</strong>.</p></div>${cards}`);
}
function selectAgent(key) { state.settings.currentAgent = key; persistSettings(); openAgentPanel(); updateStatus(); showToast(`Agent: ${getAgent().name}`); }

function openHelpPanel() {
  const modes = MODES.map(m => `<div class="mode-help-card"><h3>${m.icon} ${escapeHtml(m.label)}</h3><p>${escapeHtml(m.short)}</p><p style="margin-top:6px;color:var(--text-muted);">Changes the system prompt sent to the model.</p></div>`).join('');
  const badges = ['free_endpoint','reasoning','coding','research','vision','image','speech','long','fast','free','paid','enterprise','live'].map(c => `<span class="capability-tag ${c}">${escapeHtml(badgeLabel(c))}</span>`).join(' ');
  openPanel('Help / Modes and Badges', `${modes}<div class="mode-help-card"><h3>Model capability badges</h3><p>Badges are inferred from NVIDIA live model metadata and model names. They help you pick models, but the app will not fake pricing or capabilities when NVIDIA does not expose them.</p><div class="capability-bar" style="margin-top:10px;">${badges}</div></div><div class="mode-help-card"><h3>Reasoning / Thinking</h3><p>The app shows public reasoning only when the selected model/provider actually returns it, such as reasoning_content fields or visible &lt;think&gt; blocks. It cannot force hidden private chain-of-thought from models that do not expose it. If no reasoning trace is returned, it shows normal Thinking… progress and the final answer.</p></div><div class="mode-help-card"><h3>Plugins</h3><p>Web Search is real when enabled: the app calls your Worker, the Worker calls Brave/Tavily, then the results are injected into the model prompt. File Reader, Download Buttons, Thinking Display and Long Context also change app behaviour. Code Interpreter is shown as disabled because browser-only GitHub Pages cannot safely run Python.</p></div>`);
}

function openStatusPanel() {
  const model = getCurrentModel();
  openPanel('Account / App Status', `<div class="status-grid-card"><h3>Connection</h3><p>${state.settings.apiKey ? 'API key saved locally.' : 'No API key saved.'}<br>Proxy: ${escapeHtml(state.settings.proxyUrl || 'Direct NVIDIA call')}<br>Live models: ${state.liveModels.length}<br>Favorites: ${state.favourites.size}<br>Chats: ${state.chats.length}</p></div><div class="status-grid-card"><h3>Current setup</h3><p>Model: ${escapeHtml(model?.name || 'None')}<br>Mode: ${escapeHtml(getMode().label)}<br>Agent: ${escapeHtml(getAgent().name)}<br>Streaming: ${state.settings.stream ? 'On' : 'Off'}<br>Web Search: ${state.settings.plugins.webSearch ? 'On' : 'Off'}<br>Long Context: ${state.settings.plugins.longContext ? 'On' : 'Off'}</p></div><div class="btn-row"><button class="btn btn-secondary" onclick="testConnection()">Test Connection</button><button class="btn btn-secondary" onclick="refreshModelsFromNvidia(true)">Refresh Models</button><button class="btn btn-secondary" onclick="newChat(); closePanel();">New Chat</button><button class="btn btn-danger" onclick="clearAllChats(); closePanel();">Delete All Chats</button><button class="btn btn-danger" onclick="clearApiKey(); closePanel();">Clear API Key</button></div>`);
}


function handleFileSelect(event) {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;
  if (!state.settings.plugins.fileReader) { showToast('File Reader plugin is off. Enable it in Plugins first.', 'error'); return; }
  if (!isSupportedTextFile(file)) { showToast('This app currently reads text/code files only. PDFs/images need a separate parser or vision flow.', 'error'); return; }
  if (file.size > 2 * 1024 * 1024) { showToast('File is over 2 MB. Split it or upload a smaller text file.', 'error'); return; }

  const reader = new FileReader();
  reader.onload = () => {
    const name = file.name || 'attachment.txt';
    const ext = (name.split('.').pop() || 'txt').toLowerCase();
    const languageMap = { js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript', py: 'python', md: 'markdown', html: 'html', css: 'css', json: 'json', csv: 'csv', txt: 'text', ps1: 'powershell', sh: 'bash', sql: 'sql', yml: 'yaml', yaml: 'yaml' };
    state.pendingAttachments.push({
      id: uid('att'),
      name,
      size: file.size,
      type: file.type || 'text/plain',
      language: languageMap[ext] || ext || 'text',
      content: String(reader.result || '')
    });
    renderPendingAttachments();
    updateSendButton();
    showToast(`Attached ${name}. It will be sent privately with your prompt, not pasted into chat.`);
  };
  reader.onerror = () => showToast(`Could not read ${file.name}`, 'error');
  reader.readAsText(file);
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
function toggleSidebar() { document.getElementById('sidebar')?.classList.toggle('collapsed'); }

function showToast(text, type = 'success') {
  const c = document.getElementById('toastContainer'); if (!c) return;
  const t = document.createElement('div'); t.className = `toast ${type}`; t.innerHTML = `<div class="toast-icon">${type === 'error' ? '⚠️' : '✓'}</div><div class="toast-text">${escapeHtml(text)}</div>`; c.appendChild(t); setTimeout(() => t.remove(), 3500);
}

function renderAll() {
  renderModeNav(); renderChatHistory(); renderMessages(); renderModelList(); updateModeIndicator(); updateSelectedModelLabel(); updateStatus(); updateSendButton();
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

function init() {
  loadState();
  if (!state.currentChat) state.currentChat = createChat(false);
  if (!state.chats.includes(state.currentChat)) state.chats.unshift(state.currentChat);
  registerShortcuts(); renderAll();
  const statusCard = document.getElementById('statusCard');
  if (statusCard) statusCard.addEventListener('click', (event) => { event.preventDefault(); openStatusPanel(); });
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
}


// Explicitly expose UI actions for inline onclick handlers and older browser/cache edge cases.
Object.assign(window, {
  openPanel,
  closePanel,
  openPluginsPanel,
  openAgentPanel,
  openHelpPanel,
  openStatusPanel,
  selectAgent,
  setMode,
  togglePlugin,
  setPluginSetting,
  testWebSearchPlugin,
  deleteChat,
  clearAllChats,
  editUserMessage,
  regenerateResponse,
  copyMessage,
  downloadMessage,
  toggleSidebar,
  newChat,
});

document.addEventListener('click', (event) => {
  const item = event.target.closest('[data-action]');
  if (!item) return;
  event.preventDefault();
  const action = item.getAttribute('data-action');
  if (action === 'plugins') openPluginsPanel();
  if (action === 'agents') openAgentPanel();
  if (action === 'help') openHelpPanel();
});

window.addEventListener('load', init);
