import "./styles.css";
import { initializePaddle } from "@paddle/paddle-js";
const images = import.meta.glob('./assets/*.png', { eager: true, query: 'url' });
/* ---------- EDIT THESE ---------- */
const CONFIG = {
  repo: "https://github.com/mtruvius/costify3d",
  paddle: {
    env: "sandbox", // change to "production" when you go live
    token: import.meta.env.PADDLE_API_KEY,
    priceIds: {
      // one Paddle price per product
      printer: import.meta.env.PRI_ID_ONE_TIME,
      m3: import.meta.env.PRI_ID_3_MONTH, // recurring, billed every 3 months
      m6: import.meta.env.PRI_ID_6_MONTH, // recurring, billed every 6 months
      m12: import.meta.env.PRI_ID_12_MONTH, // recurring, billed every 12 months
    },
  },
  // status: "ready" links to the release asset, "soon" shows a notice
  platforms: [
    {
      id: "android",
      icon: images['./assets/os-and.png'],
      note: "Google Play or APK",
      href: "https://github.com/mtruvius/costify3d/releases/latest",
      status: "soon",
    },
    { 
      id: "ios", 
      icon: images['./assets/os-ios.png'],
      note: "App Store", 
      href: "https://github.com/mtruvius/costify3d/releases/latest", 
      status: "soon" 
    },
    {
      id: "mac",
      icon: images['./assets/os-mac.png'],
      note: "Apple silicon and Intel (.dmg)",
      href: "https://github.com/mtruvius/costify3d/releases/latest",
      status: "ready",
    },
    {
      id: "windows",
      icon: images['./assets/os-win.png'],
      note: "Installer (.msi)",
      href: "https://github.com/mtruvius/costify3d/releases/latest",
      status: "ready",
    },
    {
      id: "linux",
      icon: images['./assets/os-lin.png'],
      note: ".AppImage and .deb",
      href: "https://github.com/mtruvius/costify3d/releases/latest",
      status: "ready",
    },
  ],
};
/* -------------------------------- */
const $ = (id) => document.getElementById(id);
$("yr").textContent = new Date().getFullYear();
$("repo").href = CONFIG.repo;

/* Live calculator (rates tuned to match the app's example print) */
const KW = 0.27,
  TIME_RATE = 0.556,
  KWH = 4.5,
  CUR = "R";
const fmt = (n) => CUR + " " + n.toFixed(2);
function calc() {
  const g = +$("w").value,
    m = +$("t").value,
    k = +$("k").value;
  const fil = (g / 1000) * k,
    ele = (m / 60) * KW * KWH,
    tim = (m / 60) * TIME_RATE,
    tot = fil + ele + tim;
  $("wo").textContent = g + " g";
  $("to").textContent =
    Math.floor(m / 60) + "h " + String(m % 60).padStart(2, "0") + "m";
  $("ko").textContent = CUR + " " + k;
  $("tot").textContent = fmt(tot);
  [fil, ele, tim].forEach((v, i) => {
    $("r" + (i + 1)).textContent = fmt(v);
    $("b" + (i + 1)).style.width = (v / tot) * 100 + "%";
  });
  $("tip").textContent =
    "Tip: dropping infill from 20% to 10% could save you about " +
    fmt(fil * 0.15) +
    " on this print.";
}
["w", "t", "k"].forEach((id) => $(id).addEventListener("input", calc));
requestAnimationFrame(() => setTimeout(calc, 500)); // bar "extrudes" in after the headline lands

/* Spool rings animate once when scrolled into view */
new IntersectionObserver(
  (es, o) =>
    es.forEach((e) => {
      if (e.isIntersecting) {
        e.target.classList.add("in");
        o.unobserve(e.target);
      }
    }),
  { threshold: 0.35 },
).observe($("spoolGrid"));

/* Platforms + OS detection */
const ua = (
  (navigator.userAgentData && navigator.userAgentData.platform) ||
  navigator.userAgent
).toLowerCase();
const mine = /android/.test(ua)
  ? "android"
  : /iphone|ipad|ios/.test(ua)
    ? "ios"
    : /mac/.test(ua)
      ? "mac"
      : /win/.test(ua)
        ? "windows"
        : /linux|x11/.test(ua)
          ? "linux"
          : null;
$("plats").innerHTML = CONFIG.platforms
  .map(
    (p) =>
      `<a href="${p.href}" data-s="${p.status}" class="${p.id === mine ? "me" : ""}"><img src="${p.icon}" alt="${p.name} icon"><small>${p.status === "soon" ? "Coming soon" : p.note}</small>${p.id === mine ? "<small style='color:var(--green)'>Your device</small>" : ""}</a>`,
  )
  .join("");
document.querySelectorAll("#plats a[data-s=soon]").forEach((a) =>
  a.addEventListener("click", (e) => {
    e.preventDefault();
    alert("This version is not released yet. Check back soon.");
  }),
);
const me = CONFIG.platforms.find((p) => p.id === mine);
if (me) $("dlMain").textContent = "Download for " + me.name;

/* Paddle Billing (Paddle.js v2) */
const P = CONFIG.paddle,
  configured =
    !P.token.includes("REPLACE") &&
    !Object.values(P.priceIds).some((v) => v.includes("REPLACE"));
const FALL = { 3: 27, 6: 48, 12: 72 }; // fallback totals in USD until Paddle returns real prices
const live = {}; // priceKey -> { total, cur }
let months = 12;
const money = (v, cur) =>
  new Intl.NumberFormat(undefined, { style: "currency", currency: cur }).format(
    v,
  );
function renderMfr() {
  const d = live["m" + months],
    total = d ? d.total : FALL[months],
    cur = d ? d.cur : "USD";
  $("mfrPrice").textContent = money(total / months, cur);
  $("mfrBill").textContent =
    "Billed " + money(total, cur) + " every " + months + " months";
}
document.querySelectorAll("#seg button").forEach((b) =>
  b.addEventListener("click", () => {
    months = +b.dataset.m;
    document
      .querySelectorAll("#seg button")
      .forEach((x) => x.classList.toggle("on", x === b));
    renderMfr();
  }),
);
renderMfr();

let paddle = null;

async function initPaddle() {
  if (!configured) return;
  paddle = await initializePaddle({
    environment: P.env,              // "sandbox" or "production"
    token: P.token,
    eventCallback: (ev) => {
      if (ev.name === "checkout.completed") {
        $("thanks").style.display = "block";
        $("thanks").scrollIntoView({ behavior: "smooth", block: "center" });
      }
    },
  });
  if (!paddle) return;

  const keys = Object.keys(P.priceIds);
  const preview = (address) =>
    paddle.PricePreview({
      items: keys.map((k) => ({ priceId: P.priceIds[k], quantity: 1 })),
      ...(address && { address }),
    });

  try {
    const r = await (COUNTRY
      ? preview({ countryCode: COUNTRY }).catch(() => preview())
      : preview());
    const cur = r.data.currencyCode;
    r.data.details.lineItems.forEach((li, i) => {
      live[keys[i]] = { total: minorToMajor(+li.totals.total, cur), cur };
    });
    if (live.printer) $("printerPrice").textContent = money(live.printer.total, live.printer.cur);
    renderMfr();
  } catch (e) {
    console.error(e);
  }
}
initPaddle();


document.querySelectorAll("[data-buy]").forEach((b) =>
  b.addEventListener("click", () => {
    if (!paddle || !configured) { 
      alert(
        "Add your Paddle client-side token and price IDs in CONFIG at the bottom of index.html.",
      );
      return;
    }
    const key = b.dataset.buy === "mfr" ? "m" + months : "printer";
    paddle.Checkout.open({
      items: [{ priceId: P.priceIds[key], quantity: 1 }],
      settings: { theme: "dark", displayMode: "overlay" },
    });
  }),
);
