/* =========================================================
   AK ELECTRONICS — MAIN SITE LOGIC
   Reads shared settings from config.js (SITE_CONFIG).
   Data source priority: Supabase (if configured) > Google Sheet
   (if configured) > built-in FALLBACK_PRODUCTS below.
   ========================================================= */

/* ---------------------------------------------------------
   FALLBACK CATALOG — used only if Supabase & Sheets aren't set up
   --------------------------------------------------------- */
const CATEGORIES = [
  { id: "sensors",     icon: "🛰️", name: "Sensors",              desc: "PIR, ultrasonic, gas, temperature, soil & more" },
  { id: "arduino",     icon: "🟩", name: "Arduino Boards",        desc: "Uno, Nano, Mega, Pro Mini & clones" },
  { id: "esp",         icon: "📶", name: "ESP32 / ESP8266",       desc: "WROOM, DevKit, CAM, NodeMCU variants" },
  { id: "raspberry",   icon: "🍓", name: "Raspberry Pi",          desc: "Pi 4, Pi Zero, Pico & accessories" },
  { id: "prototyping", icon: "🔗", name: "Jumper Wires & Proto",  desc: "Breadboards, jumper wires, headers" },
  { id: "modules",     icon: "🧩", name: "Modules & Actuators",   desc: "Relays, motor drivers, displays, RF/BT" },
  { id: "lighting",    icon: "💡", name: "Lighting",              desc: "LED bulbs, tube lights, panel lights" },
  { id: "switches",    icon: "🎚️", name: "Switches & Sockets",    desc: "Wall switches, sockets, holders" },
  { id: "soldering",   icon: "🛠️", name: "Soldering & Tools",     desc: "Irons, stations, strippers, pumps" },
  { id: "connectors",  icon: "🧷", name: "Connectors",            desc: "Terminal blocks, PCB headers" },
  { id: "safety",      icon: "⚡", name: "Safety & Fuses",         desc: "Fuses, MCBs, insulation tape" },
  { id: "power",       icon: "🔋", name: "Batteries & Power",     desc: "Batteries, adapters, power supplies" },
];

const FALLBACK_PRODUCTS = [
  { id: "fb-1", type: "product", name: "PIR Motion Sensor (HC-SR501)", category: "sensors", spec: "3.3–5V · adjustable delay & sensitivity", price: 250, stock: "in" },
  { id: "fb-2", type: "product", name: "Ultrasonic Sensor HC-SR04",    category: "sensors", spec: "2–400cm range · 5V TTL", price: 180, stock: "in" },
  { id: "fb-3", type: "product", name: "Arduino Uno R3 (clone)",       category: "arduino", spec: "ATmega328P · USB-B", price: 950, stock: "in" },
  { id: "fb-4", type: "product", name: "ESP32 DevKit V1",              category: "esp", spec: "WROOM-32 · WiFi + BLE · 30 pin", price: 1050, stock: "in" },
  { id: "fb-5", type: "product", name: "Raspberry Pi Pico",            category: "raspberry", spec: "RP2040 · microcontroller board", price: 650, stock: "in" },
  { id: "fb-6", type: "product", name: "Breadboard 830-point",         category: "prototyping", spec: "Full size · self-adhesive back", price: 220, stock: "in" },
  { id: "fb-7", type: "product", name: "9W LED Bulb (B22)",            category: "lighting", spec: "Cool daylight · energy saver", price: 180, stock: "in" },
  { id: "fb-8", type: "product", name: "Soldering Iron 60W",           category: "soldering", spec: "Adjustable temp · fine tip", price: 850, stock: "in" },
];

const FALLBACK_PROJECTS = [
  { id: "fb-p1", type: "project", name: "Smart Home Automation (ESP32 + App)", spec: "IoT · control lights, fan & door lock from a phone app over WiFi", price: 4500 },
  { id: "fb-p2", type: "project", name: "Obstacle-Avoiding Robot Car",          spec: "Robotics · Arduino + ultrasonic sensor + L298N chassis, fully wired", price: 3200 },
];

const DEALS = [
  { name: "Soldering Iron 60W", tag: "Save 15%", oldPrice: 1000, newPrice: 850 },
  { name: "ESP32 DevKit V1 (2-pack)", tag: "Bundle deal", oldPrice: 2300, newPrice: 1950 },
];

const REVIEWS = [
  { name: "Hamza, FYP student", text: "Ordered a full ESP32 automation kit at 11pm and it was ready by morning. Saved my project." },
  { name: "Ayesha, hobbyist", text: "Prices are clear and checkout was faster than any app I've used." },
  { name: "Bilal, workshop owner", text: "Been buying soldering tools and wire from here for months — always genuine stock." },
];

let PRODUCTS = FALLBACK_PRODUCTS;
let PROJECTS = FALLBACK_PROJECTS;
let STARTER_KITS = [];
let dataSource = "fallback"; // "supabase" | "sheet" | "fallback"

/* ---------------------------------------------------------
   SUPABASE CLIENT
   --------------------------------------------------------- */
let supabase = null;
let currentUser = null;
let currentProfile = null;
let WISHLIST_IDS = new Set();
let COMPARE_IDS = new Set();
let RATINGS_MAP = {}; // { product_id: { avg, count } }
let APPLIED_COUPON = null; // { code, discount_percent }
let DELIVERY_CHARGE_LAHORE = 0;
let DELIVERY_CHARGE_OTHER = 250;
let CURRENT_LOYALTY_POINTS = 0;

function supabaseReady(){
  return !!(SITE_CONFIG.supabaseUrl && SITE_CONFIG.supabaseAnonKey);
}

function initSupabase(){
  if (!supabaseReady() || !window.__createSupabaseClient) return;
  supabase = window.__createSupabaseClient(SITE_CONFIG.supabaseUrl, SITE_CONFIG.supabaseAnonKey);
}

async function loadProductsFromSupabase(){
  if (!supabase) return false;
  try{
    const { data, error } = await supabase.from("products").select("*").order("created_at", { ascending: true });
    if (error) throw error;
    if (data && data.length){
      PRODUCTS = data.filter(d => (d.type || "product") === "product");
      PROJECTS = data.filter(d => d.type === "project");
      STARTER_KITS = data.filter(d => d.type === "starter_kit");
      dataSource = "supabase";
      return true;
    }
  } catch (err){
    console.warn("Supabase product load failed:", err);
  }
  return false;
}

async function loadProductsFromSheet(){
  if (!SITE_CONFIG.sheetCsvUrl || !window.Papa) return false;
  try{
    const res = await fetch(SITE_CONFIG.sheetCsvUrl);
    if (!res.ok) throw new Error("Sheet fetch failed: " + res.status);
    const csv = await res.text();
    const parsed = Papa.parse(csv, { header: true, skipEmptyLines: true });
    const products = [], projects = [];
    parsed.data.forEach((row, i) => {
      const type = (row.Type || "product").trim().toLowerCase();
      const item = {
        id: "sheet-" + i,
        type,
        name: (row.Name || "").trim(),
        category: (row.Category || "").trim().toLowerCase(),
        spec: (row.Spec || "").trim(),
        price: parseFloat(row.Price) || 0,
        stock: (row.Stock || "in").trim().toLowerCase(),
        image: (row.Image || "").trim()
      };
      if (!item.name) return;
      (type === "project" ? projects : products).push(item);
    });
    if (products.length){ PRODUCTS = products; PROJECTS = projects; dataSource = "sheet"; return true; }
  } catch (err){
    console.warn("Sheet load failed:", err);
  }
  return false;
}

async function loadActiveOffers(){
  const section = document.getElementById("offersSection");
  const grid = document.getElementById("offersGrid");
  if (!section || !supabaseReady()) return;

  const { data, error } = await supabase.from("coupons").select("*").eq("active", true);
  if (error || !data || !data.length){ section.classList.add("hidden"); return; }

  const now = new Date();
  const valid = data.filter(c => !c.expires_at || new Date(c.expires_at) > now);
  if (!valid.length){ section.classList.add("hidden"); return; }

  section.classList.remove("hidden");
  grid.innerHTML = valid.map(c => {
    const appliesTo = c.applies_to || "all";
    const badgeText = appliesTo === "product" ? "Products only" : appliesTo === "project" ? "Exhibition Projects only" : "Sitewide";
    return `
    <div class="offer-card">
      <span class="offer-percent">${c.discount_percent}% OFF</span>
      <span style="font-size:.68rem; color:var(--muted); font-family:var(--mono);">${badgeText}</span>
      <div class="offer-code-row">
        <span class="offer-code">${escapeHtml(c.code)}</span>
        <button class="offer-copy-btn" data-copy="${escapeHtml(c.code)}">Copy</button>
      </div>
      ${c.expires_at ? `<span class="offer-expiry">Expires ${new Date(c.expires_at).toLocaleDateString()}</span>` : ""}
    </div>
  `;
  }).join("");

  grid.querySelectorAll("[data-copy]").forEach(btn => {
    btn.addEventListener("click", () => {
      navigator.clipboard.writeText(btn.dataset.copy).then(() => {
        const original = btn.textContent;
        btn.textContent = "Copied ✓";
        btn.classList.add("copied");
        setTimeout(() => { btn.textContent = original; btn.classList.remove("copied"); }, 1500);
      });
    });
  });
}

async function loadCatalog(){
  const status = document.getElementById("productStatus");
  const gotSupabase = await loadProductsFromSupabase();
  if (!gotSupabase) await loadProductsFromSheet();
  if (status){
    status.textContent =
      dataSource === "supabase" ? "Live catalog loaded from your database ✓" :
      dataSource === "sheet" ? "Live prices loaded from Google Sheets ✓" :
      "Showing sample catalog — connect Supabase or a Google Sheet in config.js to go live.";
  }
}

/* ---------------------------------------------------------
   IMAGE HANDLING
   --------------------------------------------------------- */
const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp"];
function slugify(name){ return String(name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""); }

function resolveImageSrc(fileOrUrl){
  return /^https?:\/\//i.test(fileOrUrl) ? fileOrUrl : `images/${fileOrUrl}`;
}

function buildImgTag(item, fallbackIcon){
  const slug = slugify(item.name);
  const explicit = item.image && item.image.trim();
  const fileList = explicit ? explicit.split(",").map(s => s.trim()).filter(Boolean) : [];
  const firstFile = fileList[0] || null;
  const firstSrc = firstFile ? resolveImageSrc(firstFile) : `images/${slug}.${IMAGE_EXTENSIONS[0]}`;
  const dataAttrs = firstFile
    ? `data-explicit="1" data-images="${escapeHtml(fileList.join("|"))}" data-img-idx="0"`
    : `data-slug="${slug}" data-ext-index="0"`;
  const isWished = WISHLIST_IDS.has(String(item.id));
  return `<div class="thumb" data-gallery="${item.id}">
    <span class="thumb-icon">${fallbackIcon}</span>
    <img src="${firstSrc}" alt="${escapeHtml(item.name)}" loading="lazy" ${dataAttrs} onerror="handleImgError(this)">
    <button class="wishlist-heart${isWished ? " active" : ""}" data-wish="${item.id}" aria-label="Toggle wishlist">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg>
    </button>
    <label class="compare-check" title="Add to comparison">
      <input type="checkbox" data-compare="${item.id}" ${COMPARE_IDS.has(String(item.id)) ? "checked" : ""}>
      <span>⚖ Compare</span>
    </label>
  </div>`;
}
function imageListFor(item){
  const explicit = item.image && item.image.trim();
  if (explicit){
    return explicit.split(",").map(s => s.trim()).filter(Boolean).map(resolveImageSrc);
  }
  const slug = slugify(item.name);
  return [`images/${slug}.${IMAGE_EXTENSIONS[0]}`];
}
function handleImgError(img){
  if (img.dataset.explicit){
    const list = (img.dataset.images || "").split("|").filter(Boolean);
    let idx = parseInt(img.dataset.imgIdx || "0", 10) + 1;
    if (idx >= list.length){ img.style.display = "none"; return; }
    img.dataset.imgIdx = idx;
    img.src = resolveImageSrc(list[idx]);
    return;
  }
  let idx = parseInt(img.dataset.extIndex || "0", 10) + 1;
  if (idx >= IMAGE_EXTENSIONS.length){ img.style.display = "none"; return; }
  img.dataset.extIndex = idx;
  img.src = `images/${img.dataset.slug}.${IMAGE_EXTENSIONS[idx]}`;
}
function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, s => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[s]));
}

/* ---------------------------------------------------------
   CONFETTI (little celebration burst on order success)
   --------------------------------------------------------- */
