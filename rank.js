// rank.js

const GAS_ENDPOINT = "https://script.google.com/macros/s/AKfycbzAInrok8W50wjSqWm37yRUJHXr87VG7gEgBkNqPgw3WRbq4RFm1i9djB_haYTYJFkc/exec";

function getAccessKey_() {
  const u = new URL(location.href);
  return u.searchParams.get("k") || "";
}

// 任意：?ym=2026-01 を付けたらその月ランキング
function getYm_() {
  const u = new URL(location.href);
  return u.searchParams.get("ym") || "";
}

function getDeviceId_() {
  const KEY = "osanpo_senryu_device_id";
  let v = localStorage.getItem(KEY);
  if (!v) {
    v = (crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()) + "_" + String(Math.random());
    localStorage.setItem(KEY, v);
  }
  return v;
}

function fmt_(iso) {
  try {
    const d = new Date(iso);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${y}/${m}/${day} ${hh}:${mm}`;
  } catch {
    return String(iso || "");
  }
}

function normalizeForPreview(s) {
  return (s || "").replace(/\s+/g, "");
}

function jsonp_(url) {
  return new Promise((resolve, reject) => {
    const cb = "__osanpo_rank_cb_" + Date.now() + "_" + Math.floor(Math.random() * 100000);
    const u = new URL(url);
    u.searchParams.set("callback", cb);

    const s = document.createElement("script");
    s.async = true;

    const timer = setTimeout(() => {
      cleanup_();
      reject(new Error("TIMEOUT"));
    }, 12000);

    function cleanup_() {
      clearTimeout(timer);
      try { delete window[cb]; } catch (_) { window[cb] = undefined; }
      if (s.parentNode) s.parentNode.removeChild(s);
    }

    window[cb] = (data) => {
      cleanup_();
      resolve(data);
    };

    s.onerror = () => {
      cleanup_();
      reject(new Error("LOAD_ERROR"));
    };

    s.src = u.toString();
    document.head.appendChild(s);
  });
}

async function sendLike_(postId) {
  const k = getAccessKey_();
  const u = new URL(GAS_ENDPOINT);
  u.searchParams.set("k", k);
  u.searchParams.set("action", "like");
  u.searchParams.set("postId", postId);
  u.searchParams.set("deviceId", getDeviceId_());
  return await jsonp_(u.toString());
}

function card_(item, rankNo) {
  const wrap = document.createElement("article");
  wrap.className = "card listCard";

  const meta = document.createElement("div");
  meta.className = "meta";
  meta.textContent = `#${rankNo}  ${fmt_(item.createdAt)}`;

  const tate = document.createElement("div");
  tate.className = "tate";

  const c1 = document.createElement("div");
  c1.className = "col";
  c1.textContent = normalizeForPreview(item.kami);

  const c2 = document.createElement("div");
  c2.className = "col";
  c2.textContent = normalizeForPreview(item.naka);

  const c3 = document.createElement("div");
  c3.className = "col";
  c3.textContent = normalizeForPreview(item.shimo);

  tate.appendChild(c1);
  tate.appendChild(c2);
  tate.appendChild(c3);

  // footer（いいね）
  const foot = document.createElement("div");
  foot.className = "foot";

  const likeBtn = document.createElement("button");
  likeBtn.type = "button";
  likeBtn.className = "likeBtn";
  likeBtn.dataset.liked = item.likedByMe ? "1" : "0";
  likeBtn.textContent = "👍";

  const likeCnt = document.createElement("span");
  likeCnt.className = "likeCnt";
  likeCnt.textContent = String(item.likeCount || 0);

  if (item.likedByMe) {
    likeBtn.disabled = true;
    likeBtn.classList.add("liked");
  }

  likeBtn.addEventListener("click", async () => {
    if (likeBtn.disabled) return;
    likeBtn.disabled = true;

    try {
      const res = await sendLike_(item.id);
      if (!res || !res.ok) {
        likeBtn.disabled = false;
        alert("いいね失敗: " + String((res && res.error) ? res.error : "UNKNOWN"));
        return;
      }
      likeCnt.textContent = String(res.likeCount ?? (Number(likeCnt.textContent) + 1));
      likeBtn.classList.add("liked");
    } catch (e) {
      likeBtn.disabled = false;
      alert("通信エラー（いいね）");
    }
  });

  foot.appendChild(likeBtn);
  foot.appendChild(likeCnt);

  wrap.appendChild(meta);
  wrap.appendChild(tate);
  wrap.appendChild(foot);
  return wrap;
}

function setTitle_() {
  const ym = getYm_();
  const el = document.getElementById("rankTitle");
  if (!el) return;
  el.textContent = ym ? `${ym} ランキング` : "今月ランキング";
}

async function load_() {
  const k = getAccessKey_();
  const list = document.getElementById("list");
  if (!list) return;

  if (!k) {
    list.innerHTML = `<p class="empty">アクセスキーがありません（QRから開いてください）</p>`;
    return;
  }

  setTitle_();

  const u = new URL(GAS_ENDPOINT);
  u.searchParams.set("k", k);
  u.searchParams.set("action", "rank");
  u.searchParams.set("limit", "10");
  u.searchParams.set("deviceId", getDeviceId_()); // likedByMe 判定用

  const ym = getYm_();
  if (ym) u.searchParams.set("ym", ym);

  list.innerHTML = `<p class="empty">読み込み中…</p>`;

  try {
    const json = await jsonp_(u.toString());

    if (!json || !json.ok) {
      list.innerHTML = `<p class="empty">取得に失敗しました：${String((json && json.error) || "UNKNOWN")}</p>`;
      return;
    }

    const items = Array.isArray(json.items) ? json.items : [];
    list.innerHTML = "";

    if (items.length === 0) {
      list.innerHTML = `<p class="empty">ランキング対象がありません。</p>`;
      return;
    }

    let n = 1;
    for (const it of items) list.appendChild(card_(it, n++));
  } catch (e) {
    list.innerHTML = `<p class="empty">通信エラー（JSONP）</p>`;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("reloadBtn");
  if (btn) btn.addEventListener("click", load_);

  const k = getAccessKey_();
  const back = document.querySelector(".backLink");
  if (back && k) back.href = `./list.html?k=${encodeURIComponent(k)}`;

  load_();
});
