/* =========================================================
   AKNexa AI — CUSTOMER SALES ASSISTANT
   ========================================================= */

let aiChatHistory = [];
let aiProductsCache = [];
let aiProjectsCache = [];
let aiStarterKitsCache = [];
let aiCartItems = [];
let aiIsProcessing = false;

// ---- INIT ----
function initAIChat() {
  const toggle = document.getElementById("aiChatToggle");
  const panel = document.getElementById("aiChatPanel");
  const close = document.getElementById("aiChatClose");
  const form = document.getElementById("aiChatForm");
  const input = document.getElementById("aiChatInput");
  const body = document.getElementById("aiChatBody");

  if (!toggle || !panel) return;

  // Toggle chat
  toggle.addEventListener("click", () => {
    panel.classList.toggle("open");
    if (panel.classList.contains("open")) {
      input.focus();
      // Scroll to bottom
      body.scrollTop = body.scrollHeight;
    }
  });

  // Close chat
  close.addEventListener("click", () => {
    panel.classList.remove("open");
  });

  // Send message
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const msg = input.value.trim();
    if (!msg || aiIsProcessing) return;
    input.value = "";
    sendCustomerMessage(msg);
  });

  // Auto-resize input
  input.addEventListener("input", () => {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 80) + "px";
  });

  // Load products for recommendations
  loadAIProducts();
}

// ---- LOAD PRODUCTS ----
async function loadAIProducts() {
  if (!supabase) return;
  
  // Load products
  const { data: products } = await supabase
    .from("products")
    .select("*")
    .eq("type", "product")
    .limit(50);
  aiProductsCache = products || [];

  // Load projects
  const { data: projects } = await supabase
    .from("products")
    .select("*")
    .eq("type", "project")
    .limit(30);
  aiProjectsCache = projects || [];

  // Load starter kits
  const { data: kits } = await supabase
    .from("products")
    .select("*")
    .eq("type", "starter_kit")
    .limit(20);
  aiStarterKitsCache = kits || [];
}

// ---- SEND CUSTOMER MESSAGE ----
async function sendCustomerMessage(message) {
  const body = document.getElementById("aiChatBody");
  if (!body) return;
  aiIsProcessing = true;

  // Add user message
  addAICustomerMessage("user", message);
  aiChatHistory.push({ role: "user", content: message });

  // Show typing
  const typingId = addAITypingIndicator();

  try {
    const isProjectBuild = isProjectBuildQuery(message);

    if (isProjectBuild) {
      // ---- PROJECT GENERATOR MODE (idea -> components -> circuit -> code -> cost) ----
      const groqMessages = buildProjectGeneratorMessages(message);
      const response = await callCustomerGroqAPI(groqMessages);
      removeAITypingIndicator(typingId);

      let botReply = response.choices?.[0]?.message?.content ||
        "Sorry, I couldn't generate that project. Please try again.";

      // Pull the components AI suggested and match them to REAL products/prices
      const componentNames = parseComponentsFromAIText(botReply);
      const matched = matchComponentsToRealProducts(componentNames);

      if (matched.found.length) {
        const realTotal = matched.found.reduce((sum, p) => sum + Number(p.price || 0), 0);
        botReply += `<div style="margin-top:14px; padding-top:12px; border-top:1px solid var(--line);">`;
        botReply += `<p style="font-weight:600; margin:0 0 6px;">🛒 Real Shopping List (hamari dukaan ke asal prices):</p>`;
        botReply += `<p style="color:var(--muted); font-size:.85rem; margin:0 0 8px;">Total: ${SITE_CONFIG.currency} ${realTotal.toLocaleString()}</p>`;
        botReply += renderProductCardsForAI(matched.found);
        botReply += `</div>`;
      }
      if (matched.notFound.length) {
        botReply += `<p style="color:var(--muted); font-size:.8rem; margin-top:10px;">⚠️ Yeh components hamari website pe abhi list nahi hain: ${matched.notFound.join(", ")}. WhatsApp pe confirm kar lein.</p>`;
      }

      addAICustomerMessage("bot", botReply);
      aiChatHistory.push({ role: "assistant", content: botReply });

    } else {
      // ---- NORMAL PRODUCT SEARCH / BUDGET FINDER MODE ----
      const isProductQuery = isProductSearchQuery(message);
      let productResults = [];
      let projectResults = [];
      let kitResults = [];

      if (isProductQuery) {
        const searchResults = searchProducts(message);
        productResults = searchResults.products;
        projectResults = searchResults.projects;
        kitResults = searchResults.kits;
      }

      // Budget-based filtering, e.g. "2000 ke andar project chahiye"
      const budget = extractBudget(message);
      if (budget) {
        const withinBudget = (arr) => arr.filter(p => Number(p.price) <= budget);
        const merge = (existing, extra) => {
          const map = new Map(existing.map(p => [p.id, p]));
          extra.forEach(p => map.set(p.id, p));
          return [...map.values()].sort((a, b) => b.price - a.price).slice(0, 6);
        };
        productResults = merge(productResults, withinBudget(aiProductsCache));
        projectResults = merge(projectResults, withinBudget(aiProjectsCache));
        kitResults = merge(kitResults, withinBudget(aiStarterKitsCache));
      }

      // Build messages for Groq
      const groqMessages = buildCustomerGroqMessages(message, {
        products: productResults,
        projects: projectResults,
        kits: kitResults
      });

      // Call Groq API
      const response = await callCustomerGroqAPI(groqMessages);

      // Remove typing
      removeAITypingIndicator(typingId);

      // Get bot response
      let botReply = response.choices?.[0]?.message?.content || 
        "Sorry, I couldn't process that. Please try again or contact us on WhatsApp.";

      // If we have product results, append them as clickable cards
      if (productResults.length || projectResults.length || kitResults.length) {
        const allResults = [...productResults, ...projectResults, ...kitResults].slice(0, 6);
        if (allResults.length) {
          botReply += renderProductCardsForAI(allResults);
        }
      }

      // Add bot response
      addAICustomerMessage("bot", botReply);
      aiChatHistory.push({ role: "assistant", content: botReply });
    }

  } catch (error) {
    removeAITypingIndicator(typingId);
    addAICustomerMessage("bot", "❌ Error: " + (error.message || "Something went wrong. Please try again."));
    console.error("AI Error:", error);
  }

  aiIsProcessing = false;
}