function fireConfetti(){
  const colors = ["#35e6ff", "#7c5cff", "#ff4d94", "#ffb443"];
  const container = document.createElement("div");
  container.style.cssText = "position:fixed; inset:0; pointer-events:none; z-index:999; overflow:hidden;";
  document.body.appendChild(container);

  for (let i = 0; i < 60; i++){
    const piece = document.createElement("span");
    const size = 6 + Math.random() * 6;
    const startX = Math.random() * 100;
    const duration = 1.6 + Math.random() * 1.2;
    const delay = Math.random() * 0.3;
    const rotate = Math.random() * 360;
    piece.style.cssText = `
      position:absolute; top:-20px; left:${startX}vw; width:${size}px; height:${size * 0.6}px;
      background:${colors[i % colors.length]}; opacity:.9; border-radius:2px;
      transform:rotate(${rotate}deg);
      animation:confetti-fall ${duration}s ease-in ${delay}s forwards;
    `;
    container.appendChild(piece);
  }

  setTimeout(() => container.remove(), 3200);
}

/* ---------------------------------------------------------
   CUSTOMER LIVE LOCATION (checkout)
   --------------------------------------------------------- */
let checkoutLat = null;
let checkoutLng = null;

function wireLocationDetect(){
  const btn = document.getElementById("useLocationBtn");
  const msg = document.getElementById("locationMsg");
  const addressField = document.getElementById("checkoutAddress");
  if (!btn) return;

  btn.addEventListener("click", () => {
    if (!navigator.geolocation){
      msg.style.color = "var(--pink)";
      msg.textContent = "Your browser doesn't support location detection — please type your address.";
      return;
    }
    msg.style.color = "var(--muted)";
    msg.textContent = "Detecting your location…";
    btn.disabled = true;

    navigator.geolocation.getCurrentPosition(async (pos) => {
      checkoutLat = pos.coords.latitude;
      checkoutLng = pos.coords.longitude;
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${checkoutLat}&lon=${checkoutLng}`);
        const data = await res.json();
        addressField.value = data.display_name || `Lat ${checkoutLat.toFixed(5)}, Lng ${checkoutLng.toFixed(5)}`;
      } catch(err){
        addressField.value = `Lat ${checkoutLat.toFixed(5)}, Lng ${checkoutLng.toFixed(5)}`;
      }
      msg.style.color = "var(--cyan)";
      msg.textContent = "📍 Location detected — feel free to add a house/floor number.";
      btn.disabled = false;
    }, () => {
      msg.style.color = "var(--pink)";
      msg.textContent = "Couldn't access your location — please allow location permission, or type your address manually.";
      btn.disabled = false;
    }, { enableHighAccuracy: true, timeout: 10000 });
  });
}

/* ---------------------------------------------------------
   SCROLL TO TOP
   --------------------------------------------------------- */
/* ---------------------------------------------------------
   ACCESSIBILITY: close any open modal with the Escape key
   --------------------------------------------------------- */
function wireEscapeToClose(){
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    document.querySelectorAll(".modal-overlay.open").forEach(overlay => overlay.classList.remove("open"));
    const searchDropdown = document.getElementById("searchDropdown");
    if (searchDropdown) searchDropdown.classList.add("hidden");
  });
}

function wireScrollTop(){
  const btn = document.getElementById("scrollTopBtn");
  if (!btn) return;
  window.addEventListener("scroll", () => {
    btn.classList.toggle("visible", window.scrollY > 500);
  });
  btn.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

/* ---------------------------------------------------------
   FAQ ACCORDION
   --------------------------------------------------------- */
function wireFAQ(){
  document.querySelectorAll(".faq-item").forEach(item => {
    const q = item.querySelector(".faq-q");
    const a = item.querySelector(".faq-a");
    q.addEventListener("click", () => {
      const isOpen = item.classList.contains("open");
      document.querySelectorAll(".faq-item.open").forEach(other => {
        if (other !== item){ other.classList.remove("open"); other.querySelector(".faq-a").style.maxHeight = null; }
      });
      item.classList.toggle("open", !isOpen);
      a.style.maxHeight = !isOpen ? a.scrollHeight + "px" : null;
    });
  });
}

/* ---------------------------------------------------------
   CONTACT FORM
   --------------------------------------------------------- */
function wireContactForm(){
  const form = document.getElementById("contactForm");
  if (!form) return;
  form.addEventListener("submit", async e => {
    e.preventDefault();
    const msg = document.getElementById("contactMsg");
    const name = document.getElementById("contactName").value.trim();
    const email = document.getElementById("contactEmail").value.trim();
    const message = document.getElementById("contactMessage").value.trim();

    // Save to Supabase so it also shows up in the Admin Panel's Messages tab
    if (supabaseReady()){
      await supabase.from("messages").insert({ name, email, message });
    }

    // Send a real email straight to your inbox via Web3Forms — reply-to is
    // set to the customer's own email, so hitting "Reply" in your inbox works.
    if (SITE_CONFIG.web3formsAccessKey){
      try {
        const res = await fetch("https://api.web3forms.com/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Accept": "application/json" },
          body: JSON.stringify({
            access_key: SITE_CONFIG.web3formsAccessKey,
            subject: `New message from ${name} — ${SITE_CONFIG.shopName}`,
            from_name: name,
            email, // Web3Forms uses this as the Reply-To address
            message
          })
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.message || "Email send failed");
      } catch(err){
        msg.style.color = "var(--pink)";
        msg.textContent = "Saved, but email couldn't be sent right now — we'll still see your message.";
        form.reset();
        return;
      }
    }

    msg.style.color = "var(--cyan)";
    msg.textContent = "Message sent! We'll get back to you soon.";
    form.reset();
  });
}

/* ---------------------------------------------------------
   NEWSLETTER
   --------------------------------------------------------- */
function wireNewsletter(){
  const form = document.getElementById("newsletterForm");
  if (!form) return;
  form.addEventListener("submit", async e => {
    e.preventDefault();
    const msg = document.getElementById("newsletterMsg");
    const email = document.getElementById("newsletterEmail").value.trim();
    if (!supabaseReady()){ msg.style.color = "var(--pink)"; msg.textContent = "Backend not connected yet."; return; }
    const { error } = await supabase.from("newsletter_subscribers").insert({ email });
    if (error){
      msg.style.color = "var(--pink)";
      msg.textContent = error.message.includes("duplicate") ? "You're already subscribed!" : error.message;
      return;
    }
    msg.style.color = "var(--cyan)";
    msg.textContent = "Subscribed! Thanks for joining.";
    form.reset();
  });
}

/* ---------------------------------------------------------
   SAVED ADDRESSES (address book)
   --------------------------------------------------------- */
let SAVED_ADDRESSES = [];

async function loadSavedAddresses(){
  const select = document.getElementById("savedAddressSelect");
  if (!select) return;
  select.innerHTML = `<option value="">+ Use a new address</option>`;
  SAVED_ADDRESSES = [];
  if (!supabaseReady() || !currentUser) return;
  const { data } = await supabase.from("addresses").select("*").eq("user_id", currentUser.id).order("created_at", { ascending: false });
  SAVED_ADDRESSES = data || [];
  SAVED_ADDRESSES.forEach(addr => {
    const opt = document.createElement("option");
    opt.value = addr.id;
    opt.textContent = `${addr.label || "Address"} — ${addr.address.slice(0, 40)}${addr.address.length > 40 ? "…" : ""}`;
    select.appendChild(opt);
  });
}

function wireAddressBook(){
  const select = document.getElementById("savedAddressSelect");
  const textarea = document.getElementById("checkoutAddress");
  if (!select) return;
  select.addEventListener("change", () => {
    const chosen = SAVED_ADDRESSES.find(a => String(a.id) === select.value);
    textarea.value = chosen ? chosen.address : "";
  });
}

async function maybeSaveNewAddress(address){
  const checkbox = document.getElementById("saveAddressCheck");
  if (!checkbox || !checkbox.checked || !currentUser) return;
  await supabase.from("addresses").insert({ user_id: currentUser.id, label: "Address", address });
  checkbox.checked = false;
}

/* ---------------------------------------------------------
   LIVE SEARCH
   --------------------------------------------------------- */
function wireSearch(){
  const input = document.getElementById("searchInput");
  const clearBtn = document.getElementById("searchClearBtn");
  const dropdown = document.getElementById("searchDropdown");
  if (!input) return;

  function runSearch(query){
    const q = query.trim().toLowerCase();
    clearBtn.classList.toggle("hidden", !q);
    if (!q){ dropdown.classList.add("hidden"); dropdown.innerHTML = ""; return; }

    const all = [...(typeof PRODUCTS !== "undefined" ? PRODUCTS : []), ...(typeof PROJECTS !== "undefined" ? PROJECTS : [])];
    const results = all.filter(p =>
      (p.name || "").toLowerCase().includes(q) ||
      (p.category || "").toLowerCase().includes(q) ||
      (p.spec || "").toLowerCase().includes(q)
    ).slice(0, 8);

    dropdown.classList.remove("hidden");
    if (!results.length){
      dropdown.innerHTML = `<div class="search-empty">No matches for "${escapeHtml(query)}" — try another term.</div>`;
      return;
    }
    dropdown.innerHTML = results.map(p => `
      <div class="search-result" data-search-item="${p.id}">
        <img src="${imageListFor(p)[0]}" alt="" loading="lazy" onerror="this.style.opacity='0.2'">
        <div class="search-result-info">
          <div class="sr-name">${escapeHtml(p.name)}</div>
          <div class="sr-cat">${escapeHtml(categoryName(p.category) || "Exhibition Project")}</div>
        </div>
        <span class="sr-price">${formatPrice(p.price)}</span>
      </div>
    `).join("");
    dropdown.querySelectorAll("[data-search-item]").forEach(el => {
      el.addEventListener("click", () => {
        const item = all.find(p => String(p.id) === el.dataset.searchItem);
        if (item){
          openGallery(item);
          dropdown.classList.add("hidden");
          input.value = "";
          clearBtn.classList.add("hidden");
        }
      });
    });
  }

  input.addEventListener("input", () => runSearch(input.value));
  input.addEventListener("focus", () => { if (input.value.trim()) runSearch(input.value); });
  clearBtn.addEventListener("click", () => { input.value = ""; runSearch(""); input.focus(); });

  document.addEventListener("click", e => {
    if (!e.target.closest(".search-section")) dropdown.classList.add("hidden");
  });

  // Honour ?search=... in the URL (fulfills the site's Google sitelinks searchbox)
  const urlQuery = new URLSearchParams(window.location.search).get("search");
  if (urlQuery){
    input.value = urlQuery;
    runSearch(urlQuery);
  }
}

/* ---------------------------------------------------------
   BANNER SLIDER
   --------------------------------------------------------- */
/* ---------------------------------------------------------
   THEME TOGGLE (dark/light)
   --------------------------------------------------------- */
function initTheme(){
  const saved = localStorage.getItem("akep_theme") || "dark";
  document.documentElement.setAttribute("data-theme", saved);
  const btn = document.getElementById("themeToggleBtn");
  if (!btn) return;
  btn.classList.toggle("is-light", saved === "light");
  btn.addEventListener("click", () => {
    const now = document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
    const next = now === "light" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("akep_theme", next);
    btn.classList.toggle("is-light", next === "light");
  });
}

/* ---------------------------------------------------------
   WISHLIST
   --------------------------------------------------------- */
function wireGalleryAndWishlist(grid, sourceArray){
  grid.querySelectorAll("[data-wish]").forEach(btn => {
    btn.addEventListener("click", e => {
      e.stopPropagation();
      const item = sourceArray.find(p => String(p.id) === btn.dataset.wish);
      if (item) toggleWishlist(item, btn);
    });
  });
  grid.querySelectorAll("[data-compare]").forEach(input => {
    input.addEventListener("click", e => e.stopPropagation());
    input.addEventListener("change", () => {
      const id = String(input.dataset.compare);
      if (input.checked){
        if (COMPARE_IDS.size >= 4){ input.checked = false; alert("You can compare up to 4 items at a time."); return; }
        COMPARE_IDS.add(id);
      } else {
        COMPARE_IDS.delete(id);
      }
      updateCompareBar();
    });
  });
  grid.querySelectorAll("[data-gallery]").forEach(div => {
    div.addEventListener("click", e => {
      if (e.target.closest("[data-wish]") || e.target.closest(".compare-check")) return;
      const item = sourceArray.find(p => String(p.id) === div.dataset.gallery);
      if (item) openGallery(item);
    });
  });
}

async function loadWishlist(){
  WISHLIST_IDS = new Set();
  if (!supabaseReady() || !currentUser) { updateWishlistBadge(); return; }
  const { data } = await supabase.from("wishlists").select("product_id").eq("user_id", currentUser.id);
  (data || []).forEach(row => WISHLIST_IDS.add(String(row.product_id)));
  updateWishlistBadge();
}

async function toggleWishlist(item, btnEl){
  if (!supabaseReady()) { alert("Backend not connected yet."); return; }
  if (!currentUser){
    document.getElementById("loginOverlay").classList.add("open");
    return;
  }
  const id = String(item.id);
  if (WISHLIST_IDS.has(id)){
    await supabase.from("wishlists").delete().eq("user_id", currentUser.id).eq("product_id", item.id);
    WISHLIST_IDS.delete(id);
  } else {
    await supabase.from("wishlists").insert({ user_id: currentUser.id, product_id: item.id });
    WISHLIST_IDS.add(id);
  }
  if (btnEl) btnEl.classList.toggle("active", WISHLIST_IDS.has(id));
  updateWishlistBadge();
}

function updateWishlistBadge(){
  const el = document.getElementById("wishlistCount");
  const btn = document.getElementById("wishlistOpenBtn");
  if (!el) return;
  el.textContent = WISHLIST_IDS.size;
  if (btn) btn.classList.toggle("has-items", WISHLIST_IDS.size > 0);
}

function renderWishlistModal(){
  const box = document.getElementById("wishlistItems");
  const all = [...(typeof PRODUCTS !== "undefined" ? PRODUCTS : []), ...(typeof PROJECTS !== "undefined" ? PROJECTS : [])];
  const items = all.filter(p => WISHLIST_IDS.has(String(p.id)));
  if (!items.length){ box.innerHTML = `<p style="color:var(--muted)">No items saved yet — tap the ♥ on any product.</p>`; return; }
  box.innerHTML = items.map(it => `
    <div class="cart-item">
      <div>
        <strong>${escapeHtml(it.name)}</strong><br>
        <span style="color:var(--muted); font-size:.8rem;">${formatPrice(it.price)}</span>
      </div>
      <div style="display:flex; gap:6px;">
        <button class="icon-btn save" data-wish-add="${it.id}">Add to Cart</button>
        <button class="icon-btn delete" data-wish-remove="${it.id}">Remove</button>
      </div>
    </div>
  `).join("");
  box.querySelectorAll("[data-wish-add]").forEach(btn => {
    btn.addEventListener("click", () => {
      const item = all.find(p => String(p.id) === btn.dataset.wishAdd);
      if (item) addToCart(item);
    });
  });
  box.querySelectorAll("[data-wish-remove]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const item = all.find(p => String(p.id) === btn.dataset.wishRemove);
      if (item){ await toggleWishlist(item); renderWishlistModal(); renderProducts(); renderProjects(); }
    });
  });
}

function wireWishlistModal(){
  const openBtn = document.getElementById("wishlistOpenBtn");
  const overlay = document.getElementById("wishlistOverlay");
  const closeBtn = document.getElementById("wishlistClose");
  if (!openBtn) return;
  openBtn.addEventListener("click", () => { renderWishlistModal(); overlay.classList.add("open"); });
  closeBtn.addEventListener("click", () => overlay.classList.remove("open"));
  overlay.addEventListener("click", e => { if (e.target === overlay) overlay.classList.remove("open"); });
}

/* ---------------------------------------------------------
   PRODUCT GALLERY / ZOOM
   --------------------------------------------------------- */
/* ---------------------------------------------------------
   PRODUCT COMPARISON
   --------------------------------------------------------- */
function updateCompareBar(){
  const bar = document.getElementById("compareBar");
  const count = document.getElementById("compareCount");
  if (!bar) return;
  if (COMPARE_IDS.size === 0){ bar.classList.add("hidden"); return; }
  bar.classList.remove("hidden");
  count.textContent = `${COMPARE_IDS.size} item${COMPARE_IDS.size > 1 ? "s" : ""} selected`;
}

function openCompareModal(){
  const all = [...(typeof PRODUCTS !== "undefined" ? PRODUCTS : []), ...(typeof PROJECTS !== "undefined" ? PROJECTS : [])];
  const items = [...COMPARE_IDS].map(id => all.find(p => String(p.id) === id)).filter(Boolean);
  if (!items.length) return;

  const rows = [
    { label: "Image", render: p => `<img src="${imageListFor(p)[0]}" alt="" loading="lazy" onerror="this.style.opacity='0.15'">` },
    { label: "Name", render: p => `<strong>${escapeHtml(p.name)}</strong>` },
    { label: "Category", render: p => escapeHtml(categoryName(p.category) || "Exhibition Project") },
    { label: "Price", render: p => formatPrice(p.price) },
    { label: "Spec", render: p => escapeHtml(p.spec || "—") },
    { label: "Rating", render: p => { const r = RATINGS_MAP[String(p.id)]; return r ? `★ ${r.avg} (${r.count})` : "No reviews yet"; } },
    { label: "Stock", render: p => (p.stock || "in").toUpperCase() },
    { label: "", render: p => `<button class="btn-ghost-sm" data-compare-add="${p.id}">Add to Cart</button>` }
  ];

  const table = document.getElementById("compareTable");
  table.innerHTML = `
    <tr><th></th>${items.map(p => `<th>${escapeHtml(p.name)}</th>`).join("")}</tr>
    ${rows.map(row => `<tr><th>${row.label}</th>${items.map(p => `<td>${row.render(p)}</td>`).join("")}</tr>`).join("")}
  `;
  table.querySelectorAll("[data-compare-add]").forEach(btn => {
    btn.addEventListener("click", () => {
      const item = items.find(p => String(p.id) === btn.dataset.compareAdd);
      if (item) addToCart(item);
    });
  });

  document.getElementById("compareOverlay").classList.add("open");
}

function wireCompare(){
  const openBtn = document.getElementById("compareOpenBtn");
  const clearBtn = document.getElementById("compareClearBtn");
  const overlay = document.getElementById("compareOverlay");
  const closeBtn = document.getElementById("compareClose");
  if (!openBtn) return;

  openBtn.addEventListener("click", openCompareModal);
  clearBtn.addEventListener("click", () => {
    COMPARE_IDS.clear();
    updateCompareBar();
    renderProducts();
    renderProjects();
  });
  closeBtn.addEventListener("click", () => overlay.classList.remove("open"));
  overlay.addEventListener("click", e => { if (e.target === overlay) overlay.classList.remove("open"); });
}

let ACTIVE_BUNDLES = [];
async function loadBundlesForHomepage(){
  const section = document.getElementById("bundlesSection");
  const grid = document.getElementById("bundlesGrid");
  if (!section || !supabaseReady()) return;

  const { data, error } = await supabase.from("bundles").select("*").eq("active", true);
  if (error || !data || !data.length){ section.classList.add("hidden"); ACTIVE_BUNDLES = []; return; }

  ACTIVE_BUNDLES = data;
  const all = [...(typeof PRODUCTS !== "undefined" ? PRODUCTS : [])];
  section.classList.remove("hidden");
  grid.innerHTML = data.map(b => {
    const items = (b.product_ids || []).map(id => all.find(p => String(p.id) === String(id))).filter(Boolean);
    const individualTotal = items.reduce((s, p) => s + Number(p.price || 0), 0);
    const savings = individualTotal - Number(b.bundle_price || 0);
    return `
      <div class="offer-card">
        <span class="offer-percent">${formatPrice(b.bundle_price)}</span>
        <strong>${escapeHtml(b.name)}</strong>
        <p style="font-size:.78rem; color:var(--muted); margin:4px 0;">${escapeHtml(items.map(p => p.name).join(" + "))}</p>
        ${savings > 0 ? `<span class="offer-expiry" style="color:var(--cyan);">Save ${formatPrice(savings)} vs buying separately</span>` : ""}
        <button class="offer-copy-btn" data-bundle-add="${b.id}" style="margin-top:8px;">Add Bundle to Cart</button>
      </div>`;
  }).join("");

  grid.querySelectorAll("[data-bundle-add]").forEach(btn => {
    btn.addEventListener("click", () => {
      const bundle = data.find(b => b.id === btn.dataset.bundleAdd);
      (bundle.product_ids || []).forEach(id => {
        const item = all.find(p => String(p.id) === String(id));
        if (item) addToCart(item);
      });
    });
  });
}

// Checks if the cart contains ALL items of any active bundle — if so, applies
// that bundle's special combo price automatically (best matching bundle wins).
function activeBundleDiscount(){
  let bestSavings = 0;
  ACTIVE_BUNDLES.forEach(b => {
    const ids = b.product_ids || [];
    if (!ids.length) return;
    const allInCart = ids.every(id => CART.some(c => String(c.id) === String(id)));
    if (!allInCart) return;
    const individualSum = ids.reduce((sum, id) => {
      const c = CART.find(c => String(c.id) === String(id));
      return sum + (c ? c.price : 0);
    }, 0);
    const savings = individualSum - Number(b.bundle_price || 0);
    if (savings > bestSavings) bestSavings = savings;
  });
  return Math.max(0, Math.round(bestSavings));
}

async function loadDeliveryCharges(){
  if (!supabaseReady()) return;
  const { data } = await supabase.from("settings").select("*").in("key", ["delivery_charge_lahore", "delivery_charge_other"]);
  if (!data) return;
  data.forEach(row => {
    if (row.key === "delivery_charge_lahore") DELIVERY_CHARGE_LAHORE = Number(row.value) || 0;
    if (row.key === "delivery_charge_other") DELIVERY_CHARGE_OTHER = Number(row.value) || 0;
  });
}

/* ---------------------------------------------------------
   ADS BANNER (admin-controlled images/video at the top)
   --------------------------------------------------------- */
async function loadImageAdsForPlacement(placement, bannerId, trackId){
  const banner = document.getElementById(bannerId);
  const track = document.getElementById(trackId);
  if (!banner || !supabaseReady()) return;

  const { data, error } = await supabase.from("ads").select("*").eq("active", true).eq("placement", placement).eq("media_type", "image").order("created_at", { ascending: true });
  if (error || !data || !data.length) return;

  banner.classList.remove("hidden");
  track.innerHTML = data.map(ad => {
    const media = `<img src="${ad.media_url}" alt="Advertisement" loading="eager">`;
    return ad.link_url
      ? `<a class="ads-slide" href="${ad.link_url}" target="_blank" rel="noopener">${media}</a>`
      : `<div class="ads-slide">${media}</div>`;
  }).join("");

  if (data.length > 1){
    let idx = 0;
    setInterval(() => {
      idx = (idx + 1) % data.length;
      track.style.transform = `translateX(-${idx * 100}%)`;
    }, 5000);
  }
}

async function loadSplashVideoAd(){
  const overlay = document.getElementById("splashAdOverlay");
  const video = document.getElementById("splashAdVideo");
  if (!overlay || !supabaseReady()) return;
  if (sessionStorage.getItem("akep_splash_seen")) return;

  const { data, error } = await supabase.from("ads").select("*").eq("active", true).eq("placement", "splash").eq("media_type", "video").limit(1).maybeSingle();
  if (error || !data) return;

  video.src = data.media_url;
  video.muted = true; // simple, reliable autoplay — tap the video to turn sound on
  overlay.classList.remove("hidden");
  document.body.style.overflow = "hidden";

  const closeSplash = () => {
    overlay.classList.add("hidden");
    document.body.style.overflow = "";
    video.pause();
    sessionStorage.setItem("akep_splash_seen", "1");
  };

  video.play().catch(() => {});
  document.getElementById("splashAdClose").addEventListener("click", closeSplash);
  video.addEventListener("ended", closeSplash);
  video.addEventListener("click", () => { video.muted = !video.muted; });

  // Hard cap: never show the splash ad for more than 1 minute
  setTimeout(closeSplash, 60000);
}

/* ---------------------------------------------------------
   CUSTOM ORDER INQUIRIES (product/project requests not on the site)
   --------------------------------------------------------- */
function wireCustomInquiryForms(){
  const webserviceForm = document.getElementById("webserviceForm");
  if (webserviceForm){
    webserviceForm.addEventListener("submit", async e => {
      e.preventDefault();
      const out = document.getElementById("webserviceMsg");
      const name = document.getElementById("webserviceName").value.trim();
      const phone = document.getElementById("webservicePhone").value.trim();
      const message = document.getElementById("webserviceMessage").value.trim();
      if (!supabaseReady()){
        out.style.color = "var(--pink)";
        out.textContent = "Backend not connected yet — please contact us on WhatsApp directly.";
        return;
      }
      const { error } = await supabase.from("website_inquiries").insert({ name, phone, message });
      if (error){ out.style.color = "var(--pink)"; out.textContent = error.message; return; }
      out.style.color = "var(--cyan)";
      out.textContent = "Sent! We'll get back to you soon.";
      webserviceForm.reset();
    });
  }

  const wire = (formId, nameId, phoneId, msgId, msgOutId, type) => {
    const form = document.getElementById(formId);
    if (!form) return;
    form.addEventListener("submit", async e => {
      e.preventDefault();
      const out = document.getElementById(msgOutId);
      const name = document.getElementById(nameId).value.trim();
      const phone = document.getElementById(phoneId).value.trim();
      const message = document.getElementById(msgId).value.trim();
      if (!supabaseReady()){
        out.style.color = "var(--pink)";
        out.textContent = "Backend not connected yet — please contact us on WhatsApp directly.";
        return;
      }
      const { error } = await supabase.from("custom_inquiries").insert({ type, name, phone, message });
      if (error){ out.style.color = "var(--pink)"; out.textContent = error.message; return; }
      out.style.color = "var(--cyan)";
      out.textContent = "Sent! We'll get back to you soon.";
      form.reset();
    });
  };
  wire("productInquiryForm", "productInquiryName", "productInquiryPhone", "productInquiryMessage", "productInquiryMsg", "product");
  wire("projectInquiryForm", "projectInquiryName", "projectInquiryPhone", "projectInquiryMessage", "projectInquiryMsg", "project");
}

/* ---------------------------------------------------------
   RECENTLY VIEWED
   --------------------------------------------------------- */
const RECENTLY_VIEWED_KEY = "akep_recently_viewed";

function trackRecentlyViewed(item){
  let ids = [];
  try { ids = JSON.parse(localStorage.getItem(RECENTLY_VIEWED_KEY) || "[]"); } catch(e){ ids = []; }
  ids = ids.filter(id => id !== String(item.id));
  ids.unshift(String(item.id));
  localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(ids.slice(0, 8)));
}

function renderRecentlyViewed(){
  const section = document.getElementById("recentlyViewedSection");
  const grid = document.getElementById("recentlyViewedGrid");
  if (!section) return;
  let ids = [];
  try { ids = JSON.parse(localStorage.getItem(RECENTLY_VIEWED_KEY) || "[]"); } catch(e){ ids = []; }
  const all = [...(typeof PRODUCTS !== "undefined" ? PRODUCTS : []), ...(typeof PROJECTS !== "undefined" ? PROJECTS : [])];
  const items = ids.map(id => all.find(p => String(p.id) === id)).filter(Boolean);
  if (!items.length){ section.classList.add("hidden"); return; }
  section.classList.remove("hidden");
  grid.innerHTML = items.map(p => `
    <div class="related-card" data-recent="${p.id}">
      <img src="${imageListFor(p)[0]}" alt="${escapeHtml(p.name)}" loading="lazy" onerror="this.style.opacity='0.15'">
      <span>${escapeHtml(p.name)}</span>
      <span class="rprice">${formatPrice(p.price)}</span>
    </div>
  `).join("");
  grid.querySelectorAll("[data-recent]").forEach(card => {
    card.addEventListener("click", () => {
      const item = all.find(p => String(p.id) === card.dataset.recent);
      if (item) openGallery(item);
    });
  });
}

function openGallery(item){
  trackRecentlyViewed(item);
  const images = imageListFor(item);
  const overlay = document.getElementById("galleryOverlay");
  const mainImg = document.getElementById("galleryMainImg");
  const thumbs = document.getElementById("galleryThumbs");

  // Show the first image that actually loads — auto-skip any broken ones
  // instead of showing a broken-image icon at the top.
  let mainIdx = 0;
  mainImg.onerror = () => {
    mainIdx++;
    if (mainIdx >= images.length){ mainImg.onerror = null; mainImg.src = ""; return; }
    mainImg.src = images[mainIdx];
  };
  mainImg.src = images[0];
  mainImg.alt = item.name;
  document.getElementById("galleryTitle").textContent = item.name;
  document.getElementById("gallerySpec").textContent = item.spec || "";
  const salesEl = document.getElementById("galleryRecentSales");
  if (salesEl && supabaseReady()){
    salesEl.style.display = "none";
    supabase.rpc("get_recent_sales", { product_id_param: item.id }).then(({ data }) => {
      if (data && data > 0){
        salesEl.textContent = `🔥 ${data} sold in the last 7 days`;
        salesEl.style.display = "block";
      }
    });
  }
  thumbs.innerHTML = images.map((src, i) => `<img src="${src}" data-idx="${i}" class="${i === 0 ? "active" : ""}" alt="${escapeHtml(item.name)} — photo ${i + 1}" loading="lazy" onerror="this.style.display='none'">`).join("");
  thumbs.querySelectorAll("img").forEach(t => {
    t.addEventListener("click", () => {
      mainImg.onerror = null; // this exact thumbnail already loaded fine, so no fallback needed
      mainImg.src = t.src;
      mainIdx = Number(t.dataset.idx);
      thumbs.querySelectorAll("img").forEach(x => x.classList.remove("active"));
      t.classList.add("active");
      document.getElementById("galleryMainImg").parentElement.classList.remove("zoomed");
    });
  });

  function goToSlide(newIdx){
    if (newIdx < 0) newIdx = images.length - 1;
    if (newIdx >= images.length) newIdx = 0;
    mainIdx = newIdx;
    mainImg.onerror = () => {
      mainIdx++;
      if (mainIdx >= images.length){ mainImg.onerror = null; mainImg.src = ""; return; }
      mainImg.src = images[mainIdx];
    };
    mainImg.src = images[mainIdx];
    thumbs.querySelectorAll("img").forEach((x, i) => x.classList.toggle("active", i === mainIdx));
    document.getElementById("galleryMainImg").parentElement.classList.remove("zoomed");
  }
  const prevBtn = document.getElementById("galleryPrevBtn");
  const nextBtn = document.getElementById("galleryNextBtn");
  prevBtn.onclick = (e) => { e.stopPropagation(); goToSlide(mainIdx - 1); };
  nextBtn.onclick = (e) => { e.stopPropagation(); goToSlide(mainIdx + 1); };
  prevBtn.style.display = images.length > 1 ? "flex" : "none";
  nextBtn.style.display = images.length > 1 ? "flex" : "none";

  const addBtn = document.getElementById("galleryAddBtn");
  addBtn.textContent = "Add to Cart";
  addBtn.onclick = () => {
    addToCart(item);
    addBtn.textContent = "Added ✓";
    setTimeout(() => { addBtn.textContent = "Add to Cart"; }, 1200);
  };

  const datasheetLink = document.getElementById("galleryDatasheetLink");
  if (item.datasheet_url){
    datasheetLink.href = item.datasheet_url;
    datasheetLink.classList.remove("hidden");
  } else {
    datasheetLink.classList.add("hidden");
  }

  renderRelatedProducts(item);
  loadReviewsFor(item);
  renderRecentlyViewed();
  overlay.classList.add("open");
}

async function loadAllRatings(){
  RATINGS_MAP = {};
  if (!supabaseReady()) return;
  const { data } = await supabase.from("reviews").select("product_id, rating");
  (data || []).forEach(r => {
    const key = String(r.product_id);
    if (!RATINGS_MAP[key]) RATINGS_MAP[key] = { sum: 0, count: 0 };
    RATINGS_MAP[key].sum += r.rating;
    RATINGS_MAP[key].count += 1;
  });
  Object.keys(RATINGS_MAP).forEach(key => {
    const { sum, count } = RATINGS_MAP[key];
    RATINGS_MAP[key] = { avg: (sum / count).toFixed(1), count };
  });
}

function ratingBadgeHtml(id){
  const r = RATINGS_MAP[String(id)];
  if (!r) return "";
  return `<span class="card-rating">★ ${r.avg} <span class="card-rating-count">(${r.count})</span></span>`;
}

async function loadReviewsFor(item){
  const listEl = document.getElementById("reviewsList");
  const summaryEl = document.getElementById("ratingSummary");
  const formWrap = document.getElementById("reviewFormWrap");
  listEl.innerHTML = `<p style="color:var(--muted); font-size:.85rem;">Loading reviews…</p>`;
  summaryEl.textContent = "";
  formWrap.innerHTML = "";

  if (!supabaseReady()){
    listEl.innerHTML = `<p style="color:var(--muted); font-size:.85rem;">Reviews aren't connected yet.</p>`;
    return;
  }

  const { data: reviews } = await supabase.from("reviews").select("*").eq("product_id", item.id).order("created_at", { ascending: false });
  const list = reviews || [];

  if (list.length){
    const avg = (list.reduce((s, r) => s + r.rating, 0) / list.length).toFixed(1);
    summaryEl.textContent = `${"★".repeat(Math.round(avg))}${"☆".repeat(5 - Math.round(avg))} ${avg} (${list.length})`;
    listEl.innerHTML = list.map(r => `
      <div class="review-item">
        <div class="review-stars">${"★".repeat(r.rating)}${"☆".repeat(5 - r.rating)}</div>
        <div class="review-name">${escapeHtml(r.customer_name || "Verified Buyer")}</div>
        ${r.comment ? `<p class="review-comment">${escapeHtml(r.comment)}</p>` : ""}
      </div>
    `).join("");
  } else {
    listEl.innerHTML = `<p style="color:var(--muted); font-size:.85rem;">No reviews yet — be the first!</p>`;
  }

  if (!currentUser){
    formWrap.innerHTML = `<p style="color:var(--muted); font-size:.82rem;">Log in to write a review.</p>`;
    return;
  }

  const myReview = list.find(r => r.user_id === currentUser.id);
  let selectedRating = myReview ? myReview.rating : 5;

  formWrap.innerHTML = `
    <div class="review-form">
      <div class="star-picker" id="starPicker">
        ${[1,2,3,4,5].map(n => `<span data-star="${n}" class="${n <= selectedRating ? "filled" : ""}">★</span>`).join("")}
      </div>
      <textarea id="reviewComment" rows="2" placeholder="Share your experience (optional)">${escapeHtml(myReview ? (myReview.comment || "") : "")}</textarea>
      <button type="button" class="btn btn-primary" id="submitReviewBtn">${myReview ? "Update Review" : "Submit Review"}</button>
      <p class="modal-msg" id="reviewMsg"></p>
    </div>
  `;

  const picker = document.getElementById("starPicker");
  picker.querySelectorAll("span").forEach(star => {
    star.addEventListener("click", () => {
      selectedRating = Number(star.dataset.star);
      picker.querySelectorAll("span").forEach(s => s.classList.toggle("filled", Number(s.dataset.star) <= selectedRating));
    });
  });

  document.getElementById("submitReviewBtn").addEventListener("click", async () => {
    const msg = document.getElementById("reviewMsg");
    const comment = document.getElementById("reviewComment").value.trim();
    const name = (currentProfile && currentProfile.full_name) || (currentUser.user_metadata && currentUser.user_metadata.full_name) || "Verified Buyer";
    const { error } = await supabase.from("reviews").upsert({
      product_id: item.id, user_id: currentUser.id, customer_name: name, rating: selectedRating, comment
    }, { onConflict: "product_id,user_id" });
    if (error){ msg.style.color = "var(--pink)"; msg.textContent = error.message; return; }
    msg.style.color = "var(--cyan)";
    msg.textContent = "Thanks for your review!";
    loadReviewsFor(item);
    loadAllRatings().then(() => { renderProducts(); renderProjects(); });
  });
}

function renderRelatedProducts(item){
  const grid = document.getElementById("relatedGrid");
  const all = [...(typeof PRODUCTS !== "undefined" ? PRODUCTS : []), ...(typeof PROJECTS !== "undefined" ? PROJECTS : [])];
  const related = all
    .filter(p => String(p.id) !== String(item.id) && p.category && p.category === item.category)
    .slice(0, 3);
  const fallback = related.length ? related : all.filter(p => String(p.id) !== String(item.id)).slice(0, 3);
  if (!fallback.length){ grid.innerHTML = ""; grid.parentElement.style.display = "none"; return; }
  grid.parentElement.style.display = "";
  grid.innerHTML = fallback.map(p => `
    <div class="related-card" data-related="${p.id}">
      <img src="${imageListFor(p)[0]}" alt="${escapeHtml(p.name)}" loading="lazy" onerror="this.style.opacity='0.15'">
      <span>${escapeHtml(p.name)}</span>
      <span class="rprice">${formatPrice(p.price)}</span>
    </div>
  `).join("");
  grid.querySelectorAll("[data-related]").forEach(card => {
    card.addEventListener("click", () => {
      const next = all.find(p => String(p.id) === card.dataset.related);
      if (next) openGallery(next);
    });
  });
}

function wireGalleryModal(){
  const overlay = document.getElementById("galleryOverlay");
  const closeBtn = document.getElementById("galleryClose");
  const mainBox = document.querySelector(".gallery-main");
  if (!overlay) return;
  closeBtn.addEventListener("click", () => { overlay.classList.remove("open"); mainBox.classList.remove("zoomed"); });
  overlay.addEventListener("click", e => { if (e.target === overlay) { overlay.classList.remove("open"); mainBox.classList.remove("zoomed"); } });
  mainBox.addEventListener("click", () => mainBox.classList.toggle("zoomed"));
}

/* ---------------------------------------------------------
   HELPERS
   --------------------------------------------------------- */
function buildWhatsAppLink(message){ return `https://wa.me/${SITE_CONFIG.whatsappNumber}?text=${encodeURIComponent(message)}`; }
function buildEmailLink(subject, body){ return `mailto:${SITE_CONFIG.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`; }
function formatPrice(n){ return `${SITE_CONFIG.currency} ${Number(n || 0).toLocaleString("en-PK")}`; }
function categoryName(id){ const f = CATEGORIES.find(c => c.id === id); return f ? f.name : (id || ""); }
function categoryIcon(id){ const f = CATEGORIES.find(c => c.id === id); return f ? f.icon : "⚡"; }

/* ---------------------------------------------------------
   CART (persists via localStorage — normal for a real site)
   --------------------------------------------------------- */
let CART = [];
function loadCart(){
  try{ CART = JSON.parse(localStorage.getItem("ak_cart") || "[]"); } catch(e){ CART = []; }
}
function saveCart(){
  try{ localStorage.setItem("ak_cart", JSON.stringify(CART)); } catch(e){ /* storage unavailable */ }
}
function addToCart(item){
  const existing = CART.find(c => c.id === item.id);
  if (existing) existing.qty += 1;
  else CART.push({ id: item.id, name: item.name, price: item.price, qty: 1, type: item.type || "product" });
  saveCart();
  renderCart();
}
function changeQty(id, delta){
  const line = CART.find(c => c.id === id);
  if (!line) return;
  line.qty += delta;
  if (line.qty <= 0) CART = CART.filter(c => c.id !== id);
  saveCart();
  renderCart();
}
function removeFromCart(id){
  CART = CART.filter(c => c.id !== id);
  saveCart();
  renderCart();
}
function cartTotal(){ return CART.reduce((sum, c) => sum + c.price * c.qty, 0); }

function currentDeliveryCharge(){
  const citySelect = document.getElementById("checkoutCity");
  if (!citySelect) return 0;
  return citySelect.value === "Lahore" ? DELIVERY_CHARGE_LAHORE : DELIVERY_CHARGE_OTHER;
}
function currentPointsRedeemed(){
  const check = document.getElementById("redeemPointsCheck");
  const total = cartTotal();
  if (!check || !check.checked) return 0;
  return Math.min(CURRENT_LOYALTY_POINTS, total); // 1 point = Rs 1, can't exceed cart total
}

let LIVE_REFERRAL_DISCOUNT = 0;

async function refreshLiveReferralDiscount(){
  LIVE_REFERRAL_DISCOUNT = 0;
  if (!currentUser || !supabaseReady()) return;
  try {
    const { data: myProfile } = await supabase.from("profiles").select("referred_by, referral_rewarded").eq("id", currentUser.id).maybeSingle();
    if (myProfile && myProfile.referred_by && !myProfile.referral_rewarded){
      const { count: pastOrders } = await supabase.from("orders").select("id", { count: "exact", head: true }).eq("user_id", currentUser.id);
      if (!pastOrders) LIVE_REFERRAL_DISCOUNT = 1; // flag only — exact amount computed against current total below
    }
  } catch(e){ /* ignore — referral discount just won't show if this fails */ }
  updateCheckoutTotalDisplay();
}

function updateCheckoutTotalDisplay(){
  const el = document.getElementById("checkoutTotal");
  if (!el) return;
  const total = cartTotal();
  const discount = APPLIED_COUPON ? Math.round(total * APPLIED_COUPON.discount_percent / 100) : 0;
  const delivery = currentDeliveryCharge();
  const pointsDiscount = currentPointsRedeemed();
  const bundleDiscount = activeBundleDiscount();
  const referralDiscount = LIVE_REFERRAL_DISCOUNT ? Math.round((total - discount) * 0.10) : 0;
  const finalTotal = total - discount - pointsDiscount - bundleDiscount - referralDiscount + delivery;

  const setRow = (rowId, valId, amount) => {
    const row = document.getElementById(rowId);
    if (!row) return;
    if (amount > 0){
      row.classList.remove("hidden");
      document.getElementById(valId).textContent = `− ${formatPrice(amount)}`;
    } else {
      row.classList.add("hidden");
    }
  };

  const subtotalEl = document.getElementById("bdSubtotal");
  if (subtotalEl) subtotalEl.textContent = formatPrice(total);
  const deliveryEl = document.getElementById("bdDelivery");
  if (deliveryEl) deliveryEl.textContent = delivery > 0 ? formatPrice(delivery) : "Free";

  setRow("bdDiscountRow", "bdDiscount", discount);
  setRow("bdBundleRow", "bdBundle", bundleDiscount);
  setRow("bdReferralRow", "bdReferral", referralDiscount);
  setRow("bdPointsRow", "bdPoints", pointsDiscount);

  el.textContent = formatPrice(finalTotal);
}

async function loadLoyaltyPointsForCheckout(){
  const row = document.getElementById("redeemPointsRow");
  const label = document.getElementById("redeemPointsLabel");
  if (!row || !currentUser || !supabaseReady()) return;
  const { data } = await supabase.from("profiles").select("loyalty_points").eq("id", currentUser.id).maybeSingle();
  CURRENT_LOYALTY_POINTS = (data && data.loyalty_points) || 0;
  if (CURRENT_LOYALTY_POINTS > 0){
    row.style.display = "flex";
    label.textContent = `Use my ${CURRENT_LOYALTY_POINTS} reward points (Rs ${CURRENT_LOYALTY_POINTS} off)`;
  } else {
    row.style.display = "none";
  }
}

function renderCart(){
  const list = document.getElementById("cartItems");
  const countEl = document.getElementById("cartCount");
  const totalEl = document.getElementById("cartTotal");
  countEl.textContent = CART.reduce((n, c) => n + c.qty, 0);
  totalEl.textContent = formatPrice(cartTotal());

  if (!CART.length){
    list.innerHTML = `<p class="cart-empty">Your cart is empty — add something from the Showcase.</p>`;
    return;
  }
  list.innerHTML = CART.map(c => `
    <div class="cart-item">
      <div>
        <div class="cart-item-name">${escapeHtml(c.name)}</div>
        <div class="price">${formatPrice(c.price)}</div>
      </div>
      <div class="cart-item-qty">
        <button data-act="dec" data-id="${c.id}">−</button>
        ${c.qty}
        <button data-act="inc" data-id="${c.id}">+</button>
        <button class="cart-item-remove" data-act="remove" data-id="${c.id}">Remove</button>
      </div>
    </div>
  `).join("");

  list.querySelectorAll("button[data-act]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      if (btn.dataset.act === "inc") changeQty(id, 1);
      if (btn.dataset.act === "dec") changeQty(id, -1);
      if (btn.dataset.act === "remove") removeFromCart(id);
    });
  });
}

