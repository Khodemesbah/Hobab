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

// دلار: تا ۳ رقم ×۱۰۰۰ — فرم کامل بدون تغییر
function normalize(raw, kind){
  const d = digits(raw);
  if(!d) return NaN;
  let n = Number(d);
  if(kind === "usd" && d.length <= 3) n *= 1000;
  return n;
}

/* ── زبان و نسخه ── */
const APP_VERSION = "0.9.5.2"; // نسخه‌های زیر ۱ برچسب Beta می‌گیرند
let lang = localStorage.getItem("hobab-lang") || "fa";
const T = {
  fa: {
    name: "حباب", subtitle: "اعلام ارزش ذاتی طلا و نقره",
    tabGold: "طلا", tabSilver: "نقره",
    onsLabel: "انس جهانی طلا (دلار)", usdLabel: "قیمت دلار بازار آزاد (تومان)",
    xagLabel: "انس جهانی نقره (دلار)",
    rowMesghal: "ارزش ذاتی مثقال", rowGeram: "ارزش ذاتی گرم ۱۸ عیار",
    silverRow: "ارزش ذاتی شمش یک‌کیلویی ۹۹۹",
    toman: " تومان", dollar: " دلار", read: "خوانده شد: ",
    waiting: "در انتظار دریافت داده…",
    marketOpen: "بازارهای جهانی فعال هستند", marketClosed: "بازارهای جهانی بسته‌اند",
    lastUpdate: "آخرین به‌روزرسانی — ", goldWord: "طلا", silverWord: "نقره",
    fetching: "در حال دریافت خودکار…",
    failed: "دریافت ناموفق: ", autoFailedHint: " — دکمهٔ کنار فیلد را بزن",
    source: "منبع: gold-api", atHour: " — ساعت ", closedTag: " — بازارهای جهانی بسته‌اند",
    saved: " (ذخیره‌شده)", manual: "آخرین نرخ دستی شما",
    required: "این مقدار لازم است",
    marketError: "دریافت دادهٔ بازار ناموفق بود — تلاش مجدد",
    locale: "fa-IR", dir: "rtl"
  },
  en: {
    name: "Hobab", subtitle: "Intrinsic value of gold & silver",
    tabGold: "Gold", tabSilver: "Silver",
    onsLabel: "Gold ounce (USD)", usdLabel: "Free-market USD rate (Toman)",
    xagLabel: "Silver ounce (USD)",
    rowMesghal: "Intrinsic value per mesghal", rowGeram: "Intrinsic value per 18k gram",
    silverRow: "Intrinsic value of 1 kg .999 bar",
    toman: " Toman", dollar: " USD", read: "Parsed: ",
    waiting: "Waiting for data…",
    marketOpen: "Global markets are open", marketClosed: "Global markets are closed",
    lastUpdate: "Last update — ", goldWord: "Gold", silverWord: "Silver",
    fetching: "Fetching automatically…",
    failed: "Fetch failed: ", autoFailedHint: " — use the sync button",
    source: "Source: gold-api", atHour: " — at ", closedTag: " — global markets closed",
    saved: " (saved)", manual: "Your last manual rate",
    required: "This value is required",
    marketError: "Couldn't fetch market data — retry",
    locale: "en-US", dir: "ltr"
  }
};
const t = k => T[lang][k];

const fa = n => Math.round(n).toLocaleString(t("locale"));
const fa10k = n => (Math.round(n / 10000) * 10000).toLocaleString(t("locale")); // نتایج تومانی: گرد به ده‌هزار
const fa1d = n => (Math.round(n * 10) / 10).toLocaleString(t("locale"), { maximumFractionDigits: 1 }); // دلاری: یک رقم اعشار

/* ── فرمول ── */
const MESGHAL_DIVISOR = 9.5742;   // انس×دلار ÷ این عدد = ذاتی مثقال
const GRAM_PER_MESGHAL = 4.3318;  // هر مثقال = ۴٫۳۳۱۸ گرم ۱۸ عیار

/* ── دریافت انس طلا/نقره از gold-api.com — رایگان، بدون کلید، با CORS ── */
const marketState = {}; // وضعیت هر نماد برای کارت بازار