// ---- IS PRODUCT SEARCH QUERY ----
function isProductSearchQuery(message) {
  const keywords = [
    "product", "sensor", "arduino", "esp", "raspberry", "kit", "board",
    "buy", "price", "cost", "available", "stock", "project", "module",
    "led", "motor", "servo", "display", "lcd", "oled", "camera",
    "wifi", "bluetooth", "rfid", "gps", "gsm", "relay", "power",
    "battery", "charger", "cable", "wire", "jumper", "breadboard",
    "soldering", "tool", "component", "electronics", "sensor"
  ];
  const lower = message.toLowerCase();
  return keywords.some(k => lower.includes(k)) || message.includes("?");
}

// ---- SEARCH PRODUCTS ----
function searchProducts(query) {
  const lower = query.toLowerCase();
  
  // Search in products
  const products = aiProductsCache.filter(p => 
    p.name.toLowerCase().includes(lower) ||
    (p.spec && p.spec.toLowerCase().includes(lower)) ||
    (p.category && p.category.toLowerCase().includes(lower))
  );

  // Search in projects
  const projects = aiProjectsCache.filter(p => 
    p.name.toLowerCase().includes(lower) ||
    (p.spec && p.spec.toLowerCase().includes(lower))
  );

  // Search in starter kits
  const kits = aiStarterKitsCache.filter(p => 
    p.name.toLowerCase().includes(lower) ||
    (p.spec && p.spec.toLowerCase().includes(lower))
  );

  return { products, projects, kits };
}

// ---- IS PROJECT BUILD QUERY ----
function isProjectBuildQuery(message) {
  const lower = message.toLowerCase();
  const buildVerbs = [
    "banao", "banana", "banayen", "banaun", "bana do", "bana de",
    "kaise banau", "kaise banaen", "build me", "make me", "create a project", "generate"
  ];
  const techWords = [
    "arduino", "esp32", "esp8266", "raspberry", "circuit", "wiring", "code likho", "project"
  ];
  const hasVerb = buildVerbs.some(v => lower.includes(v));
  const hasTech = techWords.some(t => lower.includes(t));
  return hasVerb && hasTech;
}

// ---- EXTRACT BUDGET (e.g. "2000 ke andar project chahiye") ----
function extractBudget(message) {
  const lower = message.toLowerCase();
  const contextWords = ["budget", "andar", "tak", "under", "se kam", "mein", "rs", "pkr", "\u20a8", "\u20b9", "rupay", "rupaye"];
  const hasContext = contextWords.some(w => lower.includes(w));
  if (!hasContext) return null;
  const match = message.match(/(\d{3,6})/);
  if (!match) return null;
  return parseInt(match[1], 10);
}