/* ---------------------------------------------------------
   RENDERING
   --------------------------------------------------------- */
function renderMarquee(){
  const track = document.getElementById("marqueeTrack");
  const names = CATEGORIES.map(c => c.name.toUpperCase());
  const loop = [...names, ...names];
  track.innerHTML = loop.map(n => `<span>${n}</span><span>•</span>`).join("");
}

function renderCategories(){
  const grid = document.getElementById("catGrid");
  grid.innerHTML = CATEGORIES.map(cat => `
    <div class="cat-card reveal" data-cat="${cat.id}">
      <span class="cat-icon">${cat.icon}</span>
      <h3>${cat.name}</h3><p>${cat.desc}</p>
    </div>
  `).join("");
  grid.querySelectorAll(".cat-card").forEach(card => {
    card.addEventListener("click", () => {
      document.getElementById("shop").scrollIntoView({ behavior: "smooth" });
      setActiveFilter(card.dataset.cat);
    });
  });
  observeReveals(grid);
}

function renderFilters(){
  const row = document.getElementById("filterRow");
  const cats = [{ id: "all", name: "All" }, ...CATEGORIES.map(c => ({ id: c.id, name: c.name }))];
  row.innerHTML = cats.map(c => `<button class="filter-btn${c.id === "all" ? " active" : ""}" data-cat="${c.id}">${c.name}</button>`).join("");
  row.querySelectorAll(".filter-btn").forEach(btn => btn.addEventListener("click", () => setActiveFilter(btn.dataset.cat)));
}

function setActiveFilter(catId){
  document.querySelectorAll(".filter-btn").forEach(btn => btn.classList.toggle("active", btn.dataset.cat === catId));
  renderProducts(catId);
}

function renderProducts(filter = "all"){
  const grid = document.getElementById("productGrid");
  const list = filter === "all" ? PRODUCTS : PRODUCTS.filter(p => p.category === filter);
  if (!list.length){
    grid.innerHTML = `<p style="color:var(--muted)">No items in this category yet.</p>`;
    return;
  }
  grid.innerHTML = list.map(p => {
    const waMsg = `Hi ${SITE_CONFIG.shopName}, I want to order:\n${p.name}\nPrice: ${formatPrice(p.price)}\nQuantity: `;
    const emailBody = `Hi ${SITE_CONFIG.shopName},\n\nI'd like to order:\n- Item: ${p.name}\n- Price: ${formatPrice(p.price)}\n- Quantity: \n\nThanks!`;
    const stockLabel = p.stock === "low" ? "Low stock" : p.stock === "out" ? "Out of stock" : "In stock";
    return `
      <div class="product-card reveal">
        ${buildImgTag(p, categoryIcon(p.category))}
        <div class="product-body">
          <span class="product-cat">${categoryName(p.category)}</span>
          <h3>${escapeHtml(p.name)}${ratingBadgeHtml(p.id)}</h3>
          <p class="product-spec">${escapeHtml(p.spec || "")}</p>
          <div class="product-footer">
            <span class="price">${formatPrice(p.price)}</span>
            <div class="order-actions">
              ${p.stock === "out"
                ? `<button class="add-cart-btn notify-btn" data-notify="${p.id}" data-notify-name="${escapeAttr(p.name)}">🔔 Notify Me</button>`
                : `<button class="add-cart-btn" data-add="${p.id}">Add to Cart</button>`}
            </div>
          </div>
          <span class="stock-tag${p.stock === "low" ? " low" : ""}">${stockLabel}</span>
        </div>
      </div>
    `;
  }).join("");
  grid.querySelectorAll("[data-add]").forEach(btn => {
    btn.addEventListener("click", () => {
      const item = PRODUCTS.find(p => String(p.id) === btn.dataset.add);
      if (item) addToCart(item);
    });
  });
  grid.querySelectorAll("[data-notify]").forEach(btn => {
    btn.addEventListener("click", () => openNotifyMeModal(btn.dataset.notify, btn.dataset.notifyName));
  });
  wireGalleryAndWishlist(grid, PRODUCTS);
  observeReveals(grid);
}

