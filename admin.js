/* =========================================================
   AK ELECTRONICS — ADMIN PANEL LOGIC
   Requires config.js (SITE_CONFIG) to be loaded first.
   ========================================================= */

let supabase = null;
let currentUser = null;

const CATEGORY_OPTIONS = [
  "sensors","arduino","esp","raspberry","prototyping",
  "modules","lighting","switches","soldering","connectors","safety","power"
];

function initSupabase(){
  if (!SITE_CONFIG.supabaseUrl || !SITE_CONFIG.supabaseAnonKey || !window.__createSupabaseClient){
    document.getElementById("loginMsg").textContent = "Supabase isn't configured in config.js yet.";
    return false;
  }
  supabase = window.__createSupabaseClient(SITE_CONFIG.supabaseUrl, SITE_CONFIG.supabaseAnonKey);
  return true;
}

function showScreen(name){
  document.getElementById("loginScreen").classList.toggle("hidden", name !== "login");
  document.getElementById("deniedScreen").classList.toggle("hidden", name !== "denied");
  document.getElementById("mfaScreen").classList.toggle("hidden", name !== "mfa");
  document.getElementById("dashboard").classList.toggle("hidden", name !== "dashboard");
}

let CURRENT_ROLE = "admin"; // "admin" | "products_agent" | "projects_agent"

async function logActivity(action){
  if (!currentUser) return;
  await supabase.from("activity_log").insert({ actor_email: currentUser.email, actor_role: CURRENT_ROLE, action }).select();
}

async function checkSession(){
  const { data: { user } } = await supabase.auth.getUser();
  currentUser = user || null;
  if (!currentUser){ showScreen("login"); return; }

  const email = (currentUser.email || "").toLowerCase();
  const metaRole = currentUser.user_metadata && currentUser.user_metadata.role;
  const panelMode = document.body.dataset.panel || "admin"; // "admin" or "agent"

  if (panelMode === "admin"){
    // The owner's file — ONLY the admin email may log in here, agents are rejected.
    if (email !== (SITE_CONFIG.adminEmail || "").toLowerCase()){
      showScreen("denied");
      return;
    }
    CURRENT_ROLE = "admin";

    // 2FA check — if the admin has 2FA enabled, require the code before dashboard access
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal && aal.nextLevel === "aal2" && aal.currentLevel !== "aal2"){
      showScreen("mfa");
      return;
    }
  } else {
    // The agents' file — ONLY recognized agent roles may log in here, admin is rejected.
    if (metaRole !== "products_agent" && metaRole !== "projects_agent"){
      showScreen("denied");
      return;
    }
    CURRENT_ROLE = metaRole;
  }

  applyRolePermissions();
  showScreen("dashboard");
  if (CURRENT_ROLE === "admin" || CURRENT_ROLE === "products_agent") loadProducts();
  if (CURRENT_ROLE === "admin") loadStarterKits();
  if (CURRENT_ROLE === "admin" || CURRENT_ROLE === "projects_agent") loadProjects();
  if (CURRENT_ROLE !== "admin") loadOrders(); // agents: RLS restricts to their own type automatically
  if (CURRENT_ROLE !== "admin") loadInquiries(); // agents: RLS restricts to their own type automatically
  if (CURRENT_ROLE !== "admin") loadCoupons(); // agents: RLS restricts to their own type automatically
  if (CURRENT_ROLE !== "admin") loadMessages(); // agents: RLS restricts to only forwarded messages
  if (CURRENT_ROLE === "admin"){
    loadOrders();
    loadCoupons();
    loadMessages();
    loadPosts();
    loadDashboard();
    loadInquiries();
    loadActivityLog();
    loadBundles();
    loadAdsAdmin();
    loadWebsiteLeads();
  }
}

function applyRolePermissions(){
  const allTabs = ["dashboard", "aknexa", "products", "starterkits", "projects", "orders", "coupons", "messages", "inquiries", "activitylog", "bundles", "blog", "media", "ads", "webleads"];
  let allowed = allTabs;
  if (CURRENT_ROLE === "products_agent") allowed = ["products", "orders", "inquiries", "coupons", "messages"];
  if (CURRENT_ROLE === "projects_agent") allowed = ["projects", "orders", "inquiries", "coupons", "messages"];

  document.querySelectorAll(".tab-btn").forEach(btn => {
    const show = allowed.includes(btn.dataset.tab);
    btn.style.display = show ? "" : "none";
  });
  document.querySelectorAll(".tab-panel").forEach(panel => panel.classList.add("hidden"));
  const firstAllowed = allowed[0];
  document.getElementById("tab-" + firstAllowed).classList.remove("hidden");
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.toggle("active", b.dataset.tab === firstAllowed));

  // Hide the "Get Shop Location" tool for agents — that's an owner-only setting
  const locBtn = document.getElementById("getShopLocationBtn");
  if (locBtn) locBtn.style.display = CURRENT_ROLE === "admin" ? "" : "none";
}

function wireLogin(){
  document.getElementById("adminLoginForm").addEventListener("submit", async e => {
    e.preventDefault();
    const email = document.getElementById("adminEmailInput").value.trim();
    const password = document.getElementById("adminPasswordInput").value;
    const msg = document.getElementById("loginMsg");
    msg.style.color = "var(--pink)";
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error){ msg.textContent = error.message; return; }
    msg.textContent = "";
    checkSession();
  });

  document.getElementById("logoutBtn").addEventListener("click", async () => { await supabase.auth.signOut(); showScreen("login"); });

  document.getElementById("mfaForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = document.getElementById("mfaMsg");
    const code = document.getElementById("mfaCodeInput").value.trim();
    const { data: factors } = await supabase.auth.mfa.listFactors();
    const factor = factors && factors.totp && factors.totp[0];
    if (!factor){ msg.textContent = "No 2FA factor found."; return; }
    const { data: challenge, error: challengeErr } = await supabase.auth.mfa.challenge({ factorId: factor.id });
    if (challengeErr){ msg.textContent = challengeErr.message; return; }
    const { error: verifyErr } = await supabase.auth.mfa.verify({ factorId: factor.id, challengeId: challenge.id, code });
    if (verifyErr){ msg.textContent = "Incorrect code — try again."; return; }
    checkSession();
  });
  document.getElementById("dashLogoutBtn").addEventListener("click", async () => { await supabase.auth.signOut(); showScreen("login"); });

  document.getElementById("getShopLocationBtn").addEventListener("click", () => {
    document.getElementById("shopLocationModal").classList.remove("hidden");
    document.getElementById("shopLocationModal").style.display = "flex";
  });
  document.getElementById("closeShopLocationBtn").addEventListener("click", () => {
    document.getElementById("shopLocationModal").style.display = "none";
  });
  document.getElementById("detectShopLocationBtn").addEventListener("click", () => {
    const result = document.getElementById("shopLocationResult");
    if (!navigator.geolocation){ result.textContent = "Your browser doesn't support location detection."; return; }
    result.textContent = "Detecting…";
    navigator.geolocation.getCurrentPosition((pos) => {
      const lat = pos.coords.latitude.toFixed(6);
      const lng = pos.coords.longitude.toFixed(6);
      const embedUrl = `https://www.google.com/maps?q=${lat},${lng}&output=embed`;
      result.innerHTML = `
        <p><strong>Latitude:</strong> ${lat}<br><strong>Longitude:</strong> ${lng}</p>
        <p>Paste these into <code>index.html</code>'s Schema.org "latitude"/"longitude" fields.</p>
        <p><strong>Map embed link</strong> (paste into config.js → mapEmbedUrl):<br>${embedUrl}</p>
      `;
    }, () => {
      result.textContent = "Couldn't get location — make sure location permission is allowed for this site.";
    }, { enableHighAccuracy: true, timeout: 10000 });
  });
}

function wireTabs(){
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      document.querySelectorAll(".tab-panel").forEach(p => p.classList.add("hidden"));
      document.getElementById("tab-" + btn.dataset.tab).classList.remove("hidden");
      if (btn.dataset.tab === "aknexa") initAIChat();
      if (btn.dataset.tab === "media") loadMediaGrid();
      if (btn.dataset.tab === "dashboard") loadDashboard();
      if (btn.dataset.tab === "activitylog") loadActivityLog();
      if (btn.dataset.tab === "bundles") loadBundles();
      if (btn.dataset.tab === "ads") loadAdsAdmin();
      if (btn.dataset.tab === "webleads") loadWebsiteLeads();
      if (btn.dataset.tab === "starterkits") loadStarterKits();
    });
  });
}

/* =========================================================
   AKNexa AI — BUSINESS ASSISTANT
   ========================================================= */
let aiChatHistory = [];

function initAIChat(){
  const input = document.getElementById("aiChatInput");
  const sendBtn = document.getElementById("aiChatSendBtn");
  const clearBtn = document.getElementById("clearAIChatBtn");

  if (!input || !sendBtn) return;

  // Remove old listeners to avoid duplicates
  const newInput = input.cloneNode(true);
  input.parentNode.replaceChild(newInput, input);
  const newSendBtn = sendBtn.cloneNode(true);
  sendBtn.parentNode.replaceChild(newSendBtn, sendBtn);

  const finalInput = document.getElementById("aiChatInput");
  const finalSendBtn = document.getElementById("aiChatSendBtn");

  finalSendBtn.addEventListener("click", () => sendAIMessage());
  finalInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendAIMessage();
    }
  });

  // Quick action buttons
  document.querySelectorAll("[data-ai-prompt]").forEach(btn => {
    btn.addEventListener("click", () => {
      const prompt = btn.dataset.aiPrompt;
      finalInput.value = prompt;
      sendAIMessage();
    });
  });

  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      const container = document.getElementById("aiChatMessages");
      container.innerHTML = `
        <div class="ai-message ai-bot">
          <div class="ai-avatar">🤖</div>
          <div class="ai-bubble">
            <p>Chat cleared. 👋</p>
            <p>Kya aap kuch poochna chahenge?</p>
          </div>
        </div>
      `;
      aiChatHistory = [];
    });
  }
}

