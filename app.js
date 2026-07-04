/* ── خواندن ورودی ── */
const digits = s => String(s)
  .replace(/[۰-۹]/g, d => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
  .replace(/[٠-٩]/g, d => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
  .replace(/\D/g, "");

// مظنه و گرم: تا ۵ رقم ×۱۰۰۰ — دلار: تا ۳ رقم ×۱۰۰۰ — فرم کامل بدون تغییر
function normalize(raw, kind){
  const d = digits(raw);
  if(!d) return NaN;
  let n = Number(d);
  if((kind === "mesghal" || kind === "geram") && d.length <= 5) n *= 1000;
  if(kind === "usd" && d.length <= 3) n *= 1000;
  return n;
}

const fa = n => Math.round(n).toLocaleString("fa-IR");

/* ── فرمول ── */
const MESGHAL_DIVISOR = 9.5742;   // انس×دلار ÷ این عدد = ذاتی مثقال
const GRAM_PER_MESGHAL = 4.3318;  // هر مثقال = ۴٫۳۳۱۸ گرم ۱۸ عیار

function bubble({ market, ons, usd, mode }){
  let zati = ons * usd / MESGHAL_DIVISOR;
  if(mode === "geram") zati /= GRAM_PER_MESGHAL;
  const hobab = market - zati;
  return { zati, hobab, pct: hobab / zati * 100 };
}

/* ── دریافت انس جهانی از gold-api.com — رایگان، بدون کلید، بدون سقف درخواست، با CORS ── */
async function fetchOns(){
  const res = await fetch("https://api.gold-api.com/price/XAU");
  if(!res.ok) throw new Error("خطای " + res.status);
  const data = await res.json();
  return data.price; // دلار به ازای هر انس
}

/* ── DOM ── */
const $ = id => document.getElementById(id);
const root = document.documentElement;

/* ── پوسته ── */
const saved = localStorage.getItem("hobyab-theme");
root.dataset.theme = saved || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
syncThemeIcon();
$("themeBtn").addEventListener("click", () => {
  root.dataset.theme = root.dataset.theme === "dark" ? "light" : "dark";
  localStorage.setItem("hobyab-theme", root.dataset.theme);
  syncThemeIcon();
});
function syncThemeIcon(){
  $("themeIcon").textContent = root.dataset.theme === "dark" ? "light_mode" : "dark_mode";
}

/* ── سوییچ مظنه / گرم ── */
let mode = "mesghal";
const LABELS = { mesghal: "مظنه بازار تهران (تومان)", geram: "قیمت گرم ۱۸ عیار (تومان)" };
document.querySelectorAll(".seg").forEach(btn => {
  btn.addEventListener("click", () => {
    mode = btn.dataset.mode;
    document.querySelectorAll(".seg").forEach(b => b.classList.toggle("active", b === btn));
    const f = $("gold");
    f.label = LABELS[mode];
    f.value = ""; f.supportingText = " ";
    $("out").style.display = "none";
  });
});

/* ── نمایش زندهٔ مقدار خوانده‌شده ── */
[["gold", () => mode], ["usd", () => "usd"]].forEach(([id, kind]) => {
  $(id).addEventListener("input", e => {
    const n = normalize(e.target.value, kind());
    e.target.supportingText = n ? "خوانده شد: " + fa(n) + " تومان" : " ";
  });
});

/* ── محاسبه ── */
function calc(){
  const market = normalize($("gold").value, mode);
  const ons = Number(digits($("ons").value));   // انس: بدون انعطاف
  const usd = normalize($("usd").value, "usd");
  if(!market || !ons || !usd) return;

  const r = bubble({ market, ons, usd, mode });
  $("out").style.display = "block";
  $("zatiLabel").textContent = mode === "mesghal" ? "قیمت ذاتی مثقال" : "قیمت ذاتی گرم ۱۸ عیار";
  $("zati").textContent = fa(r.zati) + " تومان";

  const el = $("hobab");
  el.className = "hobab " + (r.hobab >= 0 ? "pos" : "neg");
  el.innerHTML = "<md-icon>" + (r.hobab >= 0 ? "trending_up" : "trending_down") + "</md-icon>" +
                 " حباب: " + fa(r.hobab) + " تومان (" +
                 r.pct.toLocaleString("fa-IR", { maximumFractionDigits: 1 }) + "٪)";
}
$("calcBtn").addEventListener("click", calc);

/* ── دکمهٔ دریافت انس ── */
$("sync").addEventListener("click", async () => {
  const icon = $("sync").querySelector("md-icon");
  icon.textContent = "hourglass_top";
  try{
    const p = await fetchOns();
    $("ons").value = Math.round(p);
    $("ons").supportingText = "دریافت شد: " + fa(p) + " دلار";
    icon.textContent = "sync";
    calc(); // اگر دو فیلد دیگر پر باشند، حباب هم همان لحظه به‌روز می‌شود
  }catch(err){
    icon.textContent = "sync_problem";
    $("ons").supportingText = "دریافت انس ناموفق: " + err.message;
  }
});
