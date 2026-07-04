/* ── خواندن ورودی ── */
const digits = s => String(s)
  .replace(/[۰-۹]/g, d => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
  .replace(/[٠-٩]/g, d => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
  .replace(/\D/g, "");

// برای انس: اعشار را حفظ می‌کند (۴۱۸۱.۳ نباید ۴۱۸۱۳ خوانده شود)
const decimals = s => parseFloat(String(s)
  .replace(/[۰-۹]/g, d => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
  .replace(/[٠-٩]/g, d => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
  .replace(/[^\d.]/g, ""));

// مظنه و گرم: تا ۵ رقم ×۱۰۰۰ — دلار: تا ۳ رقم ×۱۰۰۰ — فرم کامل بدون تغییر
function normalize(raw, kind){
  const d = digits(raw);
  if(!d) return NaN;
  let n = Number(d);
  if((kind === "mesghal" || kind === "geram") && d.length <= 5) n *= 1000;
  if(kind === "usd" && d.length <= 3) n *= 1000;
  if(kind === "coin" && d.length <= 6) n *= 1000; // ۹۶٬۵۰۰ ← ۹۶٬۵۰۰٬۰۰۰
  return n;
}

const fa = n => Math.round(n).toLocaleString("fa-IR");
const fa10k = n => (Math.round(n / 10000) * 10000).toLocaleString("fa-IR"); // نتایج تومانی: گرد به ده‌هزار تومان
const fa1d = n => (Math.round(n * 10) / 10).toLocaleString("fa-IR", { maximumFractionDigits: 1 }); // اعداد دلاری: حداکثر یک رقم اعشار

/* ── فرمول ── */
const MESGHAL_DIVISOR = 9.5742;   // انس×دلار ÷ این عدد = ذاتی مثقال
const GRAM_PER_MESGHAL = 4.3318;  // هر مثقال = ۴٫۳۳۱۸ گرم ۱۸ عیار

function bubble({ market, ons, usd, mode }){
  let zati = ons * usd / MESGHAL_DIVISOR;
  if(mode === "geram") zati /= GRAM_PER_MESGHAL;
  const hobab = market - zati;
  return { zati, hobab, pct: hobab / zati * 100 };
}

/* ── دریافت قیمت از gold-api.com — رایگان، بدون کلید، بدون سقف، با CORS ── */
async function fetchPrice(symbol){ // "XAU" طلا ، "XAG" نقره
  const res = await fetch("https://api.gold-api.com/price/" + symbol,
    { signal: AbortSignal.timeout(10000) }); // حداکثر ۱۰ ثانیه انتظار، بعد خطا
  if(!res.ok) throw new Error("خطای " + res.status);
  const data = await res.json();
  return { price: data.price, at: data.updatedAt }; // دلار به ازای هر انس + زمان به‌روزرسانی
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
document.querySelectorAll("#goldSeg .seg").forEach(btn => {
  btn.addEventListener("click", () => {
    mode = btn.dataset.mode;
    document.querySelectorAll("#goldSeg .seg").forEach(b => b.classList.toggle("active", b === btn));
    const f = $("gold");
    f.label = LABELS[mode];
    f.value = ""; f.supportingText = " "; f.error = false;
    $("out").style.display = "none";
  });
});

/* ── نمایش زندهٔ مقدار خوانده‌شده + محاسبهٔ زنده ── */
[["gold", () => mode, () => calc()],
 ["usd", () => "usd", () => calc()],
 ["coinPrice", () => "coin", () => coinCalc()],
 ["coinUsd", () => "usd", () => coinCalc()]].forEach(([id, kind, recalc]) => {
  $(id).addEventListener("input", e => {
    const n = normalize(e.target.value, kind());
    e.target.supportingText = n ? "خوانده شد: " + fa(n) + " تومان" : " ";
    e.target.error = false;
    recalc();
  });
});
$("ons").addEventListener("input", e => { e.target.error = false; calc(); });
$("coinOns").addEventListener("input", e => { e.target.error = false; coinCalc(); });

/* فیلد خالی هنگام ترک: خطای قابل‌دیدن */
["gold", "ons", "usd", "coinPrice", "coinOns", "coinUsd"].forEach(id => {
  $(id).addEventListener("blur", e => {
    const empty = !String(e.target.value).trim();
    e.target.error = empty;
    e.target.errorText = empty ? "این مقدار لازم است" : "";
  });
});

/* ── محاسبهٔ زنده (بدون دکمه) ── */
let last = null; // آخرین نتیجه برای اشتراک
function calc(){
  const market = normalize($("gold").value, mode);
  const ons = decimals($("ons").value);   // انس: بدون انعطاف، با حفظ اعشار
  const usd = normalize($("usd").value, "usd");
  if(!market || !ons || !usd){ $("out").style.display = "none"; return; }

  const r = bubble({ market, ons, usd, mode });
  last = { mode, r };
  $("out").style.display = "block";
  $("zatiLabel").textContent = mode === "mesghal" ? "قیمت ذاتی مثقال" : "قیمت ذاتی گرم ۱۸ عیار";
  $("zati").textContent = fa10k(r.zati) + " تومان";

  const el = $("hobab");
  el.className = "hobab " + (r.hobab >= 0 ? "pos" : "neg");
  el.innerHTML = "<md-icon>" + (r.hobab >= 0 ? "trending_up" : "trending_down") + "</md-icon>" +
                 " حباب: " + fa10k(r.hobab) + " تومان (" +
                 r.pct.toLocaleString("fa-IR", { maximumFractionDigits: 1 }) + "٪)";
}
/* ── اشتراک نتیجه ── */
$("share").addEventListener("click", () => {
  if(!last) return;
  const label = last.mode === "mesghal" ? "مثقال" : "گرم ۱۸ عیار";
  const text = "حباب " + label + ": " + fa10k(last.r.hobab) + " تومان (" +
    last.r.pct.toLocaleString("fa-IR", { maximumFractionDigits: 1 }) + "٪)";
  if(navigator.share) navigator.share({ text: text, url: location.href }).catch(() => {});
  else navigator.clipboard.writeText(text + " — " + location.href);
});

/* ── دکمه‌های دریافت قیمت داخل فیلدها ── */
function wireFetch(btnId, fieldId, symbol, after){
  $(btnId).addEventListener("click", async () => {
    const icon = $(btnId).querySelector("md-icon");
    icon.textContent = "hourglass_top";
    try{
      const { price, at } = await fetchPrice(symbol);
      const p = Math.round(price * 10) / 10; // یک رقم اعشار
      const t = at ? new Date(at).toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" }) : "";
      $(fieldId).value = p;
      $(fieldId).error = false;
      $(fieldId).supportingText = "دریافت شد: " + fa1d(p) + " دلار" + (t ? " — ساعت " + t : "");
      icon.textContent = "sync";
      after();
    }catch(err){
      icon.textContent = "sync_problem";
      $(fieldId).supportingText = "دریافت ناموفق: " + err.message;
    }
  });
}
wireFetch("fetchXau", "ons", "XAU", calc);
wireFetch("fetchXag", "xag", "XAG", silver);
wireFetch("fetchXauCoin", "coinOns", "XAU", coinCalc);

/* ── ارزش ذاتی شمش نقره ۹۹۹ (یک کیلوگرمی) ── */
function silver(){
  const x = decimals($("xag").value);
  if(!x){ $("silverOut").style.display = "none"; return; }
  const v = x * (1000 / 31.1035) * 0.999; // ۱۰۰۰ گرم ÷ گرم‌به‌انس × خلوص ۹۹۹
  $("silverOut").style.display = "flex";
  $("silverVal").textContent = fa1d(v) + " دلار";
}
$("xag").addEventListener("input", silver);

/* ── حباب سکه (عیار ۹۰۰) ── */
let coinWeight = 8.133; // گرم — تمام‌سکه؛ نیم ۴٫۰۶۶۵ و ربع ۲٫۰۳۳۲۵
document.querySelectorAll("#coinSeg .seg").forEach(btn => {
  btn.addEventListener("click", () => {
    coinWeight = Number(btn.dataset.coin);
    document.querySelectorAll("#coinSeg .seg").forEach(b => b.classList.toggle("active", b === btn));
    coinCalc();
  });
});

function coinCalc(){
  const market = normalize($("coinPrice").value, "coin");
  const o = decimals($("coinOns").value);
  const d = normalize($("coinUsd").value, "usd");
  if(!market || !o || !d){ $("coinOut").style.display = "none"; return; }

  const zati = o * d / 31.1035 * coinWeight * 0.900; // نرخ گرم طلای خالص × وزن × عیار ۹۰۰
  const hobab = market - zati;
  $("coinOut").style.display = "block";
  $("coinZati").textContent = fa10k(zati) + " تومان";
  const el = $("coinHobab");
  el.className = "hobab " + (hobab >= 0 ? "pos" : "neg");
  el.innerHTML = "<md-icon>" + (hobab >= 0 ? "trending_up" : "trending_down") + "</md-icon>" +
                 " حباب: " + fa10k(hobab) + " تومان (" +
                 (hobab / zati * 100).toLocaleString("fa-IR", { maximumFractionDigits: 1 }) + "٪)";
}

/* ── منوی سه‌گانهٔ طلا / نقره / سکه ── */
$("nav").addEventListener("change", () => {
  ["view-gold", "view-silver", "view-coin"].forEach((id, k) => {
    $(id).hidden = $("nav").activeTabIndex !== k;
  });
});