async function sendAIMessage(){
  const input = document.getElementById("aiChatInput");
  const msg = input.value.trim();
  if (!msg) return;
  input.value = "";

  const container = document.getElementById("aiChatMessages");
  const status = document.getElementById("aiStatusMsg");
  if (!container) return;

  // Add user message
  addAIMessage("user", msg);
  aiChatHistory.push({ role: "user", content: msg });

  // Show typing indicator
  const typingId = addTypingIndicator();

  try {
    status.textContent = "⏳ Processing...";

    // Check if this is a business query that needs real data
    const needsData = isBusinessQuery(msg);
    let businessData = null;

    if (needsData) {
      businessData = await fetchBusinessData(msg);
    }

    // Build messages for Groq
    const groqMessages = buildGroqMessages(msg, businessData);

    // Call Groq API
    const response = await callGroqAPI(groqMessages);

    // Remove typing indicator
    removeTypingIndicator(typingId);

    // Add bot response
    const botReply = response.choices?.[0]?.message?.content || "Sorry, I couldn't process that. Please try again.";
    addAIMessage("bot", botReply);
    aiChatHistory.push({ role: "assistant", content: botReply });

    status.textContent = "✅ Done — powered by Groq";

  } catch (error) {
    removeTypingIndicator(typingId);
    addAIMessage("bot", "❌ Error: " + (error.message || "Something went wrong. Please try again."));
    status.textContent = "❌ Error occurred";
    console.error("AI Error:", error);
  }
}

function addAIMessage(type, content){
  const container = document.getElementById("aiChatMessages");
  if (!container) return;

  const div = document.createElement("div");
  div.className = `ai-message ai-${type}`;

  const avatar = document.createElement("div");
  avatar.className = "ai-avatar";
  avatar.textContent = type === "user" ? "👤" : "🤖";

  const bubble = document.createElement("div");
  bubble.className = "ai-bubble";

  // Convert markdown-like formatting to HTML
  let html = content;
  html = html.replace(/\n/g, "<br>");
  html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");
  html = html.replace(/`(.*?)`/g, "<code>$1</code>");
  
  // Simple list detection
  const lines = html.split("<br>");
  let inList = false;
  let listHtml = "";
  let finalHtml = "";
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith("- ") || line.startsWith("• ")) {
      if (!inList) {
        inList = true;
        listHtml = "<ul style='margin:4px 0; padding-left:20px;'>";
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
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function addTypingIndicator(){
  const container = document.getElementById("aiChatMessages");
  if (!container) return null;

  const div = document.createElement("div");
  div.className = "ai-message ai-bot ai-typing";
  div.id = "typingIndicator-" + Date.now();

  const avatar = document.createElement("div");
  avatar.className = "ai-avatar";
  avatar.textContent = "🤖";

  const bubble = document.createElement("div");
  bubble.className = "ai-bubble";
  bubble.textContent = "Typing";

  div.appendChild(avatar);
  div.appendChild(bubble);
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;

  return div.id;
}

function removeTypingIndicator(id){
  if (!id) return;
  const el = document.getElementById(id);
  if (el) el.remove();
}

function isBusinessQuery(msg){
  const keywords = [
    "orders", "order", "sales", "revenue", "earnings", "report",
    "stock", "low stock", "best selling", "top products",
    "aaj ke", "today", "analysis", "business", "commission",
    "delivery", "pending", "completed", "customers", "payments",
    "product", "products", "catalog", "item", "items",
    "total", "count", "kitne", "kitna", "kitni", "kaunsi", "kaunse",
    "kya hai", "batao", "dikhao", "list"
  ];
  const lower = msg.toLowerCase();
  return keywords.some(k => lower.includes(k));
}

async function fetchBusinessData(query){
  const lower = query.toLowerCase();
  const data = {};

  // Fetch all orders for analysis
  const { data: orders, error } = await supabase
    .from("orders")
    .select("*, order_items(*)")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching orders:", error);
    return data;
  }

  data.orders = orders;

  // Today's orders
  const today = new Date().toISOString().slice(0,10);
  data.todayOrders = orders.filter(o => o.created_at && o.created_at.slice(0,10) === today);
  data.todayTotal = data.todayOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);

  // Pending orders
  data.pendingOrders = orders.filter(o => o.status === "pending");
  data.pendingCount = data.pendingOrders.length;

  // Completed (delivered)
  data.completedOrders = orders.filter(o => o.status === "delivered");
  data.completedCount = data.completedOrders.length;
  data.totalRevenue = data.completedOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);

  // Best selling products
  const productMap = {};
  orders.forEach(o => {
    (o.order_items || []).forEach(item => {
      const name = item.product_name || "Unknown";
      productMap[name] = (productMap[name] || 0) + (item.quantity || 1);
    });
  });
  data.topProducts = Object.entries(productMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Low stock products
  const { data: products, error: prodErr } = await supabase
    .from("products")
    .select("name, stock")
    .in("stock", ["low", "out"])
    .limit(20);

  if (!prodErr) {
    data.lowStockProducts = products || [];
  }

  // Total products count
  const { count: totalProducts, error: countErr } = await supabase
    .from("products")
    .select("*", { count: "exact", head: true });

  if (!countErr) {
    data.totalProducts = totalProducts;
  }

  // Today's total orders count
  data.todayOrderCount = data.todayOrders.length;

  // Payment methods breakdown
  const payMethods = {};
  orders.forEach(o => {
    const method = o.payment_method || "unknown";
    payMethods[method] = (payMethods[method] || 0) + 1;
  });
  data.paymentMethods = payMethods;

  return data;
}

function buildGroqMessages(query, businessData){
  const messages = [
    { role: "system", content: SITE_CONFIG.aknexaSystemPromptAdmin || `You are AKNexa AI, the personal business assistant for AK Electronics Pro.` }
  ];

  // If we have business data, include it in the context
  if (businessData && Object.keys(businessData).length > 0) {
    let context = "Here is real business data from the database:\n\n";

    if (businessData.todayOrders) {
      context += `📊 **Today's Orders** (${businessData.todayOrderCount || 0} orders):\n`;
      context += `- Total revenue today: PKR ${(businessData.todayTotal || 0).toLocaleString()}\n\n`;
    }

    if (businessData.pendingOrders) {
      context += `⏳ **Pending Orders**: ${businessData.pendingCount || 0} orders waiting\n\n`;
    }

    if (businessData.completedOrders) {
      context += `✅ **Completed Orders**: ${businessData.completedCount || 0} delivered\n`;
      context += `- Total revenue: PKR ${(businessData.totalRevenue || 0).toLocaleString()}\n\n`;
    }

    if (businessData.topProducts && businessData.topProducts.length) {
      context += `🏆 **Top 5 Best-Selling Products**:\n`;
      businessData.topProducts.forEach((p, i) => {
        context += `  ${i+1}. ${p[0]} — ${p[1]} units\n`;
      });
      context += "\n";
    }

    if (businessData.lowStockProducts && businessData.lowStockProducts.length) {
      context += `⚠️ **Low/Out of Stock Products**:\n`;
      businessData.lowStockProducts.forEach(p => {
        context += `  - ${p.name} (${p.stock})\n`;
      });
      context += "\n";
    }

    if (businessData.totalProducts !== undefined) {
      context += `📦 **Total Products in Catalog**: ${businessData.totalProducts}\n\n`;
    }

    if (businessData.paymentMethods) {
      context += `💳 **Payment Methods Used**:\n`;
      Object.entries(businessData.paymentMethods).forEach(([method, count]) => {
        context += `  - ${method}: ${count} orders\n`;
      });
    }

    messages.push({ role: "system", content: `REAL BUSINESS DATA:\n${context}\nUse this data in your response. Never invent numbers — always use the actual data provided above.` });
  }

  // User query
  messages.push({ role: "user", content: query });

  return messages;
}

