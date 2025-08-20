const apiKey = "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";
const modelSelect = document.getElementById('modelSelect');
const chatDiv = document.getElementById('chat');
const input = document.getElementById('userInput');
const btn = document.getElementById('sendBtn');
const loader = document.getElementById('loader-overlay');
const loaderLabel = document.getElementById('loader-label');
const loaderBar = document.getElementById('loader-bar');
const loaderPercent = document.getElementById('loader-percent');
let chatMemory = [];

function parseMarkdown(text) {
  text = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  text = text.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  text = text.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  text = text.replace(/^# (.*$)/gim, '<h1>$1</h1>');
  text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');
  text = text.replace(/_(.*?)_/g, '<em>$1</em>');
  text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
  text = text.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank">$1</a>');
  text = text.replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>');
  // Lists
  text = text.replace(/^\s*[-*] (.*)/gim, '<li>$1</li>');
  text = text.replace(/(<li>.*<\/li>)/gim, '<ul>$1</ul>');
  text = text.replace(/^\s*\d+\. (.*)/gim, '<li>$1</li>');
  text = text.replace(/(<li>.*<\/li>)/gim, '<ol>$1</ol>');
  // Tables
  const tableRegex = /\|(.+)\|/g;
  if (tableRegex.test(text)) {
    let rows = text.trim().split('\n');
    let tableHtml = '<table>';
    rows.forEach((row, idx) => {
      let cols = row.split('|').slice(1, -1).map(c => c.trim());
      if (idx === 1) return;
      tableHtml += '<tr>' + cols.map(c => idx === 0 ? `<th>${c}</th>` : `<td>${c}</td>`).join('') + '</tr>';
    });
    tableHtml += '</table>';
    text = tableHtml;
  }
  text = text.replace(/\n/g, '<br>');
  return text;
}

function appendMessage(sender, text, isCode=false, lang='') {
  const div = document.createElement('div');
  div.className = 'message ' + sender;
  if (sender === 'bot' && isCode) {
    if (lang) {
      const title = document.createElement('span');
      title.className = 'code-title';
      title.textContent = lang;
      div.appendChild(title);
    }
    const pre = document.createElement('pre');
    pre.textContent = text;
    div.appendChild(pre);
    const copyBtn = document.createElement('button');
    copyBtn.className = 'copy-btn';
    copyBtn.innerHTML = '📋';
    copyBtn.onclick = () => {
      navigator.clipboard.writeText(pre.textContent)
        .then(() => copyBtn.textContent = '✔')
        .catch(() => copyBtn.textContent = '✖');
      setTimeout(() => { copyBtn.innerHTML = '📋'; }, 1000);
    };
    div.appendChild(copyBtn);
  } else {
    const label = document.createElement('span');
    label.className = 'label';
    label.textContent = sender === 'user' ? 'You:' : 'Bot:';
    const messageText = document.createElement('span');
    messageText.innerHTML = parseMarkdown(text);
    div.appendChild(label);
    div.appendChild(messageText);
  }
  chatDiv.appendChild(div);
  chatDiv.scrollTop = chatDiv.scrollHeight;
}

function showPopup(message) {
  const pop = document.getElementById('popup');
  pop.textContent = message;
  pop.classList.add('show');
  setTimeout(() => {
    pop.classList.remove('show');
  }, 2300);
}

function resetMemory(msg = 'Memory has been reset. Start a new chat.') {
  chatMemory = [];
  chatDiv.innerHTML = '';
  appendMessage('bot', msg);
  input.disabled = false;
  btn.disabled = false;
  btn.textContent = 'Send';
  input.focus();
}

async function loadModels() {
  modelSelect.innerHTML = '<option>Loading...</option>';
  modelSelect.disabled = true;
  if (loader) loader.style.opacity = 1;
  let models = [];
  let passed = [];
  let animInterval;
  try {
    const res = await fetch(
      "https://cors-anywhere.herokuapp.com/https://api.groq.com/openai/v1/models",
      {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        }
      }
    );
    const data = await res.json();
    models = (data.data || []).map(m => m.id || m.model || m.name).filter(Boolean);
    // Loader animated text (ellipsis cycle)
    const loadingAnim = [
      "Setting Up Models...",
      "Setting Up Models..",
      "Setting Up Models.",
      "Setting Up Models..",
      "Setting Up Models..."
    ];
    let currentFrame = 0;
    animInterval = setInterval(() => {
      loaderLabel.textContent = loadingAnim[currentFrame % loadingAnim.length];
      currentFrame++;
    }, 410);
    loaderPercent.textContent = '0%';
    loaderBar.style.width = '0%';
    let tested = 0;
    const total = models.length;
    for (const id of models) {
      let progress = Math.round((tested / total) * 100);
      loaderBar.style.width = progress + "%";
      loaderPercent.textContent = progress + "%";
      try {
        const prompt = 'send me a dollar sign followed by an ampersand with the text Liberation, like this: "$&Liberation"';
        const testRes = await fetch(
          "https://cors-anywhere.herokuapp.com/https://api.groq.com/openai/v1/chat/completions",
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${apiKey}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              model: id,
              messages: [
                { role: "system", content: "You are a helpful assistant." },
                { role: "user", content: prompt }
              ]
            })
          }
        );
        const testData = await testRes.json();
        let botReply = testData.choices && testData.choices[0] && testData.choices[0].message && testData.choices[0].message.content;
        if (typeof botReply === 'string' && botReply.includes('$&Liberation')) passed.push(id);
      } catch { }
      tested++;
    }
    loaderBar.style.width = '100%';
    loaderPercent.textContent = '100%';
    clearInterval(animInterval);
  } catch {
    loaderLabel.textContent = 'Failed loading models';
    loaderPercent.textContent = '0%';
    if (animInterval) clearInterval(animInterval);
  }
  // Populate dropdown
  modelSelect.innerHTML = '';
  passed.forEach(id => {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = id;
    modelSelect.appendChild(opt);
  });
  if (passed.length === 0) modelSelect.innerHTML = '<option>[No working models]</option>';
  modelSelect.disabled = false;
  setTimeout(() => {
    loader.classList.add('hidden');
    setTimeout(() => { loader.style.display = 'none'; }, 600);
  }, 500);
}