// بازار جهانی طلا از جمعه ≈۲۲ UTC تا یکشنبه ≈۲۲ UTC بسته است
function marketClosedNow(){
  const now = new Date();
  const d = now.getUTCDay(), h = now.getUTCHours(); // 0=یکشنبه … 6=شنبه
  return d === 6 || (d === 5 && h >= 22) || (d === 0 && h < 22);
}
async function fetchPrice(symbol){ // "XAU" طلا ، "XAG" نقره
  const res = await fetch("https://api.gold-api.com/price/" + symbol,
    { signal: AbortSignal.timeout(10000) }); // حداکثر ۱۰ ثانیه انتظار، بعد خطا
  if(!res.ok) throw new Error("HTTP " + res.status);
  const data = await res.json();
  const tm = data.updatedAt
    ? new Date(data.updatedAt).toLocaleTimeString(t("locale"), { hour: "2-digit", minute: "2-digit" }) : "";
  // بسته بودن بازار: تقویم آخر هفته (قطعی) یا کهنگی دادهٔ منبع (پشتیبان)
  const stale = data.updatedAt && (Date.now() - new Date(data.updatedAt).getTime() > 45 * 60 * 1000);
  const closed = marketClosedNow() || stale;
  marketState[symbol] = { closed: !!closed, t: tm };
  updateMarketCard();
  return { price: Math.round(data.price * 10) / 10, tm: tm, closed: !!closed };
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

/* ── ثبت Service Worker برای PWA (نصب روی گوشی + آفلاین) ── */
if("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});

/* ── نمایش زندهٔ مقدار خوانده‌شده + محاسبهٔ زنده ── */
$("usd").addEventListener("input", e => {
  const n = normalize(e.target.value, "usd");
  e.target.supportingText = n ? t("read") + fa(n) + t("toman") : " ";
  e.target.error = false;
  if(n){ // آخرین نرخ دستی را برای دفعهٔ بعد نگه دار
    store.usd = { price: n, manual: true };
    try{ localStorage.setItem("hobabsanj-rates", JSON.stringify(store)); }catch(err){}
  }
  calc();
});
$("ons").addEventListener("input", e => { e.target.error = false; calc(); });

/* فیلد خالی هنگام ترک: خطای قابل‌دیدن */
["ons", "usd"].forEach(id => {
  $(id).addEventListener("blur", e => {
    const empty = !String(e.target.value).trim();
    e.target.error = empty;
    e.target.errorText = empty ? t("required") : "";
  });
});

/* ── محاسبهٔ زندهٔ ارزش ذاتی — مثقال و گرم هم‌زمان ── */
function calc(){
  const ons = decimals($("ons").value);   // انس: بدون انعطاف، با حفظ اعشار
  const usd = normalize($("usd").value, "usd");
  if(!ons || !usd){ $("out").style.display = "none"; return; }

  const mesghal = ons * usd / MESGHAL_DIVISOR;
  const geram = mesghal / GRAM_PER_MESGHAL;
  $("out").style.display = "block";
  $("zatiMesghal").textContent = fa10k(mesghal) + t("toman");
  $("zatiGeram").textContent = fa10k(geram) + t("toman");
}

/* ── قرار دادن نرخ در فیلد + ذخیره برای دفعهٔ بعد و حالت آفلاین ── */
const store = JSON.parse(localStorage.getItem("hobabsanj-rates") || "{}");
const infoText = r => r.manual ? t("manual")
  : t("source") + (r.tm ? t("atHour") + r.tm : "") + (r.closed ? t("closedTag") : "");
function applyRate(fieldId, r, after){
  $(fieldId).value = r.price;
  $(fieldId).error = false;
  $(fieldId).supportingText = " "; // زمان و منبع در کارت وضعیت بازار نمایش داده می‌شود
  store[fieldId] = r;
  try{ localStorage.setItem("hobabsanj-rates", JSON.stringify(store)); }catch(e){}
  after();
}

/* ── دکمه‌های دریافت قیمت داخل فیلدها ── */
function wireFetch(btnId, fieldId, fetcher, after){
  $(btnId).addEventListener("click", async () => {
    const icon = $(btnId).querySelector("md-icon");
    icon.textContent = "hourglass_top";
    try{
      applyRate(fieldId, await fetcher(), after);
      icon.textContent = "sync";
    }catch(err){
      icon.textContent = "sync_problem";
      $(fieldId).supportingText = t("failed") + err.message;
    }
  });
}
wireFetch("fetchXau", "ons", () => fetchPrice("XAU"), calc);
wireFetch("fetchXag", "xag", () => fetchPrice("XAG"), silver);

/* ── ارزش ذاتی شمش نقره ۹۹۹ (یک کیلوگرمی) ── */
function silver(){
  const x = decimals($("xag").value);
  if(!x){ $("silverOut").style.display = "none"; return; }
  const v = x * (1000 / 31.1035) * 0.999; // ۱۰۰۰ گرم ÷ گرم‌به‌انس × خلوص ۹۹۹
  $("silverOut").style.display = "block";
  $("silverVal").textContent = fa1d(v) + t("dollar");
}
$("xag").addEventListener("input", silver);

/* ── کارت وضعیت بازار جهانی ── */
function updateMarketCard(){
  const xau = marketState.XAU, xag = marketState.XAG;
  if(!xau && !xag) return;
  $("marketRetry").style.display = "none"; // داده رسید؛ حالت خطا پاک
  const closed = (xau && xau.closed) || (xag && xag.closed);
  $("marketCard").className = "market " + (closed ? "closed" : "open");
  $("marketIcon").textContent = closed ? "bedtime" : "radio_button_checked";
  $("marketLabel").textContent = closed ? t("marketClosed") : t("marketOpen");
  const parts = [];
  if(xau) parts.push(t("goldWord") + ": " + (xau.t || "—"));
  if(xag) parts.push(t("silverWord") + ": " + (xag.t || "—"));
  $("marketTimes").textContent = t("lastUpdate") + parts.join(" · ");
}

/* ── منوی دوگانهٔ طلا / نقره — با کلیک مستقیم، مستقل از رویداد داخلی کامپوننت ── */
document.querySelectorAll("#nav md-primary-tab").forEach((tab, k) => {
  tab.addEventListener("click", () => {
    ["view-gold", "view-silver"].forEach((id, i) => {
      $(id).hidden = i !== k;
    });
  });
});

/* ── زبان: اعمال همهٔ برچسب‌ها + دکمهٔ سوییچ فا/EN ── */
function applyLang(){
  document.documentElement.lang = lang;
  document.documentElement.dir = t("dir");
  document.title = t("name") + " | " + t("subtitle");
  $("appName").textContent = t("name");
  $("verBadge").textContent = "v" + APP_VERSION + (parseFloat(APP_VERSION) < 1 ? " Beta" : "");
  $("subtitle").textContent = t("subtitle");
  $("tabGoldLabel").textContent = t("tabGold");
  $("tabSilverLabel").textContent = t("tabSilver");
  $("ons").label = t("onsLabel");
  $("usd").label = t("usdLabel");
  $("xag").label = t("xagLabel");
  $("rowMesghalLabel").textContent = t("rowMesghal");
  $("rowGeramLabel").textContent = t("rowGeram");
  $("silverRowLabel").textContent = t("silverRow");
  if(!marketState.XAU && !marketState.XAG) $("marketLabel").textContent = t("waiting");
  updateMarketCard();
  if(store.usd && $("usd").value) $("usd").supportingText = infoText(store.usd);
  calc(); silver();
}
$("langBtn").addEventListener("click", () => {
  lang = lang === "fa" ? "en" : "fa";
  localStorage.setItem("hobab-lang", lang);
  applyLang();
});

/* ── باز شدن صفحه: زبان و برچسب‌ها، آخرین نرخ‌های ذخیره‌شده، بعد دریافت خودکار ── */
["ons", "usd", "xag"].forEach(id => {
  if(store[id]){
    $(id).value = store[id].price;
    $(id).supportingText = id === "usd" ? infoText(store[id]) + t("saved") : " ";
  }
});
applyLang();
try{ localStorage.removeItem("hobab-trend"); }catch(e){} // پاک‌سازی دادهٔ نمودار حذف‌شده

/* دریافت خودکار انس طلا و نقره — با حالت خطا و تلاش مجدد روی کارت بازار */
function marketError(){
  if(marketState.XAU || marketState.XAG) return; // دست‌کم یک دادهٔ معتبر داریم
  $("marketCard").className = "market closed";
  $("marketIcon").textContent = "error";
  $("marketLabel").textContent = t("marketError");
  $("marketTimes").textContent = "";
  $("marketRetry").style.display = "inline-flex";
}

function autoFetch(){
  [["ons", "XAU", calc], ["xag", "XAG", silver]].forEach(([fieldId, symbol, after]) => {
    if(!$(fieldId).value) $(fieldId).supportingText = t("fetching");
    fetchPrice(symbol)
      .then(r => applyRate(fieldId, r, after))
      .catch(err => {
        if(!$(fieldId).value) $(fieldId).supportingText = t("failed") + err.message + t("autoFailedHint");
        marketError();
      });
  });
}
$("marketRetry").addEventListener("click", autoFetch);
autoFetch();
