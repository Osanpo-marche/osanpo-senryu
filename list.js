// list.js（action=rank / action=hall 対応版）

const GAS_ENDPOINT =
  "https://script.google.com/macros/s/AKfycbzAInrok8W50wjSqWm37yRUJHXr87VG7gEgBkNqPgw3WRbq4RFm1i9djB_haYTYJFkc/exec";

function getAccessKey_() {
  const u = new URL(location.href);
  return u.searchParams.get("k") || "";
}

function getAction_() {
  const u = new URL(location.href);
  const a = (u.searchParams.get("action") || "").trim();
  return a === "rank" || a === "hall" ? a : "list";
}

function getDeviceId_() {
  const KEY = "osanpo_senryu_device_id";
  let v = localStorage.getItem(KEY);
  if (!v) {
    v =
      crypto && crypto.randomUUID
        ? crypto.randomUUID()
        : String(Date.now()) + "_" + String(Math.random());
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
    const cb =
      "__osanpo_list_cb_" +
      Date.now() +
      "_" +
      Math.floor(Math.random() * 100000);
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
      try {
        delete window[cb];
      } catch (_) {
        window[cb] = undefined;
      }
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

function setActiveTabs_() {
  const a = getAction_();
  const all = document.querySelector(".tabAll");
  const rank = document.querySelector(".tabRank");
  const hall = document.querySelector(".tabHall");

  [all, rank, hall].forEach((el) => el && el.classList.remove("active"));

  if (a === "rank") rank && rank.classList.add("active");
  else if (a === "hall") hall && hall.classList.add("active");
  else all && all.classList.add("active");
}

function setTabLinks_() {
  const k = getAccessKey_();
  const all = document.querySelector(".tabAll");
  const rank = document.querySelector(".tabRank");
  const hall = document.querySelector(".tabHall");

  if (all) all.href = `./list.html?k=${encodeURIComponent(k)}`;
  if (rank) rank.href = `./list.html?k=${encodeURIComponent(k)}&action=rank`;
  if (hall) hall.href = `./list.html?k=${encodeURIComponent(k)}&action=hall`;
}

function card_(item) {
  const wrap = document.createElement("article");
  wrap.className = "card listCard";

  const meta = document.createElement("div");
  meta.className = "meta";

  // ランク表示（rank / hall）
  const prefix = item.rank ? `#${item.rank} ` : "";
  meta.textContent = prefix + fmt_(item.createdAt);

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

  // ニックネームがある場合、署名用の行を追加
  if (item.name) {
    const cName = document.createElement("div");
    cName.className = "col name-col";
    cName.textContent = item.name;
    tate.appendChild(cName);
  }

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
        alert(
          "いいね失敗: " + String(res && res.error ? res.error : "UNKNOWN"),
        );
        return;
      }
      likeCnt.textContent = String(
        res.likeCount ?? Number(likeCnt.textContent) + 1,
      );
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

async function load_() {
  const k = getAccessKey_();
  const list = document.getElementById("list");
  if (!list) return;

  setTabLinks_();
  setActiveTabs_();

  if (!k) {
    list.innerHTML = `<p class="empty">アクセスキーがありません（QRから開いてください）</p>`;
    return;
  }

  const action = getAction_();
  const u = new URL(GAS_ENDPOINT);
  u.searchParams.set("k", k);

  // ★ 今月ランキングは 1〜3 位固定
  const limit = action === "rank" ? 3 : 30;
  u.searchParams.set("limit", String(limit));

  u.searchParams.set("deviceId", getDeviceId_()); // like判定用

  // action切替（listは付けなくても動くけど、明示してOK）
  if (action === "rank") u.searchParams.set("action", "rank");
  else if (action === "hall") u.searchParams.set("action", "hall");
  else u.searchParams.set("action", "list");

  // ★ ガイドメッセージの文言切替
  const guide = document.querySelector(".list-guide");
  if (guide) {
    guide.style.display = "block";
    if (action === "rank") {
      guide.textContent = "今月「いいね」を多く集めたトップ3です";
    } else if (action === "hall") {
      guide.textContent = "過去に「いいね」を多く集めた殿堂入り作品です";
    } else {
      guide.textContent = "👍を押してお気に入り川柳を応援しよう";
    }
  }

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
      const msg =
        action === "rank"
          ? "今月のランキングはまだありません。"
          : action === "hall"
            ? "殿堂はまだありません。"
            : "まだ投稿がありません。";
      list.innerHTML = `<p class="empty">${msg}</p>`;
      return;
    }

    for (const it of items) list.appendChild(card_(it));
  } catch (e) {
    list.innerHTML = `<p class="empty">通信エラー（JSONP）</p>`;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const btn = document.querySelector(".reloadBtn");
  if (btn) btn.addEventListener("click", load_);

  const k = getAccessKey_();
  const back = document.querySelector(".backLink");
  if (back && k) back.href = `./index.html?k=${encodeURIComponent(k)}`;

  setTabLinks_();
  setActiveTabs_();
  load_();
});
