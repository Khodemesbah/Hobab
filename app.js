/* ── خواندن ورودی ── */
const digits = s => String(s)
  .replace(/[۰-۹]/g, d => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
  .replace(/[٠-٩]/g, d => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
  .replace(/\D/g, "");

// مظنه و گرم: تا ۵ رقم ×۱۰۰۰ — دلار: تا ۳ رقم  ×۱۰۰۰ — فرم کامل بدون تغییر
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

/* ── لایهٔ اتصال API — بعداً با fetch واقعی جایگزین شود
   قرارداد خروجی: { mesghal, geram, ons, usd } با مقادیر کامل (بدون عبور از normalize) */
async function fetchRates(){
  throw new Error("API هنوز متصل نیست");
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

/* ── API ── */
$("sync").addEventListener("click", async () => {
  try{
    const r = await fetchRates();
    $("gold").value = mode === "mesghal" ? r.mesghal : r.geram;
    $("ons").value = r.ons;
    $("usd").value = r.usd;
    calc();
  }catch(err){
    $("sync").title = err.message;
  }
});