// ---- BUILD PROJECT GENERATOR MESSAGES ----
function buildProjectGeneratorMessages(query) {
  const systemPrompt = SITE_CONFIG.aknexaProjectGeneratorPrompt || `
You are AKNexa AI, an electronics project generator for AK Electronics Pro, a store based in Lahore, Pakistan.

## SCOPE - STAY ON TOPIC
Only help with: electronics/Arduino/ESP32 project ideas, your creator, or AK Electronics Pro. If the user asks about anything else, politely decline and steer back to projects/products -- do not answer the unrelated question.

## CURRENCY
This is a Pakistani store. If you ever mention money, use PKR / Rs only -- NEVER \u20b9 (Indian Rupee), $, or any other currency.

## NO PRICE GUESSING
Do NOT include your own cost estimate anywhere in your answer. Real pricing will be calculated automatically afterward from the store's actual stock and appended below your answer -- do not add an "Estimated Cost" section yourself.

When someone describes a project idea (e.g. "Arduino automatic street light" or "smart home project"), respond with EXACTLY this structure, using these exact section headings so the text can be parsed programmatically:

### \ud83d\udca1 Project: <short project name>

### \ud83e\udde9 Components List
- <component name> (qty)
- <component name> (qty)
(List every component needed, one per line. Keep names SIMPLE and GENERIC, e.g. "Arduino Uno", "PIR motion sensor", "LDR sensor", "Relay module", "Jumper wires", "Breadboard" -- these will be matched against a real electronics store catalog.)

### \ud83d\udd0c Circuit / Wiring
Explain the pin-to-pin connections in plain text (no image).

### 💻 Arduino Code
\`\`\`cpp
<complete working code>
\`\`\`

### \ud83d\udcdd Working Explanation
Explain briefly how the project works.

### \u2b50 Difficulty Level
Beginner / Intermediate / Advanced

Respond in the same language the user used (Roman Urdu, English, or Urdu script) for every section EXCEPT the code block, which always stays in English/C++.
`;

  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: query }
  ];
}