async function callGroqAPI(messages){
  // Groq key ab server-side hai (Netlify Function). Client sirf apne
  // site ke /.netlify/functions/groq-chat endpoint ko call karta hai —
  // Groq API key kabhi bhi browser mein nahi jaati.
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

/* ---------------------------------------------------------
   PRODUCTS
   --------------------------------------------------------- */
async function loadProducts(){
  const { data, error } = await supabase.from("products").select("*").eq("type", "product").order("created_at", { ascending: true });
  const body = document.getElementById("productsBody");
  if (error){ body.innerHTML = `<tr><td colspan="7">Error: ${error.message}</td></tr>`; return; }
  body.innerHTML = (data || []).map(rowHtmlProduct).join("");
  wireProductRows();
}

/* ---------------------------------------------------------
   STARTER KITS (own section, same pattern as Products minus category)
   --------------------------------------------------------- */
async function loadStarterKits(){
  const { data, error } = await supabase.from("products").select("*").eq("type", "starter_kit").order("created_at", { ascending: true });
  const body = document.getElementById("starterKitsBody");
  if (!body) return;
  if (error){ body.innerHTML = `<tr><td colspan="7">Error: ${error.message}</td></tr>`; return; }
  body.innerHTML = (data || []).map(rowHtmlStarterKit).join("");
  wireStarterKitRows();
}

function rowHtmlStarterKit(p){
  return `
    <tr data-id="${p.id}">
      <td class="name-col"><input type="text" class="f-name" value="${escapeAttr(p.name)}"></td>
      <td class="spec-col"><input type="text" class="f-spec" value="${escapeAttr(p.spec || "")}"></td>
      <td><input type="number" class="f-price" value="${p.price}" step="1"></td>
      <td>
        <select class="f-stock">
          <option value="in" ${p.stock === "in" ? "selected" : ""}>in</option>
          <option value="low" ${p.stock === "low" ? "selected" : ""}>low</option>
          <option value="out" ${p.stock === "out" ? "selected" : ""}>out</option>
        </select>
      </td>
      <td>
        <input type="text" class="f-image" value="${escapeAttr(p.image || "")}" placeholder="auto" style="margin-bottom:5px;">
        <input type="file" class="f-image-file" accept="image/*" multiple style="display:none;">
        <button type="button" class="icon-btn upload-img-btn" style="width:100%;">📤 Upload</button>
        <span class="row-msg upload-status"></span>
        <div class="current-images-strip" style="display:flex; gap:5px; flex-wrap:wrap; margin-top:6px;"></div>
      </td>
      <td><input type="text" class="f-datasheet" value="${escapeAttr(p.datasheet_url || "")}" placeholder="PDF link (optional)"></td>
      <td>
        <div class="row-actions">
          <button class="icon-btn save">Save</button>
          <button class="icon-btn delete">Delete</button>
        </div>
        <span class="row-msg"></span>
      </td>
    </tr>`;
}

function wireStarterKitRows(){
  document.querySelectorAll("#starterKitsBody tr").forEach(tr => {
    tr.querySelector(".save").addEventListener("click", () => saveStarterKitRow(tr));
    tr.querySelector(".delete").addEventListener("click", () => deleteRow(tr, "products"));
    wireImageUpload(tr);
  });
}

async function saveStarterKitRow(tr){
  const id = tr.dataset.id;
  const payload = {
    type: "starter_kit",
    name: tr.querySelector(".f-name").value.trim(),
    spec: tr.querySelector(".f-spec").value.trim(),
    price: Number(tr.querySelector(".f-price").value) || 0,
    stock: tr.querySelector(".f-stock").value,
    image: tr.querySelector(".f-image").value.trim(),
    datasheet_url: tr.querySelector(".f-datasheet").value.trim()
  };
  const msg = tr.querySelector(".row-msg");
  let error;
  if (id === "new"){
    ({ error } = await supabase.from("products").insert(payload));
    if (!error) loadStarterKits();
  } else {
    ({ error } = await supabase.from("products").update(payload).eq("id", id));
  }
  msg.style.color = error ? "var(--pink)" : "var(--cyan)";
  msg.textContent = error ? error.message : "Saved ✓";
  setTimeout(() => msg.textContent = "", 2000);
  if (!error) logActivity(`${id === "new" ? "Added" : "Updated"} starter kit "${payload.name}"`);
}

document.getElementById("addStarterKitBtn")?.addEventListener("click", () => {
  const body = document.getElementById("starterKitsBody");
  const tr = document.createElement("tr");
  tr.dataset.id = "new";
  tr.innerHTML = rowHtmlStarterKit({ id: "new", name: "", spec: "", price: 0, stock: "in", image: "" }).match(/<td[\s\S]*<\/td>/)[0];
  body.prepend(tr);
  wireStarterKitRows();
});

/* ---------------------------------------------------------
   MEDIA LIBRARY (browse/reuse/delete uploaded photos by category)
   --------------------------------------------------------- */
function initMediaLibrary(){
  const select = document.getElementById("mediaCategorySelect");
  if (!select) return;
  select.innerHTML = CATEGORY_OPTIONS.map(c => `<option value="${c}">${c}</option>`).join("");
  select.addEventListener("change", loadMediaGrid);

  const uploadBtn = document.getElementById("mediaUploadBtn");
  const fileInput = document.getElementById("mediaUploadInput");
  uploadBtn.addEventListener("click", () => fileInput.click());

  fileInput.addEventListener("change", async () => {
    const files = [...fileInput.files];
    if (!files.length) return;
    const status = document.getElementById("mediaUploadStatus");
    const category = select.value;
    status.style.color = "var(--cyan)";
    status.textContent = `Uploading ${files.length} photo${files.length > 1 ? "s" : ""}…`;
    uploadBtn.disabled = true;

    for (const file of files){
      const safeName = file.name.toLowerCase().replace(/[^a-z0-9.]+/g, "-");
      const path = `${category}/${Date.now()}-${safeName}`;
      const { error } = await supabase.storage.from("product-images").upload(path, file, { upsert: false });
      if (error){
        status.style.color = "var(--pink)";
        status.textContent = `Failed: ${error.message}`;
        uploadBtn.disabled = false;
        return;
      }
    }
    status.style.color = "var(--cyan)";
    status.textContent = "Uploaded ✓";
    uploadBtn.disabled = false;
    fileInput.value = "";
    loadMediaGrid();
  });
}

async function loadMediaGrid(){
  const select = document.getElementById("mediaCategorySelect");
  const grid = document.getElementById("mediaGrid");
  if (!select || !grid) return;
  const category = select.value;
  grid.innerHTML = `<p class="hint">Loading…</p>`;

  const { data, error } = await supabase.storage.from("product-images").list(category, { sortBy: { column: "created_at", order: "desc" } });
  if (error || !data || !data.length){
    grid.innerHTML = `<p class="hint">No photos uploaded in "${category}" yet.</p>`;
    return;
  }

  grid.innerHTML = data.map(file => {
    const path = `${category}/${file.name}`;
    const { data: pub } = supabase.storage.from("product-images").getPublicUrl(path);
    return `
      <div class="media-card" data-path="${path}">
        <img src="${pub.publicUrl}" loading="lazy">
        <span class="media-name">${file.name}</span>
        <div class="media-actions">
          <button class="icon-btn copy-media-btn" data-url="${pub.publicUrl}">Copy</button>
          <button class="icon-btn delete delete-media-btn">Delete</button>
        </div>
      </div>`;
  }).join("");

  grid.querySelectorAll(".copy-media-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      navigator.clipboard.writeText(btn.dataset.url);
      const original = btn.textContent;
      btn.textContent = "Copied ✓";
      setTimeout(() => { btn.textContent = original; }, 1200);
    });
  });
  grid.querySelectorAll(".delete-media-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("Delete this photo permanently? This can't be undone.")) return;
      const card = btn.closest(".media-card");
      const { error } = await supabase.storage.from("product-images").remove([card.dataset.path]);
      if (error){ alert(error.message); return; }
      card.remove();
    });
  });
}

/* ---------------------------------------------------------
   IMAGE UPLOAD (to Supabase Storage — no manual renaming needed)
   --------------------------------------------------------- */
function wireImageUpload(tr){
  const uploadBtn = tr.querySelector(".upload-img-btn");
  const fileInput = tr.querySelector(".f-image-file");
  const textInput = tr.querySelector(".f-image");
  const status = tr.querySelector(".upload-status");
  const strip = tr.querySelector(".current-images-strip");
  if (!uploadBtn) return;

  function renderStrip(){
    if (!strip) return;
    const urls = textInput.value.split(",").map(s => s.trim()).filter(Boolean);
    strip.innerHTML = urls.map((url, i) => `
      <div style="position:relative; width:52px; height:52px;">
        <img src="${url.startsWith("http") ? url : "images/" + url}" style="width:100%; height:100%; object-fit:cover; border-radius:6px; border:1px solid var(--line);" onerror="this.style.opacity='0.15'">
        <button type="button" class="remove-img-btn" data-idx="${i}" title="Remove this image" style="position:absolute; top:-6px; right:-6px; width:18px; height:18px; border-radius:50%; background:var(--pink); color:#fff; border:none; font-size:.65rem; line-height:1; cursor:pointer;">✕</button>
      </div>
    `).join("");
    strip.querySelectorAll(".remove-img-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const urls = textInput.value.split(",").map(s => s.trim()).filter(Boolean);
        urls.splice(Number(btn.dataset.idx), 1);
        textInput.value = urls.join(",");
        status.style.color = "var(--cyan)";
        status.textContent = "Image removed — remember to click Save";
        renderStrip();
      });
    });
  }
  renderStrip();

  uploadBtn.addEventListener("click", () => fileInput.click());

  fileInput.addEventListener("change", async () => {
    const files = [...fileInput.files];
    if (!files.length) return;
    status.style.color = "var(--cyan)";
    status.textContent = `Uploading ${files.length} image${files.length > 1 ? "s" : ""}…`;
    uploadBtn.disabled = true;

    const uploadedUrls = [];
    for (const file of files){
      const safeName = file.name.toLowerCase().replace(/[^a-z0-9.]+/g, "-");
      const path = `${Date.now()}-${safeName}`;
      const { error } = await supabase.storage.from("product-images").upload(path, file, { upsert: false });
      if (error){
        status.style.color = "var(--pink)";
        status.textContent = `Failed: ${error.message}`;
        uploadBtn.disabled = false;
        return;
      }
      const { data: pub } = supabase.storage.from("product-images").getPublicUrl(path);
      uploadedUrls.push(pub.publicUrl);
    }

    const existing = textInput.value.trim();
    textInput.value = existing ? `${existing},${uploadedUrls.join(",")}` : uploadedUrls.join(",");
    renderStrip();

    status.style.color = "var(--cyan)";
    status.textContent = `Uploaded ✓ — remember to click Save`;
    uploadBtn.disabled = false;
    fileInput.value = "";
  });
}

function rowHtmlProduct(p){
  const catOptions = CATEGORY_OPTIONS.map(c => `<option value="${c}" ${p.category === c ? "selected" : ""}>${c}</option>`).join("");
  return `
    <tr data-id="${p.id}">
      <td class="name-col"><input type="text" class="f-name" value="${escapeAttr(p.name)}"></td>
      <td><select class="f-category">${catOptions}</select></td>
      <td class="spec-col"><input type="text" class="f-spec" value="${escapeAttr(p.spec || "")}"></td>
      <td><input type="number" class="f-price" value="${p.price}" step="1"></td>
      <td>
        <select class="f-stock">
          <option value="in" ${p.stock === "in" ? "selected" : ""}>in</option>
          <option value="low" ${p.stock === "low" ? "selected" : ""}>low</option>
          <option value="out" ${p.stock === "out" ? "selected" : ""}>out</option>
        </select>
      </td>
      <td>
        <input type="text" class="f-image" value="${escapeAttr(p.image || "")}" placeholder="auto" style="margin-bottom:5px;">
        <input type="file" class="f-image-file" accept="image/*" multiple style="display:none;">
        <button type="button" class="icon-btn upload-img-btn" style="width:100%;">📤 Upload</button>
        <span class="row-msg upload-status"></span>
        <div class="current-images-strip" style="display:flex; gap:5px; flex-wrap:wrap; margin-top:6px;"></div>
      </td>
      <td><input type="text" class="f-datasheet" value="${escapeAttr(p.datasheet_url || "")}" placeholder="PDF link (optional)"></td>
      <td>
        <div class="row-actions">
          <button class="icon-btn save">Save</button>
          <button class="icon-btn delete">Delete</button>
        </div>
        <button type="button" class="icon-btn view-waiting" style="margin-top:4px; width:100%;" data-product-id="${p.id}" data-product-name="${escapeAttr(p.name)}">🔔 Waiting list</button>
        <span class="row-msg"></span>
      </td>
    </tr>`;
}

function wireProductRows(){
  document.querySelectorAll("#productsBody tr").forEach(tr => {
    tr.querySelector(".save").addEventListener("click", () => saveProductRow(tr));
    tr.querySelector(".delete").addEventListener("click", () => deleteRow(tr, "products"));
    wireImageUpload(tr);
    const waitBtn = tr.querySelector(".view-waiting");
    if (waitBtn) waitBtn.addEventListener("click", () => viewWaitingList(waitBtn.dataset.productId, waitBtn.dataset.productName));
  });
}