function renderStarterKits(){
  const grid = document.getElementById("starterKitGrid");
  if (!grid) return;
  if (!STARTER_KITS.length){
    grid.innerHTML = `<p style="color:var(--muted)">Starter kits coming soon.</p>`;
    return;
  }
  grid.innerHTML = STARTER_KITS.map(p => {
    const stockLabel = p.stock === "low" ? "Low stock" : p.stock === "out" ? "Out of stock" : "In stock";
    return `
      <div class="product-card reveal">
        ${buildImgTag(p, "🎒")}
        <div class="product-body">
          <span class="product-cat">Starter Kit</span>
          <h3>${escapeHtml(p.name)}${ratingBadgeHtml(p.id)}</h3>
          <p class="product-spec">${escapeHtml(p.spec || "")}</p>
          <div class="product-footer">
            <span class="price">${formatPrice(p.price)}</span>
            <div class="order-actions">
              ${p.stock === "out"
                ? `<button class="add-cart-btn notify-btn" data-notify="${p.id}" data-notify-name="${escapeAttr(p.name)}">🔔 Notify Me</button>`
                : `<button class="add-cart-btn" data-add="${p.id}">Add to Cart</button>`}
            </div>
          </div>
          <span class="stock-tag${p.stock === "low" ? " low" : ""}">${stockLabel}</span>
        </div>
      </div>
    `;
  }).join("");
  grid.querySelectorAll("[data-add]").forEach(btn => {
    btn.addEventListener("click", () => {
      const item = STARTER_KITS.find(p => String(p.id) === btn.dataset.add);
      if (item) addToCart(item);
    });
  });
  grid.querySelectorAll("[data-notify]").forEach(btn => {
    btn.addEventListener("click", () => openNotifyMeModal(btn.dataset.notify, btn.dataset.notifyName));
  });
  wireGalleryAndWishlist(grid, STARTER_KITS);
  observeReveals(grid);
}

async function openNotifyMeModal(productId, productName){
  const email = prompt(`We'll email you when "${productName}" is back in stock.\n\nEnter your email:`);
  if (!email || !email.includes("@")) return;
  if (!supabaseReady()){ alert("Backend not connected yet — please contact us directly."); return; }
  const { error } = await supabase.from("restock_notifications").insert({ product_id: productId, product_name: productName, email: email.trim() });
  if (error){ alert("Something went wrong: " + error.message); return; }
  alert("Done! We'll email you as soon as it's back in stock.");
}

