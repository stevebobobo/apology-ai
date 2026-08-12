/* ==========================================================================
   Apology AI - Application Logic & API Manager
   ========================================================================== */

let selectedTone = '無比真誠感人';
let currentConfig = {
  provider: 'demo', // 'demo', 'gemini', 'openai'
  apiKey: ''
};

// Initialize app on load
document.addEventListener('DOMContentLoaded', () => {
  setupToneSelection();
  loadSavedConfig();
});

// Setup tone grid card click handlers
function setupToneSelection() {
  const toneCards = document.querySelectorAll('.tone-card');
  toneCards.forEach(card => {
    card.addEventListener('click', () => {
      toneCards.forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      selectedTone = card.getAttribute('data-tone');
    });
  });
}

// Quick Scenario Fill
function setScenario(text) {
  const incidentInput = document.getElementById('incidentInput');
  incidentInput.value = text;
  incidentInput.focus();
}

// API Config Modal Handlers
function openApiKeyModal() {
  document.getElementById('apiModal').classList.add('active');
  toggleApiKeyFields();
  const input = document.getElementById('userApiKeyInput');
  if (input) {
    setTimeout(() => input.focus(), 150);
  }
}

function closeApiKeyModal() {
  document.getElementById('apiModal').classList.remove('active');
}

// Helper: Discover available Gemini model dynamically via ListModels API
async function discoverGeminiModel(apiKey) {
  const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
  const res = await fetch(listUrl);
  const data = await res.json();

  if (!res.ok || data.error) {
    const errMsg = data.error?.message || `HTTP ${res.status}`;
    throw new Error(errMsg);
  }

  if (data.models && data.models.length > 0) {
    // Priority: find flash model, then any generateContent model
    const flashModel = data.models.find(m => m.name.includes('flash') && m.supportedGenerationMethods?.includes('generateContent'));
    if (flashModel) return flashModel.name; // returns e.g. "models/gemini-1.5-flash"

    const genModel = data.models.find(m => m.supportedGenerationMethods?.includes('generateContent'));
    if (genModel) return genModel.name;
  }

  return 'models/gemini-1.5-flash';
}

// Test API Key Connection directly
async function testApiKeyConnection() {
  const provider = document.getElementById('apiProviderSelect').value;
  const apiKey = document.getElementById('userApiKeyInput').value.trim();
  const statusDiv = document.getElementById('testApiStatus');

  if (!apiKey) {
    statusDiv.style.display = 'block';
    statusDiv.style.background = 'rgba(244, 63, 94, 0.15)';
    statusDiv.style.color = '#f43f5e';
    statusDiv.style.border = '1px solid rgba(244, 63, 94, 0.3)';
    statusDiv.innerHTML = '⚠️ 請先輸入 API Key 後再點擊測試！';
    return;
  }

  statusDiv.style.display = 'block';
  statusDiv.style.background = 'rgba(99, 102, 241, 0.15)';
  statusDiv.style.color = '#a5b4fc';
  statusDiv.style.border = '1px solid rgba(99, 102, 241, 0.3)';
  statusDiv.innerHTML = '⏳ 正在向 API 伺服器發送測試與模型偵測...';

  try {
    if (provider === 'gemini') {
      const modelName = await discoverGeminiModel(apiKey);
      const url = `https://generativelanguage.googleapis.com/v1beta/${modelName}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: "ping" }] }] })
      });
      const data = await res.json();
      if (res.ok && data.candidates) {
        statusDiv.style.background = 'rgba(16, 185, 129, 0.15)';
        statusDiv.style.color = '#10b981';
        statusDiv.style.border = '1px solid rgba(16, 185, 129, 0.3)';
        statusDiv.innerHTML = `✅ <b>驗證成功！</b> 已匹配模型 <code>${modelName}</code>，API 運作完全正常。`;
      } else {
        const errDetail = data.error?.message || `HTTP ${res.status}`;
        throw new Error(errDetail);
      }
    } else if (provider === 'openai') {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: 'ping' }]
        })
      });
      const data = await res.json();
      if (res.ok && data.choices) {
        statusDiv.style.background = 'rgba(16, 185, 129, 0.15)';
        statusDiv.style.color = '#10b981';
        statusDiv.style.border = '1px solid rgba(16, 185, 129, 0.3)';
        statusDiv.innerHTML = '✅ <b>驗證成功！</b> 此 OpenAI API Key 運作完全正常。';
      } else {
        const errDetail = data.error?.message || `HTTP ${res.status}`;
        throw new Error(errDetail);
      }
    }
  } catch (err) {
    statusDiv.style.background = 'rgba(244, 63, 94, 0.15)';
    statusDiv.style.color = '#f43f5e';
    statusDiv.style.border = '1px solid rgba(244, 63, 94, 0.3)';
    statusDiv.innerHTML = `❌ <b>驗證失敗：</b> ${err.message}`;
  }
}

function saveApiKeyConfig() {
  const provider = document.getElementById('apiProviderSelect').value;
  const apiKey = document.getElementById('userApiKeyInput').value.trim();
  
  currentConfig.provider = provider;
  currentConfig.apiKey = apiKey;
  
  localStorage.setItem('apology_ai_provider', provider);
  localStorage.setItem('apology_ai_key', apiKey);
  
  updateModeBadge();
  closeApiKeyModal();
  showToast('API 設定已更新！');
}

function loadSavedConfig() {
  const savedProvider = localStorage.getItem('apology_ai_provider') || 'demo';
  const savedKey = localStorage.getItem('apology_ai_key') || '';
  
  currentConfig.provider = savedProvider;
  currentConfig.apiKey = savedKey;
  
  document.getElementById('apiProviderSelect').value = savedProvider;
  document.getElementById('userApiKeyInput').value = savedKey;
  toggleApiKeyFields();
  updateModeBadge();
}

function updateModeBadge() {
  const badge = document.getElementById('modeBadge');
  if (currentConfig.provider === 'demo') {
    badge.textContent = '⚡ 離線/保險模式';
    badge.style.color = 'var(--accent-emerald)';
  } else if (currentConfig.provider === 'gemini') {
    badge.textContent = '✨ Gemini 實時 AI';
    badge.style.color = '#a5b4fc';
  } else {
    badge.textContent = '🤖 OpenAI 實時 AI';
    badge.style.color = '#f472b6';
  }
}

// Main Generator Function
async function generateApology() {
  const target = document.getElementById('targetSelect').value;
  const severity = document.getElementById('severitySelect').value;
  const incident = document.getElementById('incidentInput').value.trim();

  if (!incident) {
    alert('請輸入過錯事件描述（例如：忘記買紀念日禮物...）');
    document.getElementById('incidentInput').focus();
    return;
  }

  // Show loading
  document.getElementById('resultsSection').style.display = 'none';
  document.getElementById('loadingBox').style.display = 'block';

  try {
    let resultData;
    if (currentConfig.provider === 'gemini' && currentConfig.apiKey) {
      resultData = await fetchFromGemini(target, severity, selectedTone, incident);
    } else if (currentConfig.provider === 'openai' && currentConfig.apiKey) {
      resultData = await fetchFromOpenAI(target, severity, selectedTone, incident);
    } else {
      // Fallback or Demo mode
      await new Promise(r => setTimeout(r, 1200)); // Simulate AI thinking delay
      resultData = generateDemoResponse(target, severity, selectedTone, incident);
    }

    displayResults(resultData);
  } catch (error) {
    console.error('API Error:', error);
    alert(`⚠️ ${error.message || 'AI 串接出現狀況'}\n\n系統已自動為您切換至「離線保險模式」提供精美範本結果！`);
    const fallbackData = generateDemoResponse(target, severity, selectedTone, incident);
    displayResults(fallbackData);
  } finally {
    document.getElementById('loadingBox').style.display = 'none';
  }
}

// Gemini API Fetch with Dynamic Model Discovery & Payload Fallback
async function fetchFromGemini(target, severity, tone, incident) {
  const cleanKey = (currentConfig.apiKey || '').trim();
  if (!cleanKey) {
    throw new Error('未填寫 API Key，請先在右上角「API 設定」輸入 Key！');
  }

  // Step 1: Dynamically discover the exact valid model name for this user's Key
  const modelName = await discoverGeminiModel(cleanKey);

  const prompt = `你是一位頂級高情商公關專家。請針對以下道歉需求，輸出符合 JSON 格式的結果：
- 道歉對象：${target}
- 嚴重程度：${severity}
- 希望語氣：${tone}
- 犯錯事件：${incident}

必須嚴格返回以下 JSON 結構（只輸出合法 JSON，不要加 markdown 標籤）：
{
  "cardA": "首選高情商道歉文案（兼具誠意與智慧）",
  "cardB": "適合 Line/簡訊的精簡對話版",
  "cardC": "正式長篇/深刻檢討與補救細節版",
  "actionSuggestion": "實用的實體或行動補救建議"
}`;

  const payloads = [
    {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json" }
    },
    {
      contents: [{ parts: [{ text: prompt }] }]
    }
  ];

  let lastErrorMsg = '';
  for (const bodyPayload of payloads) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/${modelName}:generateContent?key=${cleanKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload)
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        const errMsg = data.error?.message || `HTTP ${response.status}`;
        lastErrorMsg = errMsg;

        if (response.status === 400 && (errMsg.includes('API key not valid') || errMsg.includes('INVALID_ARGUMENT'))) {
          throw new Error(`Google API Key 驗證失敗 (${errMsg})。\n請確認 Key 是否複製正確或已有 AI Studio 存取權限。`);
        }

        console.warn(`Attempt failed for ${modelName}:`, errMsg);
        continue;
      }

      if (data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
        const rawText = data.candidates[0].content.parts[0].text;
        return parseJsonResponse(rawText);
      }
    } catch (err) {
      if (err.message.includes('API Key 驗證失敗')) {
        throw err;
      }
      console.warn(`Error on ${modelName}:`, err);
      lastErrorMsg = err.message || '網路連線異常';
    }
  }

  throw new Error(`Gemini API 呼叫失敗：${lastErrorMsg}`);
}

// OpenAI API Fetch
async function fetchFromOpenAI(target, severity, tone, incident) {
  const prompt = `你是一位頂級高情商公關專家。請針對以下道歉需求，輸出符合 JSON 格式的結果：
- 道歉對象：${target}
- 嚴重程度：${severity}
- 希望語氣：${tone}
- 犯錯事件：${incident}

JSON格式：
{
  "cardA": "首選高情商道歉文案...",
  "cardB": "適合 Line/簡訊的精簡版...",
  "cardC": "正式長篇/深刻檢討版...",
  "actionSuggestion": "實用的實體/行動補救建議..."
}`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${currentConfig.apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'system', content: prompt }],
      response_format: { type: "json_object" }
    })
  });

  const data = await response.json();
  if (!response.ok || data.error) {
    throw new Error(`OpenAI API 錯誤：${data.error?.message || '驗證失敗'}`);
  }

  return JSON.parse(data.choices[0].message.content);
}

// Parse Raw Text to JSON cleanly
function parseJsonResponse(rawText) {
  try {
    const cleaned = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleaned);
  } catch (e) {
    return {
      cardA: rawText,
      cardB: "很抱歉這次生你的氣，我不該鬧脾氣，給我個機會補償你好嗎？",
      cardC: "這件事是我深切檢討後的想法...請給我時間說明並補救。",
      actionSuggestion: "準備對方平時最喜歡吃的甜點或大杯飲料，親自送過去。"
    };
  }
}

// High Quality Demo Fallback Generator
function generateDemoResponse(target, severity, tone, incident) {
  return {
    cardA: `【誠摯溝通】\n關於「${incident}」這件事，我第一時間深切檢討了自己。我知道這讓你感到不舒服，我也完全理解你生氣的原因。這絕對是我的疏忽，我非常在乎你的感受，真的非常對不起！`,
    cardB: `抱歉！剛才「${incident}」是我太粗心了！不要生氣了好嗎？今晚我請客賠罪，你想吃什麼我都訂！🥺`,
    cardC: `【深刻檢討與致歉信】\n致 ${target}：\n非常抱歉因為「${incident}」給您帶來了困擾。經過我的深切反省，我已針對此次失誤制定了改善措施，未來絕不會再讓類似情況發生。懇請您給予修正與補救的機會。`,
    actionSuggestion: `針對「${target}」，建議立刻帶著對方平時最愛的飲料/咖啡，並附上一張手寫的道歉小卡，親自遞交表露誠意。`
  };
}

// Display Generated Results
function displayResults(data) {
  document.getElementById('cardAText').textContent = data.cardA;
  document.getElementById('cardBText').textContent = data.cardB;
  document.getElementById('cardCText').textContent = data.cardC;
  document.getElementById('actionSuggestionText').textContent = data.actionSuggestion;

  const engineTag = document.getElementById('resultEngineTag');
  engineTag.textContent = `Engine: ${currentConfig.provider.toUpperCase()} (${currentConfig.apiKey ? 'Real-time' : 'Demo Fallback'})`;

  document.getElementById('resultsSection').style.display = 'block';
  document.getElementById('resultsSection').scrollIntoView({ behavior: 'smooth' });
}

// Copy Text to Clipboard
function copyCardText(elementId) {
  const text = document.getElementById(elementId).textContent;
  navigator.clipboard.writeText(text).then(() => {
    showToast('📋 已成功複製文案到剪貼簿！');
  });
}

// Share to LINE
function shareToLine(elementId) {
  const text = document.getElementById(elementId).textContent;
  const lineUrl = `https://line.me/R/msg/text/?${encodeURIComponent(text)}`;
  window.open(lineUrl, '_blank');
}

// Toast Display
function showToast(msg) {
  const toast = document.getElementById('toastMsg');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 2500);
}