async function viewWaitingList(productId, productName){
  const { data, error } = await supabase.from("restock_notifications").select("id, email").eq("product_id", productId).eq("notified", false);
  if (error){ alert(error.message); return; }
  if (!data || !data.length){ alert(`No one is waiting for "${productName}" right now.`); return; }
  const emails = data.map(d => d.email).join(", ");
  if (confirm(`${data.length} people waiting for "${productName}":\n\n${emails}\n\nCopy these emails to clipboard?`)){
    navigator.clipboard.writeText(emails);
  }
  if (confirm(`Already contacted everyone? Click OK to clear this waiting list (delete these ${data.length} entries).`)){
    const ids = data.map(d => d.id);
    await supabase.from("restock_notifications").delete().in("id", ids);
    alert("Waiting list cleared ✓");
  }
}

async function saveProductRow(tr){
  const id = tr.dataset.id;
  const payload = {
    name: tr.querySelector(".f-name").value.trim(),
    category: tr.querySelector(".f-category").value,
    spec: tr.querySelector(".f-spec").value.trim(),
    price: Number(tr.querySelector(".f-price").value) || 0,
    stock: tr.querySelector(".f-stock").value,
    image: tr.querySelector(".f-image").value.trim(),
    datasheet_url: tr.querySelector(".f-datasheet").value.trim()
  };
  const msg = tr.querySelector(".row-msg");
  let error;
  if (id === "new"){
    ({ error } = await supabase.from("products").insert({ ...payload, type: "product" }));
    if (!error) loadProducts();
  } else {
    ({ error } = await supabase.from("products").update(payload).eq("id", id));
  }
  msg.style.color = error ? "var(--pink)" : "var(--cyan)";
  msg.textContent = error ? error.message : "Saved ✓";
  setTimeout(() => msg.textContent = "", 2000);
  if (!error) logActivity(`${id === "new" ? "Added" : "Updated"} product "${payload.name}"`);

  if (!error && (payload.stock === "low" || payload.stock === "out") && SITE_CONFIG.web3formsAccessKey){
    fetch("https://api.web3forms.com/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({
        access_key: SITE_CONFIG.web3formsAccessKey,
        subject: `⚠️ ${payload.stock === "out" ? "Out of stock" : "Low stock"}: ${payload.name}`,
        from_name: "Stock Alert",
        email: SITE_CONFIG.email,
        message: `${payload.name} is now marked as "${payload.stock}". Consider restocking soon.`
      })
    }).catch(() => {});
  }
}

document.getElementById("exportOrdersBtn")?.addEventListener("click", async () => {
  const { data, error } = await supabase.from("orders").select("*, order_items(*)").order("created_at", { ascending: false });
  if (error || !data || !data.length){ alert("No orders to export."); return; }

  const rows = data.map(o => ({
    "Order ID": o.id,
    "Date": new Date(o.created_at).toLocaleDateString(),
    "Customer": o.customer_name,
    "Phone": o.phone,
    "Email": o.customer_email || "",
    "Address": o.address,
    "City": o.delivery_city || "",
    "Items": (o.order_items || []).map(i => `${i.product_name} x${i.quantity}`).join(", "),
    "Payment Method": o.payment_method,
    "Transaction ID": o.transaction_id || "",
    "Payment Status": o.payment_status || "unpaid",
    "Delivery Charge": o.delivery_charge || 0,
    "Discount": o.discount_amount || 0,
    "Points Redeemed": o.points_redeemed || 0,
    "Total": o.total,
    "Order Status": o.status
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Orders");
  XLSX.writeFile(wb, `AK-Electronics-Orders-${new Date().toISOString().slice(0,10)}.xlsx`);
});

document.getElementById("bulkImportBtn")?.addEventListener("click", () => document.getElementById("bulkImportInput").click());
document.getElementById("bulkImportInput")?.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const status = document.getElementById("bulkImportStatus");
  status.style.color = "var(--cyan)";
  status.textContent = "Reading file…";

  const reader = new FileReader();
  reader.onload = async (ev) => {
    try {
      const wb = XLSX.read(ev.target.result, { type: "binary" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet);
      if (!rows.length){ status.style.color = "var(--pink)"; status.textContent = "No rows found in file."; return; }

      const payload = rows.map(r => ({
        type: "product",
        name: String(r.Name || r.name || "").trim(),
        category: String(r.Category || r.category || CATEGORY_OPTIONS[0]).trim(),
        spec: String(r.Spec || r.spec || "").trim(),
        price: Number(r.Price || r.price || 0),
        stock: String(r.Stock || r.stock || "in").trim(),
        image: String(r.Image || r.image || "").trim(),
        datasheet_url: String(r.Datasheet || r.datasheet || "").trim()
      })).filter(p => p.name);

      if (!payload.length){ status.style.color = "var(--pink)"; status.textContent = "No valid rows (Name column missing?)."; return; }

      status.textContent = `Importing ${payload.length} products…`;
      const { error } = await supabase.from("products").insert(payload);
      if (error){ status.style.color = "var(--pink)"; status.textContent = error.message; return; }

      status.style.color = "var(--cyan)";
      status.textContent = `Imported ${payload.length} products ✓`;
      loadProducts();
    } catch (err){
      status.style.color = "var(--pink)";
      status.textContent = "Couldn't read file — make sure it's a valid Excel/CSV file.";
    }
    e.target.value = "";
  };
  reader.readAsBinaryString(file);
});

document.getElementById("addProductBtn")?.addEventListener("click", () => {
  const body = document.getElementById("productsBody");
  const tr = document.createElement("tr");
  tr.dataset.id = "new";
  tr.innerHTML = rowHtmlProduct({ id: "new", name: "", category: CATEGORY_OPTIONS[0], spec: "", price: 0, stock: "in", image: "" }).match(/<td[\s\S]*<\/td>/)[0];
  body.prepend(tr);
  wireProductRows();
});

/* ---------------------------------------------------------
   PROJECTS (exhibition, same table with type = 'project')
   --------------------------------------------------------- */
async function loadProjects(){
  const { data, error } = await supabase.from("products").select("*").eq("type", "project").order("created_at", { ascending: true });
  const body = document.getElementById("projectsBody");
  if (error){ body.innerHTML = `<tr><td colspan="5">Error: ${error.message}</td></tr>`; return; }
  body.innerHTML = (data || []).map(rowHtmlProject).join("");
  wireProjectRows();
}

function rowHtmlProject(p){
  return `
    <tr data-id="${p.id}">
      <td class="name-col"><input type="text" class="f-name" value="${escapeAttr(p.name)}"></td>
      <td class="spec-col"><input type="text" class="f-spec" value="${escapeAttr(p.spec || "")}"></td>
      <td><input type="number" class="f-price" value="${p.price}" step="1"></td>
      <td>
        <input type="text" class="f-image" value="${escapeAttr(p.image || "")}" placeholder="auto" style="margin-bottom:5px;">
        <input type="file" class="f-image-file" accept="image/*" multiple style="display:none;">
        <button type="button" class="icon-btn upload-img-btn" style="width:100%;">📤 Upload</button>
        <span class="row-msg upload-status"></span>
        <div class="current-images-strip" style="display:flex; gap:5px; flex-wrap:wrap; margin-top:6px;"></div>
      </td>
      <td><input type="text" class="f-datasheet" value="${escapeAttr(p.datasheet_url || "")}" placeholder="PDF link (optional)"></td>
      <td>
        <div class="row-actions">
          <button class="icon-btn save">Save</button>
          <button class="icon-btn delete">Delete</button>
        </div>
        <span class="row-msg"></span>
      </td>
    </tr>`;
}

function wireProjectRows(){
  document.querySelectorAll("#projectsBody tr").forEach(tr => {
    tr.querySelector(".save").addEventListener("click", () => saveProjectRow(tr));
    tr.querySelector(".delete").addEventListener("click", () => deleteRow(tr, "products"));
    wireImageUpload(tr);
  });
}

async function saveProjectRow(tr){
  const id = tr.dataset.id;
  const payload = {
    name: tr.querySelector(".f-name").value.trim(),
    spec: tr.querySelector(".f-spec").value.trim(),
    price: Number(tr.querySelector(".f-price").value) || 0,
    image: tr.querySelector(".f-image").value.trim(),
    datasheet_url: tr.querySelector(".f-datasheet").value.trim()
  };
  const msg = tr.querySelector(".row-msg");
  let error;
  if (id === "new"){
    ({ error } = await supabase.from("products").insert({ ...payload, type: "project", stock: "in" }));
    if (!error) loadProjects();
  } else {
    ({ error } = await supabase.from("products").update(payload).eq("id", id));
  }
  msg.style.color = error ? "var(--pink)" : "var(--cyan)";
  msg.textContent = error ? error.message : "Saved ✓";
  setTimeout(() => msg.textContent = "", 2000);
  if (!error) logActivity(`${id === "new" ? "Added" : "Updated"} project "${payload.name}"`);
}

document.getElementById("addProjectBtn")?.addEventListener("click", () => {
  const body = document.getElementById("projectsBody");
  const tr = document.createElement("tr");
  tr.dataset.id = "new";
  tr.innerHTML = rowHtmlProject({ id: "new", name: "", spec: "", price: 0, image: "" }).match(/<td[\s\S]*<\/td>/)[0];
  body.prepend(tr);
  wireProjectRows();
});

/* ---------------------------------------------------------
   SHARED: delete + escape
   --------------------------------------------------------- */
async function deleteRow(tr, table){
  if (tr.dataset.id === "new"){ tr.remove(); return; }
  if (!confirm("Delete this item permanently?")) return;
  const { error } = await supabase.from(table).delete().eq("id", tr.dataset.id);
  if (error){ alert(error.message); return; }
  logActivity(`Deleted a row from ${table}`);
  tr.remove();
}

function escapeAttr(str){
  return String(str).replace(/[&<>"']/g, s => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[s]));
}

/* ---------------------------------------------------------
   ORDERS
   --------------------------------------------------------- */
async function loadOrders(){
  const body = document.getElementById("ordersBody");
  const { data, error } = await supabase
    .from("orders")
    .select("*, order_items(*)")
    .order("created_at", { ascending: false });
  if (error){ body.innerHTML = `<tr><td colspan="8">Error: ${error.message}</td></tr>`; return; }
  if (!data || !data.length){ body.innerHTML = `<tr><td colspan="8">No orders yet.</td></tr>`; return; }

  body.innerHTML = data.map(o => {
    const itemsText = (o.order_items || []).map(i => `${i.product_name} x${i.quantity}`).join(", ");
    const statuses = ["pending","confirmed","shipped","delivered","cancelled"];
    const options = statuses.map(s => `<option value="${s}" ${o.status === s ? "selected" : ""}>${s}</option>`).join("");
    const payStatuses = ["unpaid","paid"];
    const payOptions = payStatuses.map(s => `<option value="${s}" ${(o.payment_status || "unpaid") === s ? "selected" : ""}>${s}</option>`).join("");
    const waLink = o.phone ? `https://wa.me/${o.phone.replace(/[^0-9]/g, "")}` : null;
    return `
      <tr data-id="${o.id}" data-phone="${escapeAttr(o.phone || "")}" data-customer="${escapeAttr(o.customer_name || "")}">
        <td class="order-id">#${o.id.slice(0,8)}<br>${new Date(o.created_at).toLocaleDateString()}</td>
        <td>${escapeAttr(o.customer_name || "")}<br><span style="color:var(--muted)">${escapeAttr(o.phone || "")}</span>
          <div style="display:flex; gap:6px; margin-top:4px;">
            ${waLink ? `<a href="${waLink}" target="_blank" rel="noopener" style="color:var(--cyan); font-size:.72rem;">WhatsApp</a>` : ""}
            ${o.customer_email ? `<a href="mailto:${escapeAttr(o.customer_email)}" style="color:var(--cyan); font-size:.72rem;">Email</a>` : ""}
          </div>
        </td>
        <td style="max-width:200px;">${escapeAttr(o.address || "")}${(o.latitude && o.longitude) ? `<br><a href="https://www.google.com/maps?q=${o.latitude},${o.longitude}" target="_blank" rel="noopener" style="color:var(--cyan);">📍 View on Map</a>` : ""}</td>
        <td class="order-items-list">${escapeAttr(itemsText)}</td>
        <td>${SITE_CONFIG.currency} ${Number(o.total || 0).toLocaleString("en-PK")}</td>
        <td>${escapeAttr(o.payment_method || "")}${o.transaction_id ? "<br>txn: " + escapeAttr(o.transaction_id) : ""}</td>
        <td>
          <select class="f-pay-status">${payOptions}</select>
          <span class="row-msg pay-msg"></span>
        </td>
        <td>
          <select class="f-status status-${o.status}">${options}</select>
          <span class="row-msg"></span>
          <button type="button" class="icon-btn packing-slip-btn" style="width:100%; margin-top:4px;" data-order-short="${o.id.slice(0,8)}" data-customer="${escapeAttr(o.customer_name || "")}" data-total="${o.total || 0}" data-items='${JSON.stringify((o.order_items || []).map(i => ({ n: i.product_name, q: i.quantity })))}'>🖨 Packing Slip</button>
          ${(o.status === "delivered" || o.status === "cancelled") ? `<button type="button" class="icon-btn delete delete-order-btn" style="width:100%; margin-top:4px;">Delete Order</button>` : ""}
        </td>
      </tr>`;
  }).join("");

  document.querySelectorAll("#ordersBody tr").forEach(tr => {
    const payMsg = tr.querySelector(".pay-msg");
    tr.querySelector(".f-pay-status").addEventListener("change", async (e) => {
      const id = tr.dataset.id;
      const { error } = await supabase.from("orders").update({ payment_status: e.target.value }).eq("id", id);
      payMsg.style.color = error ? "var(--pink)" : "var(--cyan)";
      payMsg.textContent = error ? error.message : "Saved ✓";
      setTimeout(() => { payMsg.textContent = ""; }, 1500);
    });
    const select = tr.querySelector(".f-status");
    select.addEventListener("change", async () => {
      const id = tr.dataset.id;
      const msg = tr.querySelector(".row-msg");
      const newStatus = select.value;
      const { error } = await supabase.from("orders").update({ status: newStatus }).eq("id", id);
      select.className = "f-status status-" + newStatus;
      msg.style.color = error ? "var(--pink)" : "var(--cyan)";
      msg.textContent = error ? error.message : "Updated ✓";
      setTimeout(() => msg.textContent = "", 2000);
      if (!error) logActivity(`Changed order #${id.slice(0,8)} status to "${newStatus}"`);

      // Open a pre-filled WhatsApp message for shipped/delivered updates —
      // one click to send, saves typing the same update every time.
      if (!error && (newStatus === "shipped" || newStatus === "delivered") && tr.dataset.phone){
        const statusText = newStatus === "shipped" ? "on its way to you 🚚" : "delivered ✅";
        const waMsg = `Hi ${tr.dataset.customer}, your order #${id.slice(0,8)} from ${SITE_CONFIG.shopName} is ${statusText}. Thank you for shopping with us!`;
        const waLink = `https://wa.me/${tr.dataset.phone.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(waMsg)}`;
        window.open(waLink, "_blank");
      }
    });
    const slipBtn = tr.querySelector(".packing-slip-btn");
    if (slipBtn) slipBtn.addEventListener("click", () => generatePackingSlip(slipBtn));
    const deleteOrderBtn = tr.querySelector(".delete-order-btn");
    if (deleteOrderBtn) deleteOrderBtn.addEventListener("click", async () => {
      if (!confirm("Delete this order permanently? This can't be undone.")) return;
      const { error } = await supabase.from("orders").delete().eq("id", tr.dataset.id);
      if (error){ alert(error.message); return; }
      logActivity(`Deleted order #${tr.dataset.id.slice(0,8)}`);
      tr.remove();
    });
  });
}

function generatePackingSlip(btn){
  if (typeof window.jspdf === "undefined"){ alert("PDF library didn't load — check your internet connection."); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const items = JSON.parse(btn.dataset.items || "[]");

  doc.setFontSize(15);
  doc.text("PACKING SLIP", 14, 18);
  doc.setFontSize(10);
  doc.text(`Order #${btn.dataset.orderShort}`, 14, 26);
  doc.text(`Customer: ${btn.dataset.customer}`, 14, 32);
  doc.text(`Printed: ${new Date().toLocaleString()}`, 14, 38);

  let y = 52;
  doc.setFontSize(11);
  doc.text("Item", 14, y);
  doc.text("Qty", 170, y);
  y += 4;
  doc.line(14, y, 196, y);
  y += 8;
  doc.setFontSize(10);
  items.forEach(i => {
    doc.text(String(i.n).slice(0, 60), 14, y);
    doc.text(String(i.q), 170, y);
    y += 8;
  });

  y += 4;
  doc.line(14, y, 196, y);
  y += 10;
  doc.setFontSize(13);
  doc.text(`Total: ${SITE_CONFIG.currency} ${Number(btn.dataset.total || 0).toLocaleString("en-PK")}`, 14, y);

  doc.save(`Packing-Slip-${btn.dataset.orderShort}.pdf`);
}

document.getElementById("refreshOrdersBtn")?.addEventListener("click", loadOrders);
document.getElementById("refreshDashboardBtn")?.addEventListener("click", loadDashboard);
document.getElementById("saveCommissionBtn")?.addEventListener("click", async () => {
  const msg = document.getElementById("commissionMsg");
  const value = document.getElementById("commissionPercentInput").value;
  const { error } = await supabase.from("settings").upsert({ key: "commission_percent", value: String(value) });
  msg.style.color = error ? "var(--pink)" : "var(--cyan)";
  msg.textContent = error ? error.message : "Saved ✓";
  if (!error) loadDashboard();
});

document.getElementById("saveDeliveryBtn")?.addEventListener("click", async () => {
  const msg = document.getElementById("deliveryMsg");
  const lahoreVal = document.getElementById("deliveryLahoreInput").value;
  const otherVal = document.getElementById("deliveryOtherInput").value;
  const { error: e1 } = await supabase.from("settings").upsert({ key: "delivery_charge_lahore", value: String(lahoreVal) });
  const { error: e2 } = await supabase.from("settings").upsert({ key: "delivery_charge_other", value: String(otherVal) });
  const error = e1 || e2;
  msg.style.color = error ? "var(--pink)" : "var(--cyan)";
  msg.textContent = error ? error.message : "Saved ✓";
});

async function loadDeliverySettingsIntoDashboard(){
  const lahoreInput = document.getElementById("deliveryLahoreInput");
  if (!lahoreInput) return;
  const { data } = await supabase.from("settings").select("*").in("key", ["delivery_charge_lahore", "delivery_charge_other"]);
  (data || []).forEach(row => {
    if (row.key === "delivery_charge_lahore") document.getElementById("deliveryLahoreInput").value = row.value;
    if (row.key === "delivery_charge_other") document.getElementById("deliveryOtherInput").value = row.value;
  });
}

document.getElementById("refreshInquiriesBtn")?.addEventListener("click", loadInquiries);
document.getElementById("refreshWebLeadsBtn")?.addEventListener("click", loadWebsiteLeads);

async function loadWebsiteLeads(){
  const body = document.getElementById("webLeadsBody");
  if (!body) return;
  const { data, error } = await supabase.from("website_inquiries").select("*").order("created_at", { ascending: false });
  if (error){ body.innerHTML = `<tr><td colspan="6">Error: ${error.message}</td></tr>`; return; }
  if (!data || !data.length){ body.innerHTML = `<tr><td colspan="6">No leads yet.</td></tr>`; return; }

  body.innerHTML = data.map(l => `
    <tr data-id="${l.id}">
      <td>${escapeAttr(l.name)}</td>
      <td><a href="https://wa.me/${(l.phone || "").replace(/[^0-9]/g, "")}" target="_blank" rel="noopener" style="color:var(--cyan);">${escapeAttr(l.phone)}</a></td>
      <td style="max-width:300px;">${escapeAttr(l.message)}</td>
      <td>${new Date(l.created_at).toLocaleDateString()}</td>
      <td><input type="checkbox" class="f-lead-resolved" ${l.resolved ? "checked" : ""}></td>
      <td><button class="icon-btn delete">Delete</button></td>
    </tr>`).join("");

  document.querySelectorAll("#webLeadsBody tr").forEach(tr => {
    tr.querySelector(".f-lead-resolved").addEventListener("change", async (e) => {
      await supabase.from("website_inquiries").update({ resolved: e.target.checked }).eq("id", tr.dataset.id);
    });
    tr.querySelector(".delete").addEventListener("click", () => deleteRow(tr, "website_inquiries"));
  });
}
document.getElementById("refreshActivityLogBtn")?.addEventListener("click", loadActivityLog);

let ALL_PRODUCTS_FOR_BUNDLES = [];
async function loadBundles(){
  const body = document.getElementById("bundlesBody");
  if (!body) return;

  const { data: products } = await supabase.from("products").select("id,name,price").eq("type", "product").order("name");
  ALL_PRODUCTS_FOR_BUNDLES = products || [];

  const { data, error } = await supabase.from("bundles").select("*").order("created_at", { ascending: false });
  if (error){ body.innerHTML = `<p class="hint">Error: ${error.message}</p>`; return; }

  body.innerHTML = (data || []).map(b => bundleCardHtml(b)).join("") || `<p class="hint">No bundles yet — add one above.</p>`;
  wireBundleCards();
}

function bundleCardHtml(b){
  const options = ALL_PRODUCTS_FOR_BUNDLES.map(p =>
    `<option value="${p.id}" ${(b.product_ids || []).includes(p.id) ? "selected" : ""}>${escapeAttr(p.name)} (${SITE_CONFIG.currency} ${p.price})</option>`
  ).join("");
  return `
    <div class="card" data-id="${b.id}" style="background:var(--panel); border:1px solid var(--line); border-radius:12px; padding:18px;">
      <input type="text" class="f-bundle-name" value="${escapeAttr(b.name || "")}" placeholder="Bundle name" style="width:100%; margin-bottom:8px; font-weight:700;">
      <textarea class="f-bundle-desc" placeholder="Short description" style="width:100%; margin-bottom:8px;" rows="2">${escapeAttr(b.description || "")}</textarea>
      <label style="font-size:.78rem; color:var(--muted);">Select 2+ products (Ctrl/Cmd+click for multiple)</label>
      <select class="f-bundle-products" multiple size="5" style="width:100%; margin:6px 0 10px;">${options}</select>
      <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
        <label style="font-size:.78rem; color:var(--muted);">Bundle Price</label>
        <input type="number" class="f-bundle-price" value="${b.bundle_price || 0}" style="width:120px;">
        <label style="display:flex; align-items:center; gap:5px; font-size:.82rem;"><input type="checkbox" class="f-bundle-active" ${b.active !== false ? "checked" : ""}> Active</label>
        <button class="icon-btn save">Save</button>
        <button class="icon-btn delete">Delete</button>
        <span class="row-msg"></span>
      </div>
    </div>`;
}

function wireBundleCards(){
  document.querySelectorAll("#bundlesBody [data-id]").forEach(card => {
    card.querySelector(".save").addEventListener("click", async () => {
      const id = card.dataset.id;
      const selected = [...card.querySelector(".f-bundle-products").selectedOptions].map(o => o.value);
      const payload = {
        name: card.querySelector(".f-bundle-name").value.trim(),
        description: card.querySelector(".f-bundle-desc").value.trim(),
        product_ids: selected,
        bundle_price: Number(card.querySelector(".f-bundle-price").value) || 0,
        active: card.querySelector(".f-bundle-active").checked
      };
      const msg = card.querySelector(".row-msg");
      let error;
      if (id === "new"){
        ({ error } = await supabase.from("bundles").insert(payload));
        if (!error) loadBundles();
      } else {
        ({ error } = await supabase.from("bundles").update(payload).eq("id", id));
      }
      msg.style.color = error ? "var(--pink)" : "var(--cyan)";
      msg.textContent = error ? error.message : "Saved ✓";
      if (!error) logActivity(`${id === "new" ? "Added" : "Updated"} bundle "${payload.name}"`);
      setTimeout(() => msg.textContent = "", 2000);
    });
    card.querySelector(".delete").addEventListener("click", async () => {
      if (card.dataset.id === "new"){ card.remove(); return; }
      if (!confirm("Delete this bundle?")) return;
      await supabase.from("bundles").delete().eq("id", card.dataset.id);
      card.remove();
    });
  });
}

function renderAdCard(ad, containerId){
  return `
    <div class="card" data-id="${ad.id}" style="background:var(--panel); border:1px solid var(--line); border-radius:12px; padding:14px; display:flex; gap:14px; align-items:center;">
      ${ad.media_type === "video"
        ? `<video src="${ad.media_url}" style="width:120px; height:70px; object-fit:contain; background:#000; border-radius:8px;" muted></video>`
        : `<img src="${ad.media_url}" style="width:120px; height:70px; object-fit:contain; background:#000; border-radius:8px;">`}
      <div style="flex:1;">
        <span style="font-size:.72rem; color:var(--muted); text-transform:uppercase;">${ad.media_type}</span>
        <div style="display:flex; align-items:center; gap:10px; margin-top:6px;">
          <label style="display:flex; align-items:center; gap:5px; font-size:.82rem;">
            <input type="checkbox" class="f-ad-active" ${ad.active ? "checked" : ""}> Active
          </label>
          <button class="icon-btn delete">Delete</button>
          <span class="row-msg"></span>
        </div>
      </div>
    </div>`;
}

function wireAdCards(containerId, reload){
  document.querySelectorAll(`#${containerId} [data-id]`).forEach(card => {
    card.querySelector(".f-ad-active").addEventListener("change", async (e) => {
      await supabase.from("ads").update({ active: e.target.checked }).eq("id", card.dataset.id);
    });
    card.querySelector(".delete").addEventListener("click", async () => {
      if (!confirm("Delete this ad?")) return;
      await supabase.from("ads").delete().eq("id", card.dataset.id);
      card.remove();
    });
  });
}

async function loadAdsAdmin(){
  const zones = [
    { placement: "splash", containerId: "adsSplashBody" },
    { placement: "mid", containerId: "adsMidBody" },
    { placement: "starterkit", containerId: "adsKitBody" }
  ];
  for (const zone of zones){
    const body = document.getElementById(zone.containerId);
    if (!body) continue;
    const { data, error } = await supabase.from("ads").select("*").eq("placement", zone.placement).order("created_at", { ascending: false });
    if (error){ body.innerHTML = `<p class="hint">Error: ${error.message}</p>`; continue; }
    if (!data || !data.length){ body.innerHTML = `<p class="hint">Nothing uploaded yet.</p>`; continue; }
    body.innerHTML = data.map(ad => renderAdCard(ad, zone.containerId)).join("");
    wireAdCards(zone.containerId, loadAdsAdmin);
  }
}

async function uploadAdMedia(file, mediaType, placement, statusId){
  const status = document.getElementById(statusId);
  const limit = placement === "splash" ? 1 : 4;
  const { data: existing } = await supabase.from("ads").select("id").eq("placement", placement);
  if (existing && existing.length >= limit){
    status.style.color = "var(--pink)";
    status.textContent = placement === "splash"
      ? "A splash video already exists — delete it first to replace."
      : `You already have ${limit} — delete one first.`;
    return;
  }

  status.style.color = "var(--cyan)";
  status.textContent = "Uploading…";
  const safeName = file.name.toLowerCase().replace(/[^a-z0-9.]+/g, "-");
  const path = `${Date.now()}-${safeName}`;
  const { error: uploadErr } = await supabase.storage.from("ads-media").upload(path, file);
  if (uploadErr){ status.style.color = "var(--pink)"; status.textContent = uploadErr.message; return; }
  const { data: pub } = supabase.storage.from("ads-media").getPublicUrl(path);
  const { error: insertErr } = await supabase.from("ads").insert({ media_url: pub.publicUrl, media_type: mediaType, placement, active: true });
  if (insertErr){ status.style.color = "var(--pink)"; status.textContent = insertErr.message; return; }

  status.style.color = "var(--cyan)";
  status.textContent = "Uploaded ✓";
  loadAdsAdmin();
}

document.getElementById("adSplashVideoBtn")?.addEventListener("click", () => document.getElementById("adSplashVideoInput").click());
document.getElementById("adSplashVideoInput")?.addEventListener("change", (e) => {
  if (e.target.files[0]) uploadAdMedia(e.target.files[0], "video", "splash", "adSplashStatus");
  e.target.value = "";
});

document.getElementById("adMidImageBtn")?.addEventListener("click", () => document.getElementById("adMidImageInput").click());
document.getElementById("adMidImageInput")?.addEventListener("change", (e) => {
  if (e.target.files[0]) uploadAdMedia(e.target.files[0], "image", "mid", "adMidStatus");
  e.target.value = "";
});

document.getElementById("adKitImageBtn")?.addEventListener("click", () => document.getElementById("adKitImageInput").click());
document.getElementById("adKitImageInput")?.addEventListener("change", (e) => {
  if (e.target.files[0]) uploadAdMedia(e.target.files[0], "image", "starterkit", "adKitStatus");
  e.target.value = "";
});

document.getElementById("addBundleBtn")?.addEventListener("click", () => {
  const body = document.getElementById("bundlesBody");
  const wrap = document.createElement("div");
  wrap.innerHTML = bundleCardHtml({ id: "new", name: "", description: "", product_ids: [], bundle_price: 0, active: true });
  body.prepend(wrap.firstElementChild);
  wireBundleCards();
});

async function loadActivityLog(){
  const body = document.getElementById("activityLogBody");
  if (!body) return;
  const { data, error } = await supabase.from("activity_log").select("*").order("created_at", { ascending: false }).limit(200);
  if (error){ body.innerHTML = `<tr><td colspan="3">Error: ${error.message}</td></tr>`; return; }
  if (!data || !data.length){ body.innerHTML = `<tr><td colspan="3">No activity yet.</td></tr>`; return; }
  body.innerHTML = data.map(a => `
    <tr>
      <td>${new Date(a.created_at).toLocaleString()}</td>
      <td>${escapeAttr(a.actor_email || "")}<br><span style="color:var(--muted); font-size:.72rem;">${escapeAttr(a.actor_role || "")}</span></td>
      <td>${escapeAttr(a.action)}</td>
    </tr>`).join("");
}

async function loadInquiries(){
  const body = document.getElementById("inquiriesBody");
  if (!body) return;
  const { data, error } = await supabase.from("custom_inquiries").select("*").order("created_at", { ascending: false });
  if (error){ body.innerHTML = `<tr><td colspan="7">Error: ${error.message}</td></tr>`; return; }
  if (!data || !data.length){ body.innerHTML = `<tr><td colspan="7">No inquiries yet.</td></tr>`; return; }

  body.innerHTML = data.map(i => `
    <tr data-id="${i.id}">
      <td>${escapeAttr(i.type)}</td>
      <td>${escapeAttr(i.name || "—")}</td>
      <td><a href="https://wa.me/${(i.phone || "").replace(/[^0-9]/g, "")}" target="_blank" rel="noopener" style="color:var(--cyan);">${escapeAttr(i.phone || "")}</a></td>
      <td style="max-width:280px;">${escapeAttr(i.message || "")}</td>
      <td>${new Date(i.created_at).toLocaleDateString()}</td>
      <td><input type="checkbox" class="f-resolved" ${i.resolved ? "checked" : ""}></td>
      <td><button class="icon-btn delete">Delete</button></td>
    </tr>`).join("");

  document.querySelectorAll("#inquiriesBody tr").forEach(tr => {
    tr.querySelector(".f-resolved").addEventListener("change", async (e) => {
      await supabase.from("custom_inquiries").update({ resolved: e.target.checked }).eq("id", tr.dataset.id);
    });
    tr.querySelector(".delete").addEventListener("click", () => deleteRow(tr, "custom_inquiries"));
  });
}

async function loadDashboard(){
  const grid = document.getElementById("statTotalOrders");
  if (!grid) return; // agents don't have this tab
  checkMfaStatus();
  loadDeliverySettingsIntoDashboard();

  const { data: settingsData } = await supabase.from("settings").select("*").eq("key", "commission_percent").maybeSingle();
  const commissionPercent = settingsData ? Number(settingsData.value) : 5;
  document.getElementById("commissionPercentInput").value = commissionPercent;

  const { data, error } = await supabase.from("orders").select("*, order_items(*, products(type))");
  if (error){ return; }

  const totalOrders = data.length;
  const pending = data.filter(o => o.status === "pending").length;
  const completed = data.filter(o => o.status === "delivered").length;

  // Commission is only calculated on FINAL (delivered) orders
  const deliveredOrders = data.filter(o => o.status === "delivered");
  const deliveredTotal = deliveredOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);
  const earnings = deliveredTotal * (commissionPercent / 100);

  const productOrders = data.filter(o => (o.order_items || []).some(i => i.products && i.products.type === "product")).length;
  const projectOrders = data.filter(o => (o.order_items || []).some(i => i.products && i.products.type === "project")).length;

  const productDeliveredTotal = deliveredOrders.filter(o => (o.order_items || []).some(i => i.products && i.products.type === "product")).reduce((s, o) => s + Number(o.total || 0), 0);
  const projectDeliveredTotal = deliveredOrders.filter(o => (o.order_items || []).some(i => i.products && i.products.type === "project")).reduce((s, o) => s + Number(o.total || 0), 0);
  const productCommission = productDeliveredTotal * (commissionPercent / 100);
  const projectCommission = projectDeliveredTotal * (commissionPercent / 100);

  document.getElementById("statTotalOrders").textContent = totalOrders;
  document.getElementById("statPending").textContent = pending;
  document.getElementById("statCompleted").textContent = completed;
  document.getElementById("statEarnings").textContent = `${SITE_CONFIG.currency} ${Math.round(earnings).toLocaleString("en-PK")}`;
  document.getElementById("statProductOrders").textContent = productOrders;
  document.getElementById("statProjectOrders").textContent = projectOrders;
  document.getElementById("statProductCommission").textContent = `${SITE_CONFIG.currency} ${Math.round(productCommission).toLocaleString("en-PK")}`;
  document.getElementById("statProjectCommission").textContent = `${SITE_CONFIG.currency} ${Math.round(projectCommission).toLocaleString("en-PK")}`;

  // All Customers (deduped by phone number)
  const customersMap = {};
  data.forEach(o => {
    const key = o.phone || o.customer_name || o.id;
    if (!customersMap[key]){
      customersMap[key] = { name: o.customer_name, phone: o.phone, email: o.customer_email, orders: 0 };
    }
    customersMap[key].orders++;
  });
  const customers = Object.values(customersMap);
  document.getElementById("customersBody").innerHTML = customers.length
    ? customers.map(c => `<tr><td>${escapeAttr(c.name || "")}</td><td>${escapeAttr(c.phone || "")}</td><td>${escapeAttr(c.email || "")}</td><td>${c.orders}</td></tr>`).join("")
    : `<tr><td colspan="4">No customers yet.</td></tr>`;

  // All Payments
  document.getElementById("paymentsBody").innerHTML = data.length
    ? data.map(o => `<tr><td>#${o.id.slice(0,8)}</td><td>${escapeAttr(o.payment_method || "")}</td><td>${escapeAttr(o.transaction_id || "—")}</td><td>${escapeAttr(o.payment_status || "unpaid")}</td><td>${SITE_CONFIG.currency} ${Number(o.total || 0).toLocaleString("en-PK")}</td></tr>`).join("")
    : `<tr><td colspan="5">No payments yet.</td></tr>`;

  renderDashboardCharts(data, productDeliveredTotal, projectDeliveredTotal, productOrders, projectOrders);
}

let PENDING_MFA_FACTOR_ID = null;

async function checkMfaStatus(){
  const statusText = document.getElementById("mfaStatusText");
  const enableBtn = document.getElementById("mfaEnableBtn");
  if (!statusText) return;
  const { data } = await supabase.auth.mfa.listFactors();
  const verified = data && data.totp && data.totp.find(f => f.status === "verified");
  if (verified){
    statusText.textContent = "✅ Enabled — your account is protected with 2FA.";
    enableBtn.style.display = "none";
  } else {
    statusText.textContent = "Not enabled yet. Add an extra layer of security using an app like Google Authenticator.";
    enableBtn.style.display = "inline-block";
  }
}

document.getElementById("mfaEnableBtn")?.addEventListener("click", async () => {
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
  if (error){ alert(error.message); return; }
  PENDING_MFA_FACTOR_ID = data.id;
  document.getElementById("mfaQrImg").src = `data:image/svg+xml;utf8,${encodeURIComponent(data.totp.qr_code)}`;
  document.getElementById("mfaEnrollBox").classList.remove("hidden");
});

document.getElementById("mfaConfirmBtn")?.addEventListener("click", async () => {
  const msg = document.getElementById("mfaEnrollMsg");
  const code = document.getElementById("mfaEnrollCode").value.trim();
  const { data: challenge, error: challengeErr } = await supabase.auth.mfa.challenge({ factorId: PENDING_MFA_FACTOR_ID });
  if (challengeErr){ msg.style.color = "var(--pink)"; msg.textContent = challengeErr.message; return; }
  const { error: verifyErr } = await supabase.auth.mfa.verify({ factorId: PENDING_MFA_FACTOR_ID, challengeId: challenge.id, code });
  if (verifyErr){ msg.style.color = "var(--pink)"; msg.textContent = "Incorrect code — try again."; return; }
  msg.style.color = "var(--cyan)";
  msg.textContent = "2FA enabled ✓";
  document.getElementById("mfaEnrollBox").classList.add("hidden");
  checkMfaStatus();
});
let CHART_INSTANCES = {};
function renderChart(canvasId, config){
  const canvas = document.getElementById(canvasId);
  if (!canvas || typeof Chart === "undefined") return;
  if (CHART_INSTANCES[canvasId]) CHART_INSTANCES[canvasId].destroy();
  CHART_INSTANCES[canvasId] = new Chart(canvas, config);
}

function renderDashboardCharts(data, productRevenue, projectRevenue, productOrders, projectOrders){
  const chartTextColor = "#9a97ad";
  const chartGridColor = "rgba(255,255,255,.06)";
  Chart.defaults.color = chartTextColor;
  Chart.defaults.font.family = "Manrope, sans-serif";

  // Revenue — last 30 days
  const days = [];
  const now = new Date();
  for (let i = 29; i >= 0; i--){
    const d = new Date(now); d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0,10));
  }
  const revenueByDay = {};
  days.forEach(d => revenueByDay[d] = 0);
  data.forEach(o => {
    const day = new Date(o.created_at).toISOString().slice(0,10);
    if (revenueByDay[day] !== undefined) revenueByDay[day] += Number(o.total || 0);
  });
  renderChart("revenueChart", {
    type: "line",
    data: {
      labels: days.map(d => d.slice(5)),
      datasets: [{ label: "Revenue", data: days.map(d => revenueByDay[d]), borderColor: "#4de3ff", backgroundColor: "rgba(77,227,255,.15)", fill: true, tension: .3, pointRadius: 0 }]
    },
    options: { plugins: { legend: { display: false } }, scales: { x: { grid: { color: chartGridColor } }, y: { grid: { color: chartGridColor } } } }
  });

  // Top 5 products by quantity sold
  const productTotals = {};
  data.forEach(o => (o.order_items || []).forEach(i => {
    productTotals[i.product_name] = (productTotals[i.product_name] || 0) + (i.quantity || 1);
  }));
  const topProducts = Object.entries(productTotals).sort((a, b) => b[1] - a[1]).slice(0, 5);
  renderChart("topProductsChart", {
    type: "bar",
    data: {
      labels: topProducts.map(p => p[0].length > 18 ? p[0].slice(0, 18) + "…" : p[0]),
      datasets: [{ label: "Units sold", data: topProducts.map(p => p[1]), backgroundColor: "#7c5cff", borderRadius: 6 }]
    },
    options: { plugins: { legend: { display: false } }, indexAxis: "y", scales: { x: { grid: { color: chartGridColor } }, y: { grid: { display: false } } } }
  });

  // Products vs Projects sales split
  renderChart("typeSplitChart", {
    type: "doughnut",
    data: {
      labels: ["Products", "Exhibition Projects"],
      datasets: [{ data: [productRevenue, projectRevenue], backgroundColor: ["#4de3ff", "#ff4d94"] }]
    },
    options: { plugins: { legend: { position: "bottom" } } }
  });

  // Orders handled by each agent type
  renderChart("agentPerformanceChart", {
    type: "bar",
    data: {
      labels: ["Products Agent", "Projects Agent"],
      datasets: [{ label: "Orders handled", data: [productOrders, projectOrders], backgroundColor: ["#4de3ff", "#ff4d94"], borderRadius: 6 }]
    },
    options: { plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } }, y: { grid: { color: chartGridColor } } } }
  });
}

/* ---------------------------------------------------------
   COUPONS
   --------------------------------------------------------- */
async function loadCoupons(){
  const { data, error } = await supabase.from("coupons").select("*").order("created_at", { ascending: false });
  const body = document.getElementById("couponsBody");
  if (error){ body.innerHTML = `<tr><td colspan="6">Error: ${error.message}</td></tr>`; return; }
  body.innerHTML = (data || []).map(rowHtmlCoupon).join("");
  wireCouponRows();
}

function rowHtmlCoupon(c){
  const expiresVal = c.expires_at ? new Date(c.expires_at).toISOString().slice(0,10) : "";
  const appliesTo = c.applies_to || "all";
  let appliesToCell;
  if (CURRENT_ROLE === "admin"){
    appliesToCell = `<select class="f-applies-to">
      <option value="all" ${appliesTo === "all" ? "selected" : ""}>All</option>
      <option value="product" ${appliesTo === "product" ? "selected" : ""}>Products only</option>
      <option value="project" ${appliesTo === "project" ? "selected" : ""}>Projects only</option>
    </select>`;
  } else {
    // Agents can only manage coupons for their own type — locked, not editable
    appliesToCell = `<span data-fixed-applies-to="${appliesTo}">${appliesTo === "product" ? "Products only" : appliesTo === "project" ? "Projects only" : "All"}</span>`;
  }
  return `
    <tr data-id="${c.id}">
      <td><input type="text" class="f-code" value="${escapeAttr(c.code || "")}" style="text-transform:uppercase;"></td>
      <td><input type="number" class="f-discount" value="${c.discount_percent}" min="1" max="100" step="1"></td>
      <td>${appliesToCell}</td>
      <td><input type="checkbox" class="f-active" ${c.active ? "checked" : ""}></td>
      <td><input type="date" class="f-expires" value="${expiresVal}"></td>
      <td>
        <div class="row-actions">
          <button class="icon-btn save">Save</button>
          <button class="icon-btn delete">Delete</button>
        </div>
        <span class="row-msg"></span>
      </td>
    </tr>`;
}

function wireCouponRows(){
  document.querySelectorAll("#couponsBody tr").forEach(tr => {
    tr.querySelector(".save").addEventListener("click", () => saveCouponRow(tr));
    tr.querySelector(".delete").addEventListener("click", () => deleteRow(tr, "coupons"));
  });
}

async function saveCouponRow(tr){
  const id = tr.dataset.id;
  const expiresInput = tr.querySelector(".f-expires").value;
  let appliesTo;
  if (CURRENT_ROLE === "admin"){
    appliesTo = tr.querySelector(".f-applies-to").value;
  } else if (CURRENT_ROLE === "products_agent"){
    appliesTo = "product";
  } else if (CURRENT_ROLE === "projects_agent"){
    appliesTo = "project";
  } else {
    appliesTo = tr.querySelector("[data-fixed-applies-to]").dataset.fixedAppliesTo;
  }
  const payload = {
    code: tr.querySelector(".f-code").value.trim().toUpperCase(),
    discount_percent: Number(tr.querySelector(".f-discount").value) || 0,
    applies_to: appliesTo,
    active: tr.querySelector(".f-active").checked,
    expires_at: expiresInput ? new Date(expiresInput).toISOString() : null
  };
  const msg = tr.querySelector(".row-msg");
  let error;
  if (id === "new"){
    ({ error } = await supabase.from("coupons").insert(payload));
    if (!error) loadCoupons();
  } else {
    ({ error } = await supabase.from("coupons").update(payload).eq("id", id));
  }
  msg.style.color = error ? "var(--pink)" : "var(--cyan)";
  msg.textContent = error ? error.message : "Saved ✓";
  setTimeout(() => msg.textContent = "", 2000);
}

document.getElementById("addCouponBtn")?.addEventListener("click", () => {
  const body = document.getElementById("couponsBody");
  const tr = document.createElement("tr");
  tr.dataset.id = "new";
  const defaultAppliesTo = CURRENT_ROLE === "products_agent" ? "product" : CURRENT_ROLE === "projects_agent" ? "project" : "all";
  tr.innerHTML = rowHtmlCoupon({ id: "new", code: "", discount_percent: 10, active: true, expires_at: null, applies_to: defaultAppliesTo }).match(/<td[\s\S]*<\/td>/)[0];
  body.prepend(tr);
  wireCouponRows();
});

/* ---------------------------------------------------------
   MESSAGES
   --------------------------------------------------------- */
async function loadMessages(){
  const { data, error } = await supabase.from("messages").select("*").order("created_at", { ascending: false });
  const body = document.getElementById("messagesBody");
  if (error){ body.innerHTML = `<tr><td colspan="4">Error: ${error.message}</td></tr>`; return; }
  if (!data || !data.length){ body.innerHTML = `<tr><td colspan="4">No messages yet.</td></tr>`; return; }

  body.innerHTML = data.map(m => {
    const forwardCell = CURRENT_ROLE === "admin"
      ? `<label style="display:flex; align-items:center; gap:5px; font-size:.72rem; margin-bottom:4px;">
           <input type="checkbox" class="f-fwd-products" ${m.sent_to_products_agent ? "checked" : ""}> Products Agent
         </label>
         <label style="display:flex; align-items:center; gap:5px; font-size:.72rem;">
           <input type="checkbox" class="f-fwd-projects" ${m.sent_to_projects_agent ? "checked" : ""}> Projects Agent
         </label>`
      : "";
    const actionsCell = CURRENT_ROLE === "admin" ? `<button class="icon-btn delete">Delete</button>` : "";
    return `
    <tr data-id="${m.id}">
      <td>${escapeAttr(m.name)}<br><span style="color:var(--muted)">${escapeAttr(m.email)}</span></td>
      <td style="max-width:280px;">${escapeAttr(m.message)}</td>
      <td>${new Date(m.created_at).toLocaleDateString()}<br>${forwardCell}</td>
      <td>${actionsCell}</td>
    </tr>
  `;
  }).join("");

  document.querySelectorAll("#messagesBody tr").forEach(tr => {
    const deleteBtn = tr.querySelector(".delete");
    if (deleteBtn) deleteBtn.addEventListener("click", () => deleteRow(tr, "messages"));

    const fwdProducts = tr.querySelector(".f-fwd-products");
    const fwdProjects = tr.querySelector(".f-fwd-projects");
    if (fwdProducts) fwdProducts.addEventListener("change", async (e) => {
      await supabase.from("messages").update({ sent_to_products_agent: e.target.checked }).eq("id", tr.dataset.id);
    });
    if (fwdProjects) fwdProjects.addEventListener("change", async (e) => {
      await supabase.from("messages").update({ sent_to_projects_agent: e.target.checked }).eq("id", tr.dataset.id);
    });
  });
}

document.getElementById("refreshMessagesBtn")?.addEventListener("click", loadMessages);

/* ---------------------------------------------------------
   BLOG POSTS
   --------------------------------------------------------- */
function slugifyTitle(str){
  return String(str).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

async function loadPosts(){
  const { data, error } = await supabase.from("blog_posts").select("*").order("created_at", { ascending: false });
  const body = document.getElementById("postsBody");
  if (error){ body.innerHTML = `<p style="color:var(--pink)">Error: ${error.message}</p>`; return; }
  if (!data || !data.length){ body.innerHTML = `<p style="color:var(--muted)">No posts yet.</p>`; return; }
  body.innerHTML = data.map(postCardHtml).join("");
  wirePostCards();
}

function postCardHtml(p){
  return `
  <div class="post-card-admin" data-id="${p.id}" style="border:1px solid var(--line); border-radius:12px; padding:16px; background:var(--panel-2);">
    <label style="display:flex; flex-direction:column; gap:4px; font-size:.78rem; color:var(--muted); margin-bottom:8px;">Title
      <input type="text" class="f-title" value="${escapeAttr(p.title)}">
    </label>
    <label style="display:flex; flex-direction:column; gap:4px; font-size:.78rem; color:var(--muted); margin-bottom:8px;">Slug (URL)
      <input type="text" class="f-slug" value="${escapeAttr(p.slug || "")}">
    </label>
    <label style="display:flex; flex-direction:column; gap:4px; font-size:.78rem; color:var(--muted); margin-bottom:8px;">Excerpt (short summary)
      <input type="text" class="f-excerpt" value="${escapeAttr(p.excerpt || "")}">
    </label>
    <label style="display:flex; flex-direction:column; gap:4px; font-size:.78rem; color:var(--muted); margin-bottom:8px;">Content
      <textarea class="f-content" rows="6" style="resize:vertical;">${escapeAttr(p.content || "")}</textarea>
    </label>
    <label style="display:flex; align-items:center; gap:6px; font-size:.82rem; margin-bottom:10px;">
      <input type="checkbox" class="f-published" style="width:auto;" ${p.published ? "checked" : ""}> Published (visible on site)
    </label>
    <div class="row-actions">
      <button class="icon-btn save">Save</button>
      <button class="icon-btn delete">Delete</button>
    </div>
    <span class="row-msg"></span>
  </div>`;
}

function wirePostCards(){
  document.querySelectorAll(".post-card-admin").forEach(card => {
    card.querySelector(".save").addEventListener("click", () => savePostCard(card));
    card.querySelector(".delete").addEventListener("click", () => deletePost(card));
  });
}

async function savePostCard(card){
  const id = card.dataset.id;
  const title = card.querySelector(".f-title").value.trim();
  let slug = card.querySelector(".f-slug").value.trim();
  if (!slug) slug = slugifyTitle(title);
  const payload = {
    title,
    slug: slugifyTitle(slug),
    excerpt: card.querySelector(".f-excerpt").value.trim(),
    content: card.querySelector(".f-content").value,
    published: card.querySelector(".f-published").checked
  };
  const msg = card.querySelector(".row-msg");
  let error;
  if (id === "new"){
    ({ error } = await supabase.from("blog_posts").insert(payload));
    if (!error) loadPosts();
  } else {
    ({ error } = await supabase.from("blog_posts").update(payload).eq("id", id));
  }
  msg.style.color = error ? "var(--pink)" : "var(--cyan)";
  msg.textContent = error ? error.message : "Saved ✓";
  setTimeout(() => msg.textContent = "", 2000);
}

async function deletePost(card){
  if (card.dataset.id === "new"){ card.remove(); return; }
  if (!confirm("Delete this post permanently?")) return;
  const { error } = await supabase.from("blog_posts").delete().eq("id", card.dataset.id);
  if (error){ alert(error.message); return; }
  card.remove();
}

document.getElementById("addPostBtn")?.addEventListener("click", () => {
  const body = document.getElementById("postsBody");
  const wrapper = document.createElement("div");
  wrapper.innerHTML = postCardHtml({ id: "new", title: "", slug: "", excerpt: "", content: "", published: true });
  const card = wrapper.firstElementChild;
  body.prepend(card);
  wirePostCards();
});

/* ---------------------------------------------------------
   INIT
   --------------------------------------------------------- */
window.addEventListener("DOMContentLoaded", () => {
  if (!initSupabase()) return;
  wireLogin();
  wireTabs();
  initMediaLibrary();
  checkSession();
  supabase.auth.onAuthStateChange(() => checkSession());
});