function renderProjects(){
  const grid = document.getElementById("projectGrid");
  grid.innerHTML = PROJECTS.map(proj => {
    const waMsg = `Hi ${SITE_CONFIG.shopName}, I'm interested in the exhibition project:\n${proj.name}\nPrice: ${formatPrice(proj.price)}\nCan you share more details?`;
    const emailBody = `Hi ${SITE_CONFIG.shopName},\n\nI'm interested in this exhibition project:\n- Project: ${proj.name}\n- Price: ${formatPrice(proj.price)}\n\nThanks!`;
    return `
      <div class="project-card reveal">
        ${buildImgTag(proj, "🛠️")}
        <div class="project-body">
          <h3>${escapeHtml(proj.name)}${ratingBadgeHtml(proj.id)}</h3>
          <p class="product-spec">${escapeHtml(proj.spec || "")}</p>
          <div class="project-footer">
            <span class="price">${formatPrice(proj.price)}</span>
            <div class="order-actions">
              <button class="add-cart-btn" data-add="${proj.id}">Add to Cart</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join("");
  grid.querySelectorAll("[data-add]").forEach(btn => {
    btn.addEventListener("click", () => {
      const item = PROJECTS.find(p => String(p.id) === btn.dataset.add);
      if (item) addToCart(item);
    });
  });
  wireGalleryAndWishlist(grid, PROJECTS);
  observeReveals(grid);
}

function renderDeals(){
  const grid = document.getElementById("dealGrid");
  grid.innerHTML = DEALS.map(d => {
    const waMsg = `Hi ${SITE_CONFIG.shopName}, I want to order this deal:\n${d.name}\nDeal price: ${formatPrice(d.newPrice)}`;
    return `
      <div class="deal-card reveal">
        <span class="deal-tag">${escapeHtml(d.tag)}</span>
        <h3>${escapeHtml(d.name)}</h3>
        <div><span class="deal-old">${formatPrice(d.oldPrice)}</span><span class="deal-new">${formatPrice(d.newPrice)}</span></div>
        <div class="deal-footer"><a class="order-btn" href="${buildWhatsAppLink(waMsg)}" target="_blank" rel="noopener">WhatsApp</a></div>
      </div>
    `;
  }).join("");
  observeReveals(grid);
}

function renderReviews(){
  const grid = document.getElementById("reviewGrid");
  grid.innerHTML = REVIEWS.map(r => `
    <div class="review-card reveal"><div class="stars">★★★★★</div><p>"${escapeHtml(r.text)}"</p><div class="review-name">${escapeHtml(r.name)}</div></div>
  `).join("");
  observeReveals(grid);
}

function wireGlobalOrderButtons(){
  const genericWaMsg = `Hi ${SITE_CONFIG.shopName}, I'd like to ask about your products.`;
  const genericEmailBody = `Hi ${SITE_CONFIG.shopName},\n\nI'd like to ask about your products / exhibition projects.\n\nThanks!`;
  const waLink = buildWhatsAppLink(genericWaMsg);
  const emailLink = buildEmailLink("General inquiry", genericEmailBody);
  ["locWhatsapp", "floatWhatsapp"].forEach(id => { const el = document.getElementById(id); if (el) el.href = waLink; });
  ["locEmailBtn", "floatEmail"].forEach(id => { const el = document.getElementById(id); if (el) el.href = emailLink; });
}

function fillLocationInfo(){
  document.getElementById("locAddress").textContent = SITE_CONFIG.address;
  document.getElementById("locHours").textContent = SITE_CONFIG.hours;
  document.getElementById("locPhone").textContent = SITE_CONFIG.phoneDisplay;
  document.getElementById("locEmail").textContent = SITE_CONFIG.email;
  document.getElementById("mapFrame").src = SITE_CONFIG.mapEmbedUrl;
  document.getElementById("year").textContent = new Date().getFullYear();
  document.getElementById("jazzcashNum").textContent = SITE_CONFIG.jazzCashNumber;
  document.getElementById("jazzcashTitle").textContent = SITE_CONFIG.jazzCashTitle;
  document.getElementById("easypaisaNum").textContent = SITE_CONFIG.easyPaisaNumber;
  document.getElementById("easypaisaTitle").textContent = SITE_CONFIG.easyPaisaTitle;
}

function wireMobileMenu(){
  const toggle = document.getElementById("menuToggle");
  const nav = document.getElementById("mainNav");
  toggle.addEventListener("click", () => nav.classList.toggle("open"));
  nav.querySelectorAll("a").forEach(a => a.addEventListener("click", () => nav.classList.remove("open")));
}

let revealObserver;
function observeReveals(container){
  if (!revealObserver){
    revealObserver = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting){ e.target.classList.add("in"); revealObserver.unobserve(e.target); } });
    }, { threshold: 0.1 });
  }
  container.querySelectorAll(".reveal:not(.in)").forEach(el => revealObserver.observe(el));
}

/* ---------------------------------------------------------
   AUTH (Supabase)
   --------------------------------------------------------- */
function wireLogin(){
  const openBtn = document.getElementById("loginOpenBtn");
  const overlay = document.getElementById("loginOverlay");
  const closeBtn = document.getElementById("modalClose");
  const tabs = document.querySelectorAll(".modal-tab");
  const loginForm = document.getElementById("loginForm");
  const signupForm = document.getElementById("signupForm");
  const loginMsg = document.getElementById("loginMsg");
  const signupMsg = document.getElementById("signupMsg");
  const note = document.getElementById("authModeNote");

  note.textContent = supabaseReady() ? "" : "Accounts aren't connected yet — add your Supabase URL & key in config.js (see BACKEND-SETUP.md).";

  function openModal(){ overlay.classList.add("open"); }
  function closeModal(){ overlay.classList.remove("open"); loginMsg.textContent = ""; signupMsg.textContent = ""; }

  openBtn.addEventListener("click", async () => {
    if (currentUser){ await supabase.auth.signOut(); return; }
    openModal();
  });
  closeBtn.addEventListener("click", closeModal);
  overlay.addEventListener("click", e => { if (e.target === overlay) closeModal(); });

  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      tabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      const isLogin = tab.dataset.tab === "login";
      loginForm.classList.toggle("hidden", !isLogin);
      signupForm.classList.toggle("hidden", isLogin);
    });
  });

  signupForm.addEventListener("submit", async e => {
    e.preventDefault();
    if (!supabaseReady()){ signupMsg.style.color = "var(--pink)"; signupMsg.textContent = "Backend not connected yet."; return; }
    const name = document.getElementById("signupName").value.trim();
    const phone = document.getElementById("signupPhone").value.trim();
    const email = document.getElementById("signupEmail").value.trim();
    const password = document.getElementById("signupPassword").value;

    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: name } } });
    if (error){ signupMsg.style.color = "var(--pink)"; signupMsg.textContent = error.message; return; }
    if (data.user){
      const myReferralCode = data.user.id.replace(/-/g, "").slice(0, 8).toUpperCase();
      const pendingRef = localStorage.getItem("akep_pending_ref");
      const updatePayload = { phone, full_name: name, referral_code: myReferralCode };
      if (pendingRef && pendingRef !== myReferralCode){
        const { data: referrer } = await supabase.from("profiles").select("id").eq("referral_code", pendingRef).maybeSingle();
        if (referrer) updatePayload.referred_by = referrer.id;
      }
      await supabase.from("profiles").update(updatePayload).eq("id", data.user.id);
      localStorage.removeItem("akep_pending_ref");
    }
    signupMsg.style.color = "var(--cyan)";
    signupMsg.textContent = "Account created! Check your email to confirm, then log in.";
    setTimeout(closeModal, 1400);
  });

  loginForm.addEventListener("submit", async e => {
    e.preventDefault();
    if (!supabaseReady()){ loginMsg.style.color = "var(--pink)"; loginMsg.textContent = "Backend not connected yet."; return; }
    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error){ loginMsg.style.color = "var(--pink)"; loginMsg.textContent = error.message; return; }
    loginMsg.style.color = "var(--cyan)";
    loginMsg.textContent = "Welcome back!";
    await refreshAuthState();
    setTimeout(closeModal, 700);
  });

  const googleBtn = document.getElementById("googleLoginBtn");
  const facebookBtn = document.getElementById("facebookLoginBtn");
  if (googleBtn) googleBtn.addEventListener("click", () => oauthLogin("google"));
  if (facebookBtn) facebookBtn.addEventListener("click", () => oauthLogin("facebook"));

  document.getElementById("forgotPasswordBtn").addEventListener("click", () => {
    closeModal();
    document.getElementById("forgotEmail").value = document.getElementById("loginEmail").value;
    document.getElementById("forgotOverlay").classList.add("open");
  });
}

function wireForgotAndReset(){
  const forgotOverlay = document.getElementById("forgotOverlay");
  const forgotForm = document.getElementById("forgotForm");
  const forgotMsg = document.getElementById("forgotMsg");
  document.getElementById("forgotClose").addEventListener("click", () => forgotOverlay.classList.remove("open"));
  forgotOverlay.addEventListener("click", e => { if (e.target === forgotOverlay) forgotOverlay.classList.remove("open"); });

  forgotForm.addEventListener("submit", async e => {
    e.preventDefault();
    if (!supabaseReady()){ forgotMsg.style.color = "var(--pink)"; forgotMsg.textContent = "Backend not connected yet."; return; }
    const email = document.getElementById("forgotEmail").value.trim();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + window.location.pathname
    });
    if (error){ forgotMsg.style.color = "var(--pink)"; forgotMsg.textContent = error.message; return; }
    forgotMsg.style.color = "var(--cyan)";
    forgotMsg.textContent = "Check your email for a reset link!";
  });

  const resetForm = document.getElementById("resetPasswordForm");
  const resetMsg = document.getElementById("resetPasswordMsg");
  resetForm.addEventListener("submit", async e => {
    e.preventDefault();
    const newPassword = document.getElementById("newPassword").value;
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error){ resetMsg.style.color = "var(--pink)"; resetMsg.textContent = error.message; return; }
    resetMsg.style.color = "var(--cyan)";
    resetMsg.textContent = "Password updated! You're logged in.";
    setTimeout(() => document.getElementById("resetPasswordOverlay").classList.remove("open"), 1500);
  });

  // Supabase fires this event when the person lands back here via the emailed reset link
  if (supabase){
    supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY"){
        document.getElementById("resetPasswordOverlay").classList.add("open");
      }
    });
  }
}

async function oauthLogin(provider){
  if (!supabaseReady()){
    alert("Backend not connected yet — Supabase isn't set up in config.js.");
    return;
  }
  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: window.location.origin + window.location.pathname }
  });
  if (error) alert(error.message);
  // Supabase redirects the whole page to Google/Facebook and back —
  // refreshAuthState() runs again automatically on page load via onAuthStateChange.
}

async function refreshAuthState(){
  if (!supabase) return;
  const { data: { user } } = await supabase.auth.getUser();
  currentUser = user || null;
  if (currentUser){
    const { data: profile } = await supabase.from("profiles").select("*").eq("id", currentUser.id).single();
    currentProfile = profile || null;
  } else {
    currentProfile = null;
  }
  await loadWishlist();
  renderProducts();
  renderProjects();
  updateAuthUI();
}

function updateAuthUI(){
  const btn = document.getElementById("loginOpenBtn");
  const ordersLink = document.getElementById("myOrdersLink");
  if (currentUser){
    const label = (currentProfile && currentProfile.full_name) ? currentProfile.full_name.split(" ")[0] : currentUser.email.split("@")[0];
    btn.textContent = `${label} · Logout`;
    ordersLink.classList.remove("hidden");
  } else {
    btn.textContent = "Login";
    ordersLink.classList.add("hidden");
    document.getElementById("myOrdersSection").classList.add("hidden");
  }
}

/* ---------------------------------------------------------
   CHECKOUT + ORDERS
   --------------------------------------------------------- */