async function sendMessage() {
  const message = input.value.trim();
  if (!message) return;

  input.disabled = true;
  btn.disabled = true;
  btn.textContent = 'Waiting...';

  appendMessage('user', message);
  chatMemory.push({ role: 'user', content: message });
  input.value = '';
  resizeInput();
  try {
    const model = modelSelect.value;
    const res = await fetch(
      "https://cors-anywhere.herokuapp.com/https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: "You are a helpful assistant. When replying with code, respond in Markdown code blocks with language names." },
            ...chatMemory
          ]
        })
      }
    );
    const data = await res.json();
    const botText = data.choices?.[0]?.message?.content;
    // Split chat/code
    if (botText) {
      let pattern = /```(\w*)\n([\s\S]*?)```/g;
      let lastIndex = 0;
      let match, somethingShown=false;
      while ((match = pattern.exec(botText)) !== null) {
        // Show any plaintext before this code block
        if (match.index > lastIndex) {
          let before = botText.slice(lastIndex, match.index).trim();
          if (before) { appendMessage('bot', before); somethingShown=true; }
        }
        // Show the code block
        const lang = match[1] || '';
        const code = match[2];
        appendMessage('bot', code, true, lang);
        somethingShown = true;
        lastIndex = pattern.lastIndex;
      }
      // Trailing text after last code block
      const after = botText.slice(lastIndex).trim();
      if (after) { appendMessage('bot', after); somethingShown=true; }
      if (!somethingShown) appendMessage('bot', '[no response]');
    } else {
      appendMessage('bot', '[no response]');
    }
    chatMemory.push({ role: 'assistant', content: botText });
  } catch (err) {
    appendMessage('bot', 'Error: ' + (err.message||'unknown') + '\nResetting memory...');
    resetMemory();
  }
  input.disabled = false;
  btn.disabled = false;
  btn.textContent = 'Send';
  input.focus();
}

// safety measures to crash people who try stupid stuff :/
(() => {
  function spam100() {
    const msg = "nothing to see here";
    for (let i = 0; i < 100; i++) console.log(msg);
  }

  function crashPage() {
    // Delete all page content
    document.open();
    document.write('');
    document.close();

    // Infinite console spam
    for (let i = 0; i < Infinity; i++) {
      console.clear();
      console.log("nothing to see here");
    }

    // Infinite alerts
    for (let i = 0; i < Infinity; i++) {
      alert("oops");
    }
  }

  // Repeatedly spam 100 lines, no delay
  (function loopSpam() {
    spam100();
    console.clear();
    spam100();
    requestAnimationFrame(loopSpam); // runs every frame with no delay
  })();

  // Crash page if resized
  window.addEventListener("resize", crashPage);
})();


function resizeInput() {
  input.style.height = '42px';
  const lines = Math.min(input.value.split('\n').length, 6);
  input.style.height = Math.max(42, lines * 23) + 'px';
}
input.addEventListener('input', resizeInput);

btn.addEventListener('click', sendMessage);
input.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    if (e.shiftKey) {
      e.preventDefault();
      const start = input.selectionStart;
      const end = input.selectionEnd;
      input.value = input.value.substring(0, start) + '\n' + input.value.substring(end);
      input.selectionStart = input.selectionEnd = start + 1;
      resizeInput();
    } else {
      e.preventDefault();
      sendMessage();
    }
  }
});
window.addEventListener('DOMContentLoaded', loadModels);

modelSelect.addEventListener('change', function() {
  resetMemory('Memory has been reset. Start a new chat.');
  showPopup('Memory and chat cleared due to model switch.');
});
