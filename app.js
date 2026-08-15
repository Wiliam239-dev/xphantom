const App = {
  currentUser: null,
  users: [],
  tokens: [],
  theme: localStorage.getItem("theme") || "dark",

  // ── Init ──────────────────────────────────────────────────
  async init() {
    this.applyTheme(this.theme);
    this.bindThemeToggle();

    // Cek session
    const saved = sessionStorage.getItem("currentUser");
    if (saved) {
      this.currentUser = JSON.parse(saved);
      await this.loadData();
      this.showDashboard();
    } else {
      this.showLogin();
    }
  },

  // ── Data Layer ────────────────────────────────────────────
  async loadData() {
    showLoader();
    try {
      if (CONFIG.sandbox_mode) {
        this.users  = SandboxDB.getUsers();
        this.tokens = SandboxDB.getTokens();
      } else {
        this.users  = await GithubAPI.fetchUsers();
        this.tokens = await GithubAPI.fetchTokens();
      }
    } catch(e) {
      showToast("Gagal memuat data: " + e.message, "error");
    }
    hideLoader();
  },

  async persistUsers() {
    if (CONFIG.sandbox_mode) { SandboxDB.saveUsers(this.users); return; }
    await GithubAPI.saveUsers(this.users);
  },

  async persistTokens() {
    if (CONFIG.sandbox_mode) { SandboxDB.saveTokens(this.tokens); return; }
    await GithubAPI.saveTokens(this.tokens);
  },

  // ── AUTH ──────────────────────────────────────────────────
  async login(username, password) {
    showLoader();
    await sleep(900);

    let user = null;

    if (CONFIG.sandbox_mode) {
      // Sandbox: cek kredensial demo
      const creds = CONFIG.sandbox_credentials;
      if (username === creds.developer.username && password === creds.developer.password)
        user = { username, role: "developer" };
      else if (username === creds.member.username && password === creds.member.password)
        user = { username, role: "member" };
      else {
        // Cek juga di SandboxDB
        const u = SandboxDB.getUsers().find(u => u.username === username && u.password === password);
        if (u) user = { username: u.username, role: u.role };
      }
    } else {
      // Real: cek dari GitHub
      try {
        const users = await GithubAPI.fetchUsers();
        const found = users.find(u => u.username === username && u.password === password);
        if (found) user = { username: found.username, role: found.role };
      } catch(e) {
        hideLoader();
        showToast("Gagal terhubung ke GitHub: " + e.message, "error");
        return;
      }
    }

    hideLoader();
    if (!user) { showToast("Username atau password salah!", "error"); shake("#loginBox"); return; }

    this.currentUser = user;
    sessionStorage.setItem("currentUser", JSON.stringify(user));
    await this.loadData();
    this.showDashboard();
    showToast(`Selamat datang, ${user.username}! 👋`, "success");
  },

  logout() {
    sessionStorage.clear();
    this.currentUser = null;
    this.showLogin();
    showToast("Berhasil logout.", "info");
  },

  // ── VIEWS ─────────────────────────────────────────────────
  showLogin() {
    document.getElementById("loginSection").classList.remove("hidden");
    document.getElementById("dashboardSection").classList.add("hidden");
  },

  showDashboard() {
    document.getElementById("loginSection").classList.add("hidden");
    document.getElementById("dashboardSection").classList.remove("hidden");
    this.renderDashboard();
  },

  renderDashboard() {
    const u = this.currentUser;
    document.getElementById("userDisplayName").textContent = u.username;
    document.getElementById("userRoleBadge").textContent   = u.role.toUpperCase();
    document.getElementById("userRoleBadge").className     = `role-badge role-${u.role}`;

    // Menu sesuai role
    const devMenu = document.getElementById("devMenu");
    if (u.role === "developer") devMenu.classList.remove("hidden");
    else devMenu.classList.add("hidden");

    this.renderThanksTo();
    this.renderTokens();
    if (u.role === "developer") this.renderUsers();

    // Tampilkan konten default
    this.switchTab("thanks");
  },

  // ── TAB SWITCHING ─────────────────────────────────────────
  switchTab(tab) {
    document.querySelectorAll(".tab-content").forEach(el => el.classList.remove("active-tab"));
    document.querySelectorAll(".nav-item").forEach(el => el.classList.remove("active"));
    const el = document.getElementById(`tab-${tab}`);
    if (el) el.classList.add("active-tab");
    const nav = document.querySelector(`[data-tab="${tab}"]`);
    if (nav) nav.classList.add("active");
  },

  // ── THANKS TO ─────────────────────────────────────────────
  renderThanksTo() {
    const list = document.getElementById("thanksList");
    const members = this.users.filter(u => u.role === "member").map(u => u.username);
    const devs    = this.users.filter(u => u.role === "developer").map(u => u.username);

    let html = `<div class="thanks-section">
      <div class="thanks-category">
        <h3 class="thanks-label">👑 Owner</h3>
        <div class="thanks-chips"><span class="chip chip-owner">${CONFIG.site.owner}</span></div>
      </div>
      <div class="thanks-category">
        <h3 class="thanks-label">🛠️ Developer</h3>
        <div class="thanks-chips">${devs.map(d => `<span class="chip chip-dev">${d}</span>`).join("") || '<span class="chip chip-empty">Belum ada</span>'}</div>
      </div>
      <div class="thanks-category">
        <h3 class="thanks-label">💎 Member</h3>
        <div class="thanks-chips">${members.map(m => `<span class="chip chip-member">${m}</span>`).join("") || '<span class="chip chip-empty">Belum ada</span>'}</div>
      </div>
    </div>`;
    list.innerHTML = html;
  },

  // ── TOKENS ────────────────────────────────────────────────
  renderTokens() {
    const list = document.getElementById("tokenList");
    const mine = this.currentUser.role === "developer"
      ? this.tokens
      : this.tokens.filter(t => t.owner === this.currentUser.username);

    if (!mine.length) { list.innerHTML = `<div class="empty-state">Belum ada token bot tersimpan.</div>`; return; }
    list.innerHTML = mine.map((t, i) => `
      <div class="card-item" data-idx="${i}">
        <div class="card-item-info">
          <span class="token-text">${maskToken(t.token)}</span>
          <span class="badge-small">@${t.owner}</span>
        </div>
        <div class="card-item-actions">
          <span class="date-small">${t.added}</span>
          ${this.canDeleteToken(t) ? `<button class="btn-icon btn-danger" onclick="App.deleteToken('${t.token}')">🗑️</button>` : ""}
        </div>
      </div>`).join("");
  },

  canDeleteToken(t) {
    return this.currentUser.role === "developer" || t.owner === this.currentUser.username;
  },

  async addToken(tokenVal) {
    if (!tokenVal.trim()) { showToast("Token tidak boleh kosong!", "error"); return; }
    if (this.tokens.find(t => t.token === tokenVal.trim())) { showToast("Token sudah ada!", "error"); return; }
    showLoader();
    await sleep(700);
    this.tokens.push({ token: tokenVal.trim(), owner: this.currentUser.username, added: today() });
    try { await this.persistTokens(); showToast("Token berhasil ditambahkan! ✅", "success"); }
    catch(e) { showToast("Gagal simpan: " + e.message, "error"); }
    hideLoader();
    this.renderTokens();
    document.getElementById("tokenInput").value = "";
  },

  async deleteToken(tokenVal) {
    if (!confirm("Hapus token ini?")) return;
    showLoader(); await sleep(500);
    this.tokens = this.tokens.filter(t => t.token !== tokenVal);
    try { await this.persistTokens(); showToast("Token dihapus! 🗑️", "info"); }
    catch(e) { showToast("Gagal hapus: " + e.message, "error"); }
    hideLoader(); this.renderTokens();
  },

  // ── USERS (developer only) ────────────────────────────────
  renderUsers() {
    const list = document.getElementById("userList");
    if (!list) return;
    list.innerHTML = this.users.map(u => `
      <div class="card-item">
        <div class="card-item-info">
          <span class="fw-bold">👤 ${u.username}</span>
          <span class="role-badge role-${u.role}">${u.role.toUpperCase()}</span>
        </div>
        <div class="card-item-actions">
          ${u.username !== this.currentUser.username ? `<button class="btn-icon btn-danger" onclick="App.deleteUser('${u.username}')">🗑️</button>` : `<span class="badge-small">Anda</span>`}
        </div>
      </div>`).join("");
  },

  async addUser(username, password, role) {
    if (!username || !password) { showToast("Isi semua field!", "error"); return; }
    if (this.users.find(u => u.username === username)) { showToast("Username sudah ada!", "error"); return; }
    showLoader(); await sleep(700);
    this.users.push({ username, password, role });
    try { await this.persistUsers(); showToast(`User ${username} ditambahkan! ✅`, "success"); }
    catch(e) { showToast("Gagal simpan: " + e.message, "error"); }
    hideLoader(); this.renderUsers(); this.renderThanksTo();
    document.getElementById("newUsername").value = "";
    document.getElementById("newPassword").value = "";
  },

  async deleteUser(username) {
    if (!confirm(`Hapus user ${username}?`)) return;
    showLoader(); await sleep(500);
    this.users = this.users.filter(u => u.username !== username);
    try { await this.persistUsers(); showToast(`User ${username} dihapus! 🗑️`, "info"); }
    catch(e) { showToast("Gagal hapus: " + e.message, "error"); }
    hideLoader(); this.renderUsers(); this.renderThanksTo();
  },

  // ── THEME ─────────────────────────────────────────────────
  applyTheme(t) {
    document.documentElement.setAttribute("data-theme", t);
    this.theme = t;
    localStorage.setItem("theme", t);
  },

  bindThemeToggle() {
    const toggle = document.getElementById("themeToggle");
    if (!toggle) return;
    toggle.checked = this.theme === "light";
    toggle.addEventListener("change", () => this.applyTheme(toggle.checked ? "light" : "dark"));
  }
};

// ── HELPERS ───────────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function today() { return new Date().toISOString().split("T")[0]; }
function maskToken(t) { return t.length > 20 ? t.slice(0, 10) + "••••••••••" + t.slice(-4) : t; }

function showLoader()  { document.getElementById("loader").classList.remove("hidden"); }
function hideLoader()  { document.getElementById("loader").classList.add("hidden"); }

function showToast(msg, type = "info") {
  const c = document.getElementById("toastContainer");
  const t = document.createElement("div");
  t.className = `toast toast-${type}`;
  t.innerHTML = `<span>${msg}</span>`;
  c.appendChild(t);
  requestAnimationFrame(() => t.classList.add("show"));
  setTimeout(() => { t.classList.remove("show"); setTimeout(() => t.remove(), 400); }, 3000);
}

function shake(selector) {
  const el = document.querySelector(selector);
  if (!el) return;
  el.classList.add("shake");
  setTimeout(() => el.classList.remove("shake"), 600);
}

window.addEventListener("DOMContentLoaded", () => App.init());