function wireCartAndCheckout(){
  const cartOpenBtn = document.getElementById("cartOpenBtn");
  const cartOverlay = document.getElementById("cartOverlay");
  const cartClose = document.getElementById("cartClose");
  const checkoutOpenBtn = document.getElementById("checkoutOpenBtn");
  const checkoutOverlay = document.getElementById("checkoutOverlay");
  const checkoutClose = document.getElementById("checkoutClose");
  const checkoutForm = document.getElementById("checkoutForm");
  const checkoutMsg = document.getElementById("checkoutMsg");
  const payRadios = document.querySelectorAll('input[name="payMethod"]');
  const jazzDetails = document.getElementById("jazzcashDetails");
  const easyDetails = document.getElementById("easypaisaDetails");

  cartOpenBtn.addEventListener("click", () => { renderCart(); cartOverlay.classList.add("open"); });
  cartClose.addEventListener("click", () => cartOverlay.classList.remove("open"));
  cartOverlay.addEventListener("click", e => { if (e.target === cartOverlay) cartOverlay.classList.remove("open"); });

  checkoutOpenBtn.addEventListener("click", () => {
    if (!CART.length) return;
    const submitBtn = checkoutForm.querySelector('button[type="submit"]');
    submitBtn.disabled = false;
    submitBtn.textContent = "Place Order";

    const guestNotice = document.getElementById("guestCheckoutNotice");
    const guestEmailRow = document.getElementById("guestEmailRow");
    const loyaltyRow = document.getElementById("redeemPointsRow");

    if (!currentUser){
      // GUEST CHECKOUT — no account needed
      if (guestNotice) guestNotice.classList.remove("hidden");
      if (guestEmailRow) guestEmailRow.classList.remove("hidden");
      if (loyaltyRow) loyaltyRow.style.display = "none"; // rewards need an account
      document.getElementById("checkoutName").value = "";
      document.getElementById("checkoutPhone").value = "";
      document.getElementById("checkoutAddress").value = "";
      cartOverlay.classList.remove("open");
      checkoutOverlay.classList.add("open");
      APPLIED_COUPON = null;
      LIVE_REFERRAL_DISCOUNT = 0;
      CURRENT_LOYALTY_POINTS = 0;
      document.getElementById("checkoutCity").value = "Lahore";
      updateCheckoutTotalDisplay();
      return;
    }

    if (guestNotice) guestNotice.classList.add("hidden");
    if (guestEmailRow) guestEmailRow.classList.add("hidden");
    // Pre-fill name & phone from the saved profile so returning customers
    // don't have to retype them — address is intentionally left blank/editable
    // every time since delivery location can change.
    const nameField = document.getElementById("checkoutName");
    const phoneField = document.getElementById("checkoutPhone");
    if (currentProfile && currentProfile.full_name) nameField.value = currentProfile.full_name;
    else if (currentUser.user_metadata && currentUser.user_metadata.full_name) nameField.value = currentUser.user_metadata.full_name;
    if (currentProfile && currentProfile.phone) phoneField.value = currentProfile.phone;
    document.getElementById("checkoutAddress").value = "";
    document.getElementById("savedAddressSelect").value = "";
    document.getElementById("locationMsg").textContent = "";
    checkoutLat = null;
    checkoutLng = null;
    loadSavedAddresses();
    loadLoyaltyPointsForCheckout();
    refreshLiveReferralDiscount();
    updateCheckoutTotalDisplay();
    document.getElementById("checkoutCity").value = "Lahore";
    const redeemCheck = document.getElementById("redeemPointsCheck");
    if (redeemCheck) redeemCheck.checked = false;

    APPLIED_COUPON = null;
    document.getElementById("couponInput").value = "";
    document.getElementById("couponMsg").textContent = "";
    updateCheckoutTotalDisplay();

    cartOverlay.classList.remove("open");
    checkoutOverlay.classList.add("open");
  });
  checkoutClose.addEventListener("click", () => checkoutOverlay.classList.remove("open"));
  checkoutOverlay.addEventListener("click", e => { if (e.target === checkoutOverlay) checkoutOverlay.classList.remove("open"); });

  document.getElementById("checkoutCity").addEventListener("change", updateCheckoutTotalDisplay);
  document.getElementById("redeemPointsCheck").addEventListener("change", updateCheckoutTotalDisplay);
  document.getElementById("applyCouponBtn").addEventListener("click", async () => {
    const code = document.getElementById("couponInput").value.trim().toUpperCase();
    const msg = document.getElementById("couponMsg");
    if (!code){ msg.style.color = "var(--pink)"; msg.textContent = "Enter a code first."; return; }
    if (!supabaseReady()){ msg.style.color = "var(--pink)"; msg.textContent = "Backend not connected yet."; return; }
    const { data, error } = await supabase.from("coupons").select("*").eq("code", code).eq("active", true).maybeSingle();
    if (error || !data){ msg.style.color = "var(--pink)"; msg.textContent = "Invalid or expired coupon."; APPLIED_COUPON = null; updateCheckoutTotalDisplay(); return; }
    if (data.expires_at && new Date(data.expires_at) < new Date()){ msg.style.color = "var(--pink)"; msg.textContent = "This coupon has expired."; APPLIED_COUPON = null; updateCheckoutTotalDisplay(); return; }
    const appliesTo = data.applies_to || "all";
    if (appliesTo !== "all" && !CART.some(c => c.type === appliesTo)){
      msg.style.color = "var(--pink)";
      msg.textContent = `This coupon only applies to ${appliesTo === "product" ? "products" : "exhibition projects"}.`;
      APPLIED_COUPON = null; updateCheckoutTotalDisplay();
      return;
    }
    APPLIED_COUPON = { code: data.code, discount_percent: data.discount_percent };
    msg.style.color = "var(--cyan)";
    msg.textContent = `Applied! ${data.discount_percent}% off.`;
    updateCheckoutTotalDisplay();
  });

  payRadios.forEach(r => r.addEventListener("change", () => {
    document.querySelectorAll('input[name="payMethod"]').forEach(x => {
      if (x.value === "jazzcash") jazzDetails.classList.toggle("hidden", !x.checked);
      if (x.value === "easypaisa") easyDetails.classList.toggle("hidden", !x.checked);
    });
  }));

  checkoutForm.addEventListener("submit", async e => {
    e.preventDefault();
    const submitBtn = checkoutForm.querySelector('button[type="submit"]');
    if (submitBtn.disabled) return; // already submitting — ignore a fast double-click
    submitBtn.disabled = true;
    submitBtn.textContent = "Placing order…";
    const honeypot = document.getElementById("checkoutHoneypot");
    if (honeypot && honeypot.value.trim() !== ""){
      // Silently drop likely-bot submissions without any error clue for scripts probing the form
      return;
    }
    if (!supabaseReady()){
      checkoutMsg.style.color = "var(--pink)";
      checkoutMsg.textContent = "Backend not connected yet — orders can't be saved until Supabase is set up.";
      submitBtn.disabled = false;
      submitBtn.textContent = "Place Order";
      return;
    }
    const name = document.getElementById("checkoutName").value.trim();
    const phone = document.getElementById("checkoutPhone").value.trim();
    const address = document.getElementById("checkoutAddress").value.trim();
    const isGuest = !currentUser;
    const guestEmail = isGuest ? document.getElementById("checkoutGuestEmail").value.trim() : "";
    if (isGuest && !guestEmail){
      checkoutMsg.style.color = "var(--pink)";
      checkoutMsg.textContent = "Please enter your email so we can confirm your order.";
      submitBtn.disabled = false;
      submitBtn.textContent = "Place Order";
      return;
    }
    const method = document.querySelector('input[name="payMethod"]:checked').value;
    const txnId = method === "jazzcash" ? document.getElementById("jazzcashTxnId").value.trim()
                : method === "easypaisa" ? document.getElementById("easypaisaTxnId").value.trim()
                : "";

    const total = cartTotal();
    const discountAmount = APPLIED_COUPON ? Math.round(total * APPLIED_COUPON.discount_percent / 100) : 0;
    const deliveryCity = document.getElementById("checkoutCity").value;
    const deliveryCharge = currentDeliveryCharge();
    const pointsRedeemed = currentPointsRedeemed();
    const bundleDiscount = activeBundleDiscount();

    // Referral reward: if this customer was referred and hasn't been rewarded
    // yet, and this is their very first order, give them 10% off automatically.
    // (Guests don't have an account, so referral tracking doesn't apply to them.)
    let referralDiscount = 0;
    let referrerIdToReward = null;
    if (!isGuest){
      const { data: myProfile } = await supabase.from("profiles").select("referred_by, referral_rewarded").eq("id", currentUser.id).maybeSingle();
      if (myProfile && myProfile.referred_by && !myProfile.referral_rewarded){
        const { count: pastOrders } = await supabase.from("orders").select("id", { count: "exact", head: true }).eq("user_id", currentUser.id);
        if (!pastOrders){
          referralDiscount = Math.round((total - discountAmount) * 0.10);
          referrerIdToReward = myProfile.referred_by;
        }
      }
    }

    const finalTotal = total - discountAmount - pointsRedeemed - bundleDiscount - referralDiscount + deliveryCharge;
    const fullPayload = {
      user_id: isGuest ? null : currentUser.id, customer_name: name, phone, address,
      payment_method: method, transaction_id: txnId, status: "pending", total: finalTotal,
      coupon_code: APPLIED_COUPON ? APPLIED_COUPON.code : null, discount_amount: discountAmount,
      customer_email: isGuest ? guestEmail : currentUser.email,
      latitude: checkoutLat, longitude: checkoutLng,
      delivery_city: deliveryCity, delivery_charge: deliveryCharge, points_redeemed: pointsRedeemed,
      referral_discount: referralDiscount
    };
    let { data: order, error: orderErr } = await supabase.from("orders").insert(fullPayload).select().single();

    // Safety net: if the database is missing a newer column (e.g. referral_discount
    // hasn't been added yet), retry with only the essential fields so the order
    // still goes through instead of failing completely.
    if (orderErr && /column/i.test(orderErr.message || "")){
      const basicPayload = {
        user_id: isGuest ? null : currentUser.id, customer_name: name, phone, address,
        payment_method: method, transaction_id: txnId, status: "pending", total: finalTotal
      };
      ({ data: order, error: orderErr } = await supabase.from("orders").insert(basicPayload).select().single());
    }

    if (orderErr){
      checkoutMsg.style.color = "var(--pink)"; checkoutMsg.textContent = orderErr.message;
      submitBtn.disabled = false;
      submitBtn.textContent = "Place Order";
      return;
    }

    if (referrerIdToReward){
      await supabase.from("profiles").update({ referral_rewarded: true }).eq("id", currentUser.id);
      const { data: referrerProfile } = await supabase.from("profiles").select("loyalty_points").eq("id", referrerIdToReward).maybeSingle();
      const newReferrerPoints = ((referrerProfile && referrerProfile.loyalty_points) || 0) + 200;
      await supabase.from("profiles").update({ loyalty_points: newReferrerPoints }).eq("id", referrerIdToReward);
    }

    // Update loyalty points: subtract what was redeemed, add newly earned points
    // (1 point per Rs 100 spent on the items, delivery charge excluded)
    // Guests don't have an account, so no points are tracked for them.
    if (!isGuest){
      const pointsEarned = Math.floor((total - discountAmount) / 100);
      const newPointsBalance = Math.max(0, CURRENT_LOYALTY_POINTS - pointsRedeemed + pointsEarned);
      await supabase.from("profiles").upsert({ id: currentUser.id, loyalty_points: newPointsBalance });
    }

    const items = CART.map(c => ({ order_id: order.id, product_id: (String(c.id).startsWith("fb-") ? null : c.id), product_name: c.name, price: c.price, quantity: c.qty }));
    await supabase.from("order_items").insert(items);

    // Save name & phone to the profile so next time the customer checks out,
    // these are pre-filled automatically — only the address stays editable.
    // (Guests have no profile to save to.)
    if (!isGuest){
      await supabase.from("profiles").upsert({ id: currentUser.id, full_name: name, phone });
      await maybeSaveNewAddress(address);
      currentProfile = { ...(currentProfile || {}), id: currentUser.id, full_name: name, phone };
    }

    const summary = CART.map(c => `${c.name} x${c.qty} — ${formatPrice(c.price * c.qty)}`).join("\n");
    const notifyMethod = document.querySelector('input[name="notifyMethod"]:checked').value;
    const discountLine = discountAmount > 0 ? `\nCoupon: ${APPLIED_COUPON.code} (-${formatPrice(discountAmount)})` : "";
    const msgBody = `New order #${order.id.slice(0,8)}\nCustomer: ${name} (${phone})\nAddress: ${address}\nPayment: ${method}${txnId ? " (txn: " + txnId + ")" : ""}\n\n${summary}${discountLine}\n\nTotal: ${formatPrice(finalTotal)}`;

    // Always alert admin + the relevant agent(s) by email — regardless of the
    // customer's own notifyMethod choice — so staff know an order came in
    // without needing to keep the admin/agent panel open.
    const alertSubject = `🔔 New order #${order.id.slice(0,8)} — ${SITE_CONFIG.shopName}`;
    const sendAlert = (accessKey) => {
      if (!accessKey) return;
      fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ access_key: accessKey, subject: alertSubject, from_name: name, email: SITE_CONFIG.email, message: msgBody })
      }).catch(() => {});
    };
    sendAlert(SITE_CONFIG.web3formsAccessKey); // admin always alerted
    if (CART.some(c => c.type === "product")) sendAlert(SITE_CONFIG.productsAgentWeb3FormsKey);
    if (CART.some(c => c.type === "project")) sendAlert(SITE_CONFIG.projectsAgentWeb3FormsKey);

    if (notifyMethod === "whatsapp"){
      window.open(buildWhatsAppLink(msgBody), "_blank");
    } else if (notifyMethod === "email" && SITE_CONFIG.web3formsAccessKey){
      fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({
          access_key: SITE_CONFIG.web3formsAccessKey,
          subject: `New order #${order.id.slice(0,8)} — ${SITE_CONFIG.shopName}`,
          from_name: name,
          email: SITE_CONFIG.email, // keeps this a self-email so it lands in your inbox
          message: msgBody
        })
      }).catch(() => {}); // order is already saved in Supabase either way
    } else if (notifyMethod === "email"){
      window.location.href = buildEmailLink(`New order #${order.id.slice(0,8)}`, msgBody);
    }
    // notifyMethod === "direct" → order is saved in Supabase, nothing else happens

    const itemsHtml = CART.map(c => `<li>${escapeHtml(c.name)} × ${c.qty} — ${formatPrice(c.price * c.qty)}</li>`).join("");
    const discountHtml = discountAmount > 0 ? `Coupon ${escapeHtml(APPLIED_COUPON.code)}: -${formatPrice(discountAmount)}<br>` : "";
    checkoutMsg.innerHTML = `
      <strong style="color:var(--cyan)">✓ Order placed — #${order.id.slice(0,8)}</strong>
      <ul style="margin:10px 0; padding-left:18px; text-align:left;">${itemsHtml}</ul>
      <div style="text-align:left; opacity:.85;">
        ${discountHtml}Total: ${formatPrice(finalTotal)}<br>
        Deliver to: ${escapeHtml(address)}<br>
        Estimated delivery: 2–4 business days
      </div>
      <button type="button" class="btn-ghost-sm" id="printReceiptBtn" style="margin-top:10px;">🖨️ Print Receipt</button>`;
    fireConfetti();

    document.getElementById("printReceiptArea").innerHTML = `
      <h2>${SITE_CONFIG.shopName}</h2>
      <p>${SITE_CONFIG.address}<br>${SITE_CONFIG.phoneDisplay} · ${SITE_CONFIG.email}</p>
      <hr>
      <p><strong>Order #${order.id.slice(0,8)}</strong><br>${new Date().toLocaleString("en-GB")}</p>
      <p>Customer: ${escapeHtml(name)} (${escapeHtml(phone)})<br>Deliver to: ${escapeHtml(address)}</p>
      <hr>
      <table style="width:100%; border-collapse:collapse;">
        ${CART.map(c => `<tr><td>${escapeHtml(c.name)} × ${c.qty}</td><td style="text-align:right;">${formatPrice(c.price * c.qty)}</td></tr>`).join("")}
      </table>
      <hr>
      ${discountAmount > 0 ? `<p>Coupon ${escapeHtml(APPLIED_COUPON.code)}: -${formatPrice(discountAmount)}</p>` : ""}
      <p><strong>Total: ${formatPrice(finalTotal)}</strong></p>
      <p>Payment: ${escapeHtml(method)}${txnId ? " (txn: " + escapeHtml(txnId) + ")" : ""}</p>
      <p style="margin-top:20px; text-align:center; opacity:.7;">Thank you for shopping with ${SITE_CONFIG.shopName}!</p>
    `;
    document.getElementById("printReceiptBtn").addEventListener("click", () => window.print());

    APPLIED_COUPON = null;
    CART = [];
    saveCart();
    renderCart();
    setTimeout(() => { checkoutOverlay.classList.remove("open"); checkoutMsg.innerHTML = ""; loadMyOrders(); }, 4000);
  });
}

