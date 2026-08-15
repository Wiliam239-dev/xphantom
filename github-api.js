const GithubAPI = (() => {
  const BASE = "https://api.github.com";

  // Ambil Personal Access Token dari sessionStorage (di-set saat login developer)
  function getToken() {
    return sessionStorage.getItem("gh_pat") || "";
  }

  function headers() {
    const t = getToken();
    const h = { "Content-Type": "application/json", "Accept": "application/vnd.github+json" };
    if (t) h["Authorization"] = `token ${t}`;
    return h;
  }

  async function getFile(path) {
    const { owner, repo, branch } = CONFIG.github;
    const url = `${BASE}/repos/${owner}/${repo}/contents/${path}?ref=${branch}`;
    const res = await fetch(url, { headers: headers() });
    if (!res.ok) throw new Error(`GitHub: ${res.status} ${res.statusText}`);
    const data = await res.json();
    const content = atob(data.content.replace(/\n/g, ""));
    return { json: JSON.parse(content), sha: data.sha };
  }

  async function putFile(path, content, sha, message) {
    const { owner, repo, branch } = CONFIG.github;
    const url = `${BASE}/repos/${owner}/${repo}/contents/${path}`;
    const body = {
      message: message || `Update ${path}`,
      content: btoa(unescape(encodeURIComponent(JSON.stringify(content, null, 2)))),
      branch,
      sha
    };
    const res = await fetch(url, { method: "PUT", headers: headers(), body: JSON.stringify(body) });
    if (!res.ok) throw new Error(`GitHub: ${res.status} ${res.statusText}`);
    return res.json();
  }

  // ── Public API ──────────────────────────────────────────────

  async function fetchUsers() {
    const { json } = await getFile(CONFIG.github.paths.login);
    return json.users || [];
  }

  async function saveUsers(users) {
    const { json, sha } = await getFile(CONFIG.github.paths.login);
    json.users = users;
    return putFile(CONFIG.github.paths.login, json, sha, "Update users");
  }

  async function fetchTokens() {
    const { json } = await getFile(CONFIG.github.paths.tokens);
    return json.tokens || [];
  }

  async function saveTokens(tokens) {
    const { json, sha } = await getFile(CONFIG.github.paths.tokens);
    json.tokens = tokens;
    return putFile(CONFIG.github.paths.tokens, json, sha, "Update tokens");
  }

  return { fetchUsers, saveUsers, fetchTokens, saveTokens };
})();