// ---- PARSE COMPONENTS OUT OF THE AI's ANSWER ----
function parseComponentsFromAIText(text) {
  const match = text.match(/Components List([\s\S]*?)(?:###|$)/i);
  if (!match) return [];
  const block = match[1];
  const lines = block.split("\n").map(l => l.trim()).filter(l => l.startsWith("-") || l.startsWith("\u2022"));
  return lines.map(l => {
    let name = l.replace(/^[-\u2022]\s*/, "");
    name = name.replace(/\(.*?\)/g, "");
    name = name.replace(/\*\*/g, "").trim();
    return name;
  }).filter(Boolean);
}

// ---- MATCH AI's SUGGESTED COMPONENTS TO REAL PRODUCTS IN STOCK ----
function matchComponentsToRealProducts(componentNames) {
  const allProducts = [...aiProductsCache, ...aiStarterKitsCache, ...aiProjectsCache];
  const found = [];
  const notFound = [];
  const foundIds = new Set();

  componentNames.forEach(name => {
    const lower = name.toLowerCase();
    const words = lower.split(/\s+/).filter(w => w.length > 2);

    // Score every unclaimed product: an exact phrase match scores highest;
    // otherwise ALL of the component's words must appear (prevents a single
    // generic word like "module" or "sensor" from grabbing the wrong item).
    let best = null;
    let bestScore = 0;
    allProducts.forEach(p => {
      if (foundIds.has(p.id)) return; // already claimed by an earlier component
      const pname = p.name.toLowerCase();
      let score = 0;
      if (pname.includes(lower)) {
        score = 100 + lower.length;
      } else if (words.length > 0 && words.every(w => pname.includes(w))) {
        score = 10 + words.length;
      }
      if (score > bestScore) { bestScore = score; best = p; }
    });

    if (best) {
      found.push(best);
      foundIds.add(best.id);
    } else {
      notFound.push(name);
    }
  });

  return { found, notFound };
}

// ---- BUILD CUSTOMER GROQ MESSAGES ----
function buildCustomerGroqMessages(query, searchResults) {
  const systemPrompt = SITE_CONFIG.aknexaSystemPromptCustomer || `
You are AKNexa Assistant, the official sales and support AI for AK Electronics Pro.

Your job:
- Help customers find the right electronics products (Arduino, ESP32, sensors, kits, projects)
- Ask about budget, project type, and requirements
- Recommend products from the available catalog based on customer needs
- NEVER invent products, prices, or stock
- Always show real product names and prices from the database
- When recommending, include a brief feature description
- If customer likes a product, offer to add it to cart

Your creator is Abdullah King, founder of AK Electronics Pro.

If someone asks "Who created you?" or "Who is your creator?", say:
"My creator is Abdullah King, the founder of AK Electronics Pro."

Always respond in the language the customer uses (Roman Urdu, English, or Urdu script).
Be friendly, helpful, and professional — like a knowledgeable store salesperson.
`;

  const messages = [
    { role: "system", content: systemPrompt }
  ];

  // Add context if we have search results
  if (searchResults.products.length || searchResults.projects.length || searchResults.kits.length) {
    let context = "Here are products matching the customer's query:\n\n";
    
    if (searchResults.products.length) {
      context += "🛒 **Products:**\n";
      searchResults.products.slice(0, 5).forEach(p => {
        context += `- ${p.name} — ${SITE_CONFIG.currency} ${p.price}${p.spec ? ` (${p.spec})` : ''}\n`;
      });
      context += "\n";
    }

    if (searchResults.projects.length) {
      context += "🔬 **Projects:**\n";
      searchResults.projects.slice(0, 3).forEach(p => {
        context += `- ${p.name} — ${SITE_CONFIG.currency} ${p.price}${p.spec ? ` (${p.spec})` : ''}\n`;
      });
      context += "\n";
    }

    if (searchResults.kits.length) {
      context += "📚 **Starter Kits:**\n";
      searchResults.kits.slice(0, 3).forEach(p => {
        context += `- ${p.name} — ${SITE_CONFIG.currency} ${p.price}${p.spec ? ` (${p.spec})` : ''}\n`;
      });
      context += "\n";
    }

    messages.push({ role: "system", content: `REAL PRODUCT DATA:\n${context}\nUse this data in your response. Never invent products or prices.` });
  }

  messages.push({ role: "user", content: query });
  return messages;
}

// ---- CALL CUSTOMER GROQ API ----
async function callCustomerGroqAPI(messages) {
  // Groq key ab server-side hai (Netlify Function). Client sirf apne
  // site ke /.netlify/functions/groq-chat endpoint ko call karta hai.
  const response = await fetch("/.netlify/functions/groq-chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "openai/gpt-oss-20b",
      messages: messages,
      temperature: 0.7,
      max_tokens: 1024
    })
  });

  const rawText = await response.text();
  let data;
  try {
    data = JSON.parse(rawText);
  } catch (parseErr) {
    // Server se JSON ki jagah kuch aur mila (khali body, HTML 404 page, wagera)
    throw new Error(
      `Server se sahi response nahi mila (status ${response.status}). ` +
      (rawText ? rawText.slice(0, 150) : "Response khali tha — function shayad deploy nahi hui ya crash ho gayi.")
    );
  }

  if (!response.ok) {
    throw new Error(data.error || `Server error (${response.status})`);
  }

  return data;
}

// ---- RENDER PRODUCT CARDS ----
function renderProductCardsForAI(products) {
  if (!products.length) return "";

  let html = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;margin-top:12px;">`;
  
  products.forEach(p => {
    const imgUrl = p.image ? p.image.split(",")[0].trim() : "logo-badge.svg";
    const stockClass = p.stock === "in" ? "stock-in" : p.stock === "low" ? "stock-low" : "stock-out";
    const stockLabel = p.stock || "in stock";
    
    html += `
      <div style="background:var(--panel-2);border:1px solid var(--line);border-radius:8px;padding:10px;text-align:center;cursor:pointer;" onclick="openGallery('${p.id}')">
        <img src="${imgUrl}" style="width:100%;height:80px;object-fit:contain;background:var(--bg);border-radius:4px;" onerror="this.src='logo-badge.svg'">
        <div style="font-size:.78rem;font-weight:600;margin:6px 0 2px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${escapeHtml(p.name)}</div>
        <div style="font-size:.7rem;color:var(--muted);">${SITE_CONFIG.currency} ${p.price.toLocaleString()}</div>
        <div style="display:flex;gap:4px;margin-top:6px;justify-content:center;">
          <span style="font-size:.6rem;padding:1px 8px;border-radius:100px;text-transform:uppercase;font-weight:600;background:rgba(77,255,143,.15);color:#4dff8f;">${stockLabel}</span>
        </div>
        <button class="btn btn-primary" style="width:100%;padding:4px 8px;font-size:.65rem;margin-top:6px;" onclick="event.stopPropagation();addToCartFromAI('${p.id}')">🛒 Add to Cart</button>
      </div>
    `;
  });

  html += `</div>`;
  return html;
}