function orderTimelineHtml(status){
  if (status === "cancelled"){
    return `<div class="order-cancelled">✕ Order Cancelled</div>`;
  }
  const steps = [
    { key: "pending", label: "Placed", icon: "📦" },
    { key: "confirmed", label: "Confirmed", icon: "✅" },
    { key: "shipped", label: "Shipped", icon: "🚚" },
    { key: "delivered", label: "Delivered", icon: "🎉" }
  ];
  const activeIndex = Math.max(0, steps.findIndex(s => s.key === status));
  return `
    <div class="order-timeline">
      ${steps.map((s, i) => `
        <div class="timeline-step ${i <= activeIndex ? "done" : ""} ${i === activeIndex ? "current" : ""}">
          <div class="timeline-dot">${s.icon}</div>
          <span class="timeline-label">${s.label}</span>
        </div>
        ${i < steps.length - 1 ? `<div class="timeline-line ${i < activeIndex ? "done" : ""}"></div>` : ""}
      `).join("")}
    </div>`;
}

async function loadMyOrders(){
  const section = document.getElementById("myOrdersSection");
  const list = document.getElementById("ordersList");
  if (!currentUser || !supabase) return;

  const { data: profileData } = await supabase.from("profiles").select("loyalty_points, referral_code").eq("id", currentUser.id).maybeSingle();
  const pointsEl = document.getElementById("loyaltyPointsValue");
  if (pointsEl) pointsEl.textContent = (profileData && profileData.loyalty_points) || 0;

  let myCode = profileData && profileData.referral_code;
  if (!myCode){
    myCode = currentUser.id.replace(/-/g, "").slice(0, 8).toUpperCase();
    await supabase.from("profiles").upsert({ id: currentUser.id, referral_code: myCode });
  }
  const linkInput = document.getElementById("referralLinkInput");
  if (linkInput) linkInput.value = `${window.location.origin}${window.location.pathname}?ref=${myCode}`;

  const { data: orders, error } = await supabase.from("orders").select("*, order_items(*)").eq("user_id", currentUser.id).order("created_at", { ascending: false });
  if (error || !orders) return;
  section.classList.remove("hidden");
  if (!orders.length){
    list.innerHTML = `<p class="cart-empty">No orders yet.</p>`;
    return;
  }
  list.innerHTML = orders.map(o => {
    const estDate = new Date(o.created_at);
    estDate.setDate(estDate.getDate() + 3);
    const estText = o.status === "delivered" ? "" : `<div style="color:var(--muted); font-size:.78rem; margin-top:4px;">📦 Estimated delivery: ${estDate.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</div>`;
    const payStatus = o.payment_status || "unpaid";
    const paymentBadge = (o.payment_method === "jazzcash" || o.payment_method === "easypaisa")
      ? `<div style="font-size:.78rem; margin-top:4px; color:${payStatus === "paid" ? "#4dff8f" : "#f5c542"};">${payStatus === "paid" ? "✅ Payment confirmed" : "⏳ Payment pending confirmation"}</div>`
      : "";
    return `
    <div class="order-card">
      <div style="width:100%;">
        <div class="order-id">#${o.id.slice(0,8)} · ${new Date(o.created_at).toLocaleDateString()}</div>
        <div>${(o.order_items || []).map(i => `${i.product_name} x${i.quantity}`).join(", ")}</div>
        <div class="price">${formatPrice(o.total)}</div>
        ${orderTimelineHtml(o.status)}
        ${estText}
        ${paymentBadge}
        <button class="btn-ghost-sm" data-invoice-id="${o.id}" style="margin-top:8px;">📄 Download Invoice (PDF)</button>
      </div>
    </div>
  `;
  }).join("");

  list.querySelectorAll("[data-invoice-id]").forEach(btn => {
    btn.addEventListener("click", () => {
      const order = orders.find(o => o.id === btn.dataset.invoiceId);
      if (order) downloadInvoicePdf(order);
    });
  });
}

function downloadInvoicePdf(order){
  if (typeof window.jspdf === "undefined"){ alert("PDF library didn't load — please check your internet connection and try again."); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  doc.setFontSize(16);
  doc.text(SITE_CONFIG.shopName, 14, 18);
  doc.setFontSize(10);
  doc.text(SITE_CONFIG.address, 14, 25);
  doc.text(SITE_CONFIG.phoneDisplay, 14, 30);

  doc.setFontSize(13);
  doc.text(`Invoice — Order #${order.id.slice(0,8)}`, 14, 44);
  doc.setFontSize(10);
  doc.text(`Date: ${new Date(order.created_at).toLocaleDateString()}`, 14, 51);
  doc.text(`Customer: ${order.customer_name}`, 14, 57);
  doc.text(`Phone: ${order.phone}`, 14, 63);
  doc.text(`Address: ${order.address}`, 14, 69);
  doc.text(`Payment: ${order.payment_method}${order.transaction_id ? " (txn: " + order.transaction_id + ")" : ""}`, 14, 75);

  let y = 90;
  doc.setFontSize(11);
  doc.text("Item", 14, y);
  doc.text("Qty", 130, y);
  doc.text("Price", 160, y);
  y += 4;
  doc.line(14, y, 196, y);
  y += 6;
  doc.setFontSize(10);
  (order.order_items || []).forEach(i => {
    doc.text(String(i.product_name).slice(0, 55), 14, y);
    doc.text(String(i.quantity), 130, y);
    doc.text(formatPrice(i.price || 0), 160, y);
    y += 7;
  });
  y += 4;
  doc.line(14, y, 196, y);
  y += 8;
  doc.setFontSize(12);
  doc.text(`Total: ${formatPrice(order.total)}`, 140, y);

  doc.save(`Invoice-${order.id.slice(0,8)}.pdf`);
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("myOrdersLink").addEventListener("click", e => {
    e.preventDefault();
    document.getElementById("myOrdersSection").classList.remove("hidden");
    document.getElementById("myOrdersSection").scrollIntoView({ behavior: "smooth" });
    loadMyOrders();
  });
});

/* ---------------------------------------------------------
   INIT
   --------------------------------------------------------- */
function safeRun(label, fn){
  try { fn(); }
  catch(err){ console.error(`[init] ${label} failed:`, err); }
}

async function init(){
  const refParam = new URLSearchParams(window.location.search).get("ref");
  if (refParam) localStorage.setItem("akep_pending_ref", refParam.toUpperCase());

  safeRun("loadCart", loadCart);
  safeRun("initSupabase", initSupabase);
  try { await loadCatalog(); } catch(err){ console.error("[init] loadCatalog failed:", err); }
  try { await loadAllRatings(); } catch(err){ console.error("[init] loadAllRatings failed:", err); }

  safeRun("initTheme", initTheme);
  safeRun("wireSearch", wireSearch);
  safeRun("renderMarquee", renderMarquee);
  safeRun("renderCategories", renderCategories);
  safeRun("renderFilters", renderFilters);
  safeRun("renderProducts", renderProducts);
  safeRun("renderStarterKits", renderStarterKits);
  safeRun("renderProjects", renderProjects);
  safeRun("renderDeals", renderDeals);
  if (supabase) loadActiveOffers();
  safeRun("renderReviews", renderReviews);
  safeRun("renderCart", renderCart);
  safeRun("wireGlobalOrderButtons", wireGlobalOrderButtons);
  safeRun("fillLocationInfo", fillLocationInfo);
  safeRun("wireMobileMenu", wireMobileMenu);
  safeRun("wireLogin", wireLogin);
  safeRun("wireForgotAndReset", wireForgotAndReset);
  safeRun("wireCartAndCheckout", wireCartAndCheckout);
  safeRun("wireWishlistModal", wireWishlistModal);
  safeRun("wireGalleryModal", wireGalleryModal);
  safeRun("wireFAQ", wireFAQ);
  safeRun("wireContactForm", wireContactForm);
  safeRun("wireNewsletter", wireNewsletter);
  safeRun("wireAddressBook", wireAddressBook);
  safeRun("wireScrollTop", wireScrollTop);
  safeRun("wireEscapeToClose", wireEscapeToClose);
  safeRun("wireLocationDetect", wireLocationDetect);
  safeRun("renderRecentlyViewed", renderRecentlyViewed);
  safeRun("wireCompare", wireCompare);
  safeRun("wireCustomInquiryForms", wireCustomInquiryForms);
  safeRun("wireReferralCopy", () => {
    document.getElementById("copyReferralBtn")?.addEventListener("click", () => {
      const input = document.getElementById("referralLinkInput");
      navigator.clipboard.writeText(input.value);
      const btn = document.getElementById("copyReferralBtn");
      const original = btn.textContent;
      btn.textContent = "Copied ✓";
      setTimeout(() => btn.textContent = original, 1500);
    });
  });
  safeRun("wireGuestLoginLink", () => {
    document.getElementById("guestLoginLink")?.addEventListener("click", (e) => {
      e.preventDefault();
      document.getElementById("checkoutOverlay").classList.remove("open");
      document.getElementById("loginOverlay").classList.add("open");
    });
  });
  if (supabase) loadDeliveryCharges();
  if (supabase) loadBundlesForHomepage();
  if (supabase) loadImageAdsForPlacement("mid", "midAdsBanner", "midAdsBannerTrack");
  if (supabase) loadImageAdsForPlacement("starterkit", "kitAdsBanner", "kitAdsBannerTrack");
  if (supabase) loadSplashVideoAd();
  if (supabase) supabase.rpc("get_todays_order_count").then(({ data }) => {
    const badge = document.getElementById("ordersTodayBadge");
    if (badge && data && data > 0){
      badge.textContent = `🛒 ${data} order${data > 1 ? "s" : ""} placed today`;
      badge.style.display = "block";
    }
  });

  if (supabase){
    try { await refreshAuthState(); } catch(err){ console.error("[init] refreshAuthState failed:", err); }
    supabase.auth.onAuthStateChange((_event, _session) => { refreshAuthState().catch(err => console.error("[auth change] refreshAuthState failed:", err)); });
  }
}

document.addEventListener("DOMContentLoaded", init);

if ("serviceWorker" in navigator){
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
