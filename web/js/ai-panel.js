/**
 * AI panel — DeepSeek V4 chat with tool_calls translated to flat string
 * commands. Sole owner of `console.ai.*` localStorage keys; never
 * imports ws-client / control-panel directly — tool dispatch goes
 * through the injected `onTool(command)` callback (command is the bare
 * verb without trailing newline; main.js adds it).
 *
 * Tool name → command string (mirror of control-panel.js):
 *   led_on        →  'led_on'
 *   led_off       →  'led_off'
 *   motor_speed   →  'motor_speed_<0..5>'
 */

const AI_STORAGE_KEYS = {
  apiKey: 'console.ai.apiKey',
  baseUrl: 'console.ai.baseUrl',
  model: 'console.ai.model',
};

const AI_DEFAULTS = {
  baseUrl: 'https://api.deepseek.com',
  model: 'deepseek-v4-flash',
};

const SUPPORTED_MODELS = ['deepseek-v4-flash', 'deepseek-v4-pro'];

const SYSTEM_PROMPT = `你是「Helmet Console」中的头盔控制助手。

设备说明：
- LED：头盔顶部照明阵列，仅有「开 / 关」两态。
- 电机：驱动电机，档位 0-5，0 表示停止，5 表示最高速。

工作方式：
- 用简体中文回答用户。
- 当用户意图是控制设备时，调用对应工具（tool）执行；先用一句简短自然语言告知用户你将做什么，再调工具。
- 用户可能问与硬件无关的问题，正常回答即可。
- 多步动作允许一次发出多个工具调用。`;

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'led_on',
      description: '打开头盔 LED 灯阵列',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'led_off',
      description: '关闭头盔 LED 灯阵列',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'motor_speed',
      description: '设置头盔驱动电机速度档位（0=停止，5=最高速）',
      parameters: {
        type: 'object',
        properties: {
          value: { type: 'integer', minimum: 0, maximum: 5 },
        },
        required: ['value'],
      },
    },
  },
];

function readAiConfig() {
  const storedModel = localStorage.getItem(AI_STORAGE_KEYS.model);
  return {
    apiKey: localStorage.getItem(AI_STORAGE_KEYS.apiKey) || '',
    baseUrl: localStorage.getItem(AI_STORAGE_KEYS.baseUrl) || AI_DEFAULTS.baseUrl,
    model: SUPPORTED_MODELS.includes(storedModel) ? storedModel : AI_DEFAULTS.model,
  };
}

function writeAiConfig({ apiKey, baseUrl, model }) {
  localStorage.setItem(AI_STORAGE_KEYS.apiKey, apiKey);
  localStorage.setItem(AI_STORAGE_KEYS.baseUrl, baseUrl);
  localStorage.setItem(AI_STORAGE_KEYS.model, model);
}

function maskKey(key) {
  if (!key) return '🔑 未配置';
  const tail = key.slice(-4);
  return `🔑 sk-***${tail}`;
}

function translateTool(name, args) {
  if (name === 'led_on') return { command: 'led_on' };
  if (name === 'led_off') return { command: 'led_off' };
  if (name === 'motor_speed') {
    const v = Number(args && args.value);
    if (!Number.isInteger(v) || v < 0 || v > 5) {
      return { error: '参数越界' };
    }
    return { command: `motor_speed_${v}` };
  }
  return { error: `未知工具 ${name}` };
}

function statusToErrorMessage(status) {
  if (status === 401) return 'API Key 无效，请检查配置';
  if (status === 429) return '请求过于频繁，请稍后重试';
  if (status >= 500) return `DeepSeek 服务异常 (HTTP ${status})`;
  return `请求失败 (HTTP ${status})`;
}

