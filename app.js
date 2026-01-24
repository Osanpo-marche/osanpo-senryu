// app.js

const $ = (id) => document.getElementById(id);
const normalizeForPreview = (s) => (s || "").replace(/\s+/g, "");

function paintHint(cntId, target) {
  const el = $(cntId);
  const n = Number(el.textContent || 0);
  el.dataset.state = n === target ? "ok" : n < target ? "short" : "long";
}

function sync() {
  const in1 = $("in1"), in2 = $("in2"), in3 = $("in3");
  const pv1 = $("pv1"), pv2 = $("pv2"), pv3 = $("pv3");
  const cnt1 = $("cnt1"), cnt2 = $("cnt2"), cnt3 = $("cnt3");

  if (!in1 || !in2 || !in3 || !pv1 || !pv2 || !pv3 || !cnt1 || !cnt2 || !cnt3) return;

  const v1 = in1.value;
  const v2 = in2.value;
  const v3 = in3.value;

  pv1.textContent = normalizeForPreview(v1);
  pv2.textContent = normalizeForPreview(v2);
  pv3.textContent = normalizeForPreview(v3);

  cnt1.textContent = Array.from(v1).length;
  cnt2.textContent = Array.from(v2).length;
  cnt3.textContent = Array.from(v3).length;

  paintHint("cnt1", 5);
  paintHint("cnt2", 7);
  paintHint("cnt3", 5);
}

["in1", "in2", "in3"].forEach((id) => {
  const el = $(id);
  if (el) el.addEventListener("input", sync);
});

sync();

/* =========================
   JSONP 投稿（GET action=post）
   ========================= */

const GAS_ENDPOINT = "https://script.google.com/macros/s/AKfycbzAInrok8W50wjSqWm37yRUJHXr87VG7gEgBkNqPgw3WRbq4RFm1i9djB_haYTYJFkc/exec";

function getAccessKey_() {
  const u = new URL(location.href);
  return u.searchParams.get("k") || "";
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

/** 匿名/ニックネーム切替で input を ON/OFF */
function syncNameMode_() {
  const modeNick = $("modeNick");
  const nick = $("nick");
  if (!nick) return;

  const isNick = !!(modeNick && modeNick.checked);
  nick.disabled = !isNick;

  // 匿名に戻したら入力を消す（残したいならこの2行を削除OK）
  if (!isNick) nick.value = "";
}

function payload_() {
  const kami = String(($("in1")?.value || "")).trim();
  const naka = String(($("in2")?.value || "")).trim();
  const shimo = String(($("in3")?.value || "")).trim();

  const modeAnon = $("modeAnon")?.checked;
  const nick = String(($("nick")?.value || "")).trim();

  // 匿名なら固定。ニックネームなら入力値
  const name = modeAnon ? "匿名" : nick;

  return { kami, naka, shimo, name };
}

function jsonp_(url) {
  return new Promise((resolve, reject) => {
    const cb = "__osanpo_cb_" + Date.now() + "_" + Math.floor(Math.random() * 100000);
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

let __posting = false;

async function submitSenryu_() {
  if (__posting) return;               // ★二重投稿防止
  __posting = true;

  const btn = document.querySelector(".postBtn");
  if (btn) btn.disabled = true;

  try {
    const k = getAccessKey_();
    if (!k) { alert("アクセスキーがありません（QRから開いてください）"); return; }

    const p = payload_();

    // 空投稿NG
    if (!p.kami && !p.naka && !p.shimo) {
      alert("空のままは投稿できません");
      return;
    }

    // ★ニックネーム選択なのに空はNG（匿名にしたいならラジオで匿名を選ぶ）
    const modeNick = $("modeNick")?.checked;
    if (modeNick && !p.name) {
      alert("ニックネームを入力するか、「匿名」を選んでください");
      return;
    }

    const u = new URL(GAS_ENDPOINT);
    u.searchParams.set("k", k);
    u.searchParams.set("action", "post");
    u.searchParams.set("kami", p.kami);
    u.searchParams.set("naka", p.naka);
    u.searchParams.set("shimo", p.shimo);
    u.searchParams.set("name", p.name);                 // ★追加
    u.searchParams.set("deviceId", getDeviceId_());
    u.searchParams.set("ua", String(navigator.userAgent || "").slice(0, 120));

    const res = await jsonp_(u.toString());
    if (!res || !res.ok) {
      alert("投稿に失敗: " + String((res && res.error) ? res.error : "UNKNOWN"));
      return;
    }

    location.href = `./list.html?k=${encodeURIComponent(k)}`;
  } catch (e) {
    alert("通信エラー（JSONP）: " + String(e && e.message ? e.message : e));
  } finally {
    __posting = false;
    if (btn) btn.disabled = false;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  // ボタン
  const btn = document.querySelector(".postBtn");
  if (btn) btn.addEventListener("click", submitSenryu_);

  // ★匿名/ニックネーム切替
  const modeAnon = $("modeAnon");
  const modeNick = $("modeNick");
  if (modeAnon) modeAnon.addEventListener("change", syncNameMode_);
  if (modeNick) modeNick.addEventListener("change", syncNameMode_);
  syncNameMode_(); // 初期状態反映
});