// ---- ADD TO CART FROM AI ----
function addToCartFromAI(productId) {
  const product = [...aiProductsCache, ...aiProjectsCache, ...aiStarterKitsCache].find(p => p.id === productId);
  if (product) {
    addToCart(product);
    showToast(`${product.name} added to cart! 🛒`);
  } else {
    showToast("Product not found");
  }
}

// ---- ADD MESSAGE TO CHAT ----
function addAICustomerMessage(type, content) {
  const body = document.getElementById("aiChatBody");
  if (!body) return;

  const div = document.createElement("div");
  div.className = `ai-message ai-${type}`;

  const avatar = document.createElement("div");
  avatar.className = "ai-avatar";
  avatar.textContent = type === "user" ? "👤" : "🤖";

  const bubble = document.createElement("div");
  bubble.className = "ai-bubble";

  // Convert markdown to HTML
  let html = content;
  html = html.replace(/\n/g, "<br>");
  html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");
  html = html.replace(/`(.*?)`/g, "<code>$1</code>");
  
  // Detect lists
  const lines = html.split("<br>");
  let inList = false;
  let listHtml = "";
  let finalHtml = "";
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith("- ") || line.startsWith("• ")) {
      if (!inList) {
        inList = true;
        listHtml = "<ul style='margin:4px 0;padding-left:20px;'>";
      }
      listHtml += `<li>${line.replace(/^[-•]\s*/, "")}</li>`;
    } else {
      if (inList) {
        listHtml += "</ul>";
        finalHtml += listHtml + "<br>";
        inList = false;
        listHtml = "";
      }
      if (line) finalHtml += line + "<br>";
    }
  }
  if (inList) {
    listHtml += "</ul>";
    finalHtml += listHtml;
  }
  
  html = finalHtml || html;
  bubble.innerHTML = html;

  div.appendChild(avatar);
  div.appendChild(bubble);
  body.appendChild(div);
  body.scrollTop = body.scrollHeight;
}

// ---- TYPING INDICATOR ----
function addAITypingIndicator() {
  const body = document.getElementById("aiChatBody");
  if (!body) return null;

  const div = document.createElement("div");
  div.className = "ai-message ai-bot ai-typing";
  div.id = "aiTyping-" + Date.now();

  const avatar = document.createElement("div");
  avatar.className = "ai-avatar";
  avatar.textContent = "🤖";

  const bubble = document.createElement("div");
  bubble.className = "ai-bubble";
  bubble.textContent = "Typing...";

  div.appendChild(avatar);
  div.appendChild(bubble);
  body.appendChild(div);
  body.scrollTop = body.scrollHeight;

  return div.id;
}

function removeAITypingIndicator(id) {
  if (!id) return;
  const el = document.getElementById(id);
  if (el) el.remove();
}

// ---- AUTO WELCOME ----
function showAIWelcome() {
  const body = document.getElementById("aiChatBody");
  if (!body) return;

  // Check if already has messages
  if (body.children.length > 0) return;

  const div = document.createElement("div");
  div.className = "ai-message ai-bot";

  const avatar = document.createElement("div");
  avatar.className = "ai-avatar";
  avatar.textContent = "🤖";

  const bubble = document.createElement("div");
  bubble.className = "ai-bubble";
  bubble.innerHTML = `
    <p>👋 Assalam o Alaikum! Main <strong>AKNexa AI</strong> hoon — aap ka sales assistant.</p>
    <p>Mujhe bataayein:</p>
    <ul>
      <li>🔍 <strong>Kya product dhoond rahe hain?</strong></li>
      <li>💰 <strong>Aap ka budget kya hai?</strong></li>
      <li>📚 <strong>Kis class/project ke liye chahiye?</strong></li>
    </ul>
    <p style="color:var(--muted);font-size:.85rem;">Main aap ko best product recommend karunga! 😊</p>
    <p style="font-size:.75rem;color:var(--muted);margin-top:6px;">💡 Example: "Arduino project chahiye 5000 budget mein"</p>
  `;

  div.appendChild(avatar);
  div.appendChild(bubble);
  body.appendChild(div);
}

// ---- INIT ----
document.addEventListener("DOMContentLoaded", () => {
  // Wait a bit for supabase to be ready
  setTimeout(() => {
    initAIChat();
    showAIWelcome();
  }, 500);
});

// ---- EXPOSE FUNCTIONS GLOBALLY ----
window.addToCartFromAI = addToCartFromAI;
window.openGallery = openGallery;
window.escapeHtml = escapeHtml;