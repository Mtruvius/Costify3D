/* ---------- EDIT THESE ---------- */
const CONFIG = {
  repo: "https://github.com/mtruvius/costify3d",
  paddle: {
    env: "sandbox",                    // change to "production" when you go live
    token: "test_REPLACE_WITH_CLIENT_SIDE_TOKEN",
    priceIds: {                        // one Paddle price per product
      printer: "pri_REPLACE_ONE_TIME",
      m3:  "pri_REPLACE_3_MONTH",      // recurring, billed every 3 months
      m6:  "pri_REPLACE_6_MONTH",      // recurring, billed every 6 months
      m12: "pri_REPLACE_12_MONTH"      // recurring, billed every 12 months
    }
  },
  // status: "ready" links to the release asset, "soon" shows a notice
  platforms: [
    { id: "android", name: "Android",  note: "Google Play or APK", href: "https://github.com/mtruvius/costify3d/releases/latest", status: "soon" },
    { id: "ios",     name: "iOS",      note: "App Store",          href: "#", status: "soon" },
    { id: "mac",     name: "macOS",    note: "Apple silicon and Intel (.dmg)", href: "https://github.com/mtruvius/costify3d/releases/latest", status: "ready" },
    { id: "windows", name: "Windows",  note: "Installer (.msi)",   href: "https://github.com/mtruvius/costify3d/releases/latest", status: "ready" },
    { id: "linux",   name: "Linux",    note: ".AppImage and .deb", href: "https://github.com/mtruvius/costify3d/releases/latest", status: "ready" }
  ]
};
/* -------------------------------- */
const $ = id => document.getElementById(id);
$("yr").textContent = new Date().getFullYear();
$("repo").href = CONFIG.repo;

/* Live calculator (rates tuned to match the app's example print) */
const KW = 0.27, TIME_RATE = 0.556, KWH = 4.5, CUR = "R";
const fmt = n => CUR + " " + n.toFixed(2);
function calc(){
  const g = +$("w").value, m = +$("t").value, k = +$("k").value;
  const fil = g / 1000 * k, ele = m / 60 * KW * KWH, tim = m / 60 * TIME_RATE, tot = fil + ele + tim;
  $("wo").textContent = g + " g";
  $("to").textContent = Math.floor(m / 60) + "h " + String(m % 60).padStart(2, "0") + "m";
  $("ko").textContent = CUR + " " + k;
  $("tot").textContent = fmt(tot);
  [fil, ele, tim].forEach((v, i) => { $("r" + (i + 1)).textContent = fmt(v); $("b" + (i + 1)).style.width = (v / tot * 100) + "%"; });
  $("tip").textContent = "Tip: dropping infill from 20% to 10% could save you about " + fmt(fil * .15) + " on this print.";
}
["w","t","k"].forEach(id => $(id).addEventListener("input", calc));
requestAnimationFrame(() => setTimeout(calc, 500));   // bar "extrudes" in after the headline lands

/* Spool rings animate once when scrolled into view */
new IntersectionObserver((es, o) => es.forEach(e => { if (e.isIntersecting){ e.target.classList.add("in"); o.unobserve(e.target); } }), {threshold:.35}).observe($("spoolGrid"));

/* Platforms + OS detection */
const ua = (navigator.userAgentData && navigator.userAgentData.platform || navigator.userAgent).toLowerCase();
const mine = /android/.test(ua) ? "android" : /iphone|ipad|ios/.test(ua) ? "ios" : /mac/.test(ua) ? "mac" : /win/.test(ua) ? "windows" : /linux|x11/.test(ua) ? "linux" : null;
$("plats").innerHTML = CONFIG.platforms.map(p =>
  `<a href="${p.href}" data-s="${p.status}" class="${p.id === mine ? "me" : ""}"><b>${p.name}</b><small>${p.status === "soon" ? "Coming soon" : p.note}</small>${p.id === mine ? "<small style='color:var(--green)'>Your device</small>" : ""}</a>`).join("");
document.querySelectorAll("#plats a[data-s=soon]").forEach(a => a.addEventListener("click", e => { e.preventDefault(); alert("This version is not released yet. Check back soon."); }));
const me = CONFIG.platforms.find(p => p.id === mine);
if (me) $("dlMain").textContent = "Download for " + me.name;

/* Paddle Billing (Paddle.js v2) */
const P = CONFIG.paddle, configured = !P.token.includes("REPLACE") && !Object.values(P.priceIds).some(v => v.includes("REPLACE"));
const FALL = { 3: 27, 6: 48, 12: 72 };          // fallback totals in USD until Paddle returns real prices
const live = {};                                  // priceKey -> { total, cur }
let months = 12;
const money = (v, cur) => new Intl.NumberFormat(undefined, { style: "currency", currency: cur }).format(v);
function renderMfr(){
  const d = live["m" + months], total = d ? d.total : FALL[months], cur = d ? d.cur : "USD";
  $("mfrPrice").textContent = money(total / months, cur);
  $("mfrBill").textContent = "Billed " + money(total, cur) + " every " + months + " months";
}
document.querySelectorAll("#seg button").forEach(b => b.addEventListener("click", () => {
  months = +b.dataset.m;
  document.querySelectorAll("#seg button").forEach(x => x.classList.toggle("on", x === b));
  renderMfr();
}));
renderMfr();

if (window.Paddle && configured){
  if (P.env === "sandbox") Paddle.Environment.set("sandbox");
  Paddle.Initialize({
    token: P.token,
    eventCallback: ev => { if (ev.name === "checkout.completed"){ $("thanks").style.display = "block"; $("thanks").scrollIntoView({behavior:"smooth", block:"center"}); } }
  });
  const keys = Object.keys(P.priceIds);
  Paddle.PricePreview({ items: keys.map(k => ({ priceId: P.priceIds[k], quantity: 1 })) })
    .then(r => {
      r.data.details.lineItems.forEach((li, i) => { live[keys[i]] = { total: +li.totals.total / 100, cur: r.data.currencyCode }; });
      const p = live.printer; if (p) $("printerPrice").textContent = money(p.total, p.cur);
      renderMfr();
    })
    .catch(() => {});
}
document.querySelectorAll("[data-buy]").forEach(b => b.addEventListener("click", () => {
  if (!window.Paddle || !configured){ alert("Add your Paddle client-side token and price IDs in CONFIG at the bottom of index.html."); return; }
  const key = b.dataset.buy === "mfr" ? "m" + months : "printer";
  Paddle.Checkout.open({ items: [{ priceId: P.priceIds[key], quantity: 1 }], settings: { theme: "dark", displayMode: "overlay" } });
}));