export function createAiPanel({
  configBar,
  configKey,
  configModel,
  configEdit,
  configForm,
  configFormTitle,
  keyInput,
  baseUrlInput,
  configCancel,
  bubbles,
  inputForm,
  input,
  sendButton,
  onTool,
  isWsConnected,
}) {
  let config = readAiConfig();
  const history = [];
  let streaming = false;

  function renderConfigState() {
    if (config.apiKey) {
      configBar.hidden = false;
      configKey.textContent = maskKey(config.apiKey);
      configModel.value = config.model;
      configForm.hidden = true;
      configFormTitle.hidden = true;
      configCancel.hidden = false;
      bubbles.hidden = false;
      input.disabled = streaming;
      sendButton.disabled = streaming;
    } else {
      configBar.hidden = true;
      configForm.hidden = false;
      configFormTitle.hidden = false;
      configCancel.hidden = true;
      bubbles.hidden = true;
      input.disabled = true;
      sendButton.disabled = true;
    }
  }

  function refreshConfigInputs() {
    keyInput.value = '';
    baseUrlInput.value = config.baseUrl;
  }

  function appendBubble(role, text = '') {
    const bubble = document.createElement('div');
    bubble.className = `ai-bubble ai-bubble-${role}`;
    const body = document.createElement('span');
    body.className = 'ai-bubble-body';
    if (text) body.textContent = text;
    bubble.appendChild(body);
    bubbles.appendChild(bubble);
    bubbles.scrollTop = bubbles.scrollHeight;
    return bubble;
  }

  function bubbleBody(bubble) {
    return bubble.querySelector('.ai-bubble-body');
  }

  function appendToolLine(bubble, name, args, status) {
    const line = document.createElement('div');
    line.className = 'ai-bubble-tool';
    const argsStr = args && Object.keys(args).length ? `(${JSON.stringify(args)})` : '';
    line.textContent = `↳ ${name}${argsStr} ${status}`;
    if (status.startsWith('⚠')) {
      line.classList.add('ai-bubble-tool-error');
    }
    bubble.appendChild(line);
    bubbles.scrollTop = bubbles.scrollHeight;
  }

  async function callDeepSeek(userText) {
    history.push({ role: 'user', content: userText });
    const aiBubble = appendBubble('ai', '');
    const body = bubbleBody(aiBubble);

    const trimmedBase = config.baseUrl.replace(/\/$/, '');
    const url = `${trimmedBase}/chat/completions`;

    let response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...history],
          tools: TOOLS,
          stream: true,
          thinking: { type: 'disabled' },
        }),
      });
    } catch {
      aiBubble.remove();
      appendBubble('system', '网络连接失败，请检查网络');
      return;
    }

    if (!response.ok) {
      aiBubble.remove();
      appendBubble('system', statusToErrorMessage(response.status));
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let accumulatedContent = '';
    const accumulatedTools = [];
    let finishReason = null;

    function processEvent(rawEvent) {
      const dataLines = [];
      for (const line of rawEvent.split(/\r?\n/)) {
        if (!line.startsWith('data:')) continue;
        dataLines.push(line.slice(5).replace(/^ /, ''));
      }
      if (!dataLines.length) return;
      const payload = dataLines.join('\n');
      if (!payload || payload === '[DONE]') return;

      let data;
      try {
        data = JSON.parse(payload);
      } catch {
        return;
      }

      const choice = data.choices && data.choices[0];
      if (!choice) return;
      if (choice.finish_reason) finishReason = choice.finish_reason;

      const delta = choice.delta;
      if (!delta) return;

      if (typeof delta.content === 'string') {
        accumulatedContent += delta.content;
        body.textContent = accumulatedContent;
        bubbles.scrollTop = bubbles.scrollHeight;
      }

      if (Array.isArray(delta.tool_calls)) {
        for (const tc of delta.tool_calls) {
          const i = typeof tc.index === 'number' ? tc.index : 0;
          if (!accumulatedTools[i]) {
            accumulatedTools[i] = { id: '', name: '', arguments: '' };
          }
          if (tc.id) accumulatedTools[i].id = tc.id;
          if (tc.function && tc.function.name) {
            accumulatedTools[i].name += tc.function.name;
          }
          if (tc.function && typeof tc.function.arguments === 'string') {
            accumulatedTools[i].arguments += tc.function.arguments;
          }
        }
      }
    }

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let match;
        const sepRegex = /\r?\n\r?\n/;
        while ((match = buffer.match(sepRegex))) {
          const idx = match.index;
          const rawEvent = buffer.slice(0, idx);
          buffer = buffer.slice(idx + match[0].length);
          processEvent(rawEvent);
        }
      }
    } catch {
      aiBubble.remove();
      appendBubble('system', '网络连接失败，请检查网络');
      return;
    }

    // Persist assistant turn even when only tool_calls were emitted —
    // OpenAI/DeepSeek require assistant messages between user turns.
    // Per PRD D8 (i), drop the tool_calls field; keep content only.
    if (accumulatedContent || accumulatedTools.length) {
      history.push({ role: 'assistant', content: accumulatedContent });
    }

    if (finishReason === 'tool_calls' && accumulatedTools.length) {
      for (const tc of accumulatedTools) {
        if (!tc.name) {
          appendToolLine(aiBubble, '?', null, '⚠ 未命名工具');
          continue;
        }
        let args = {};
        if (tc.arguments && tc.arguments.trim()) {
          try {
            args = JSON.parse(tc.arguments);
          } catch {
            appendToolLine(aiBubble, tc.name, null, '⚠ 参数解析失败');
            continue;
          }
        }
        const translated = translateTool(tc.name, args);
        if (translated.error) {
          appendToolLine(aiBubble, tc.name, args, `⚠ ${translated.error}`);
          continue;
        }
        if (!isWsConnected()) {
          appendToolLine(aiBubble, tc.name, args, '⚠ 设备未连接');
          continue;
        }
        onTool(translated.command);
        appendToolLine(aiBubble, tc.name, args, '✓');
      }
    }

    if (!accumulatedContent && !accumulatedTools.length) {
      body.textContent = '(空回复)';
    }
  }

  configEdit.addEventListener('click', () => {
    configForm.hidden = false;
    configFormTitle.hidden = true;
    configCancel.hidden = false;
    refreshConfigInputs();
    keyInput.focus();
  });

  configCancel.addEventListener('click', () => {
    configForm.hidden = true;
    refreshConfigInputs();
  });

  configForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const apiKey = keyInput.value.trim();
    const baseUrl = baseUrlInput.value.trim() || AI_DEFAULTS.baseUrl;
    if (!apiKey) {
      keyInput.focus();
      return;
    }
    config = { apiKey, baseUrl, model: configModel.value };
    writeAiConfig(config);
    renderConfigState();
    input.focus();
  });

  configModel.addEventListener('change', () => {
    if (!SUPPORTED_MODELS.includes(configModel.value)) {
      configModel.value = AI_DEFAULTS.model;
    }
    config = { ...config, model: configModel.value };
    writeAiConfig(config);
  });

  inputForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text || streaming || !config.apiKey) {
      return;
    }
    appendBubble('user', text);
    input.value = '';
    streaming = true;
    sendButton.disabled = true;
    input.disabled = true;

    callDeepSeek(text).finally(() => {
      streaming = false;
      sendButton.disabled = false;
      input.disabled = false;
      input.focus();
    });
  });

  refreshConfigInputs();
  renderConfigState();

  return {
    focus() {
      if (config.apiKey) input.focus();
      else keyInput.focus();
    },
  };
}
