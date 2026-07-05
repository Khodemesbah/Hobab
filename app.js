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
const APP_VERSION = "0.9.9.5"; // تنها جای تعریف نسخه — sw.js آن را از ?v= آدرس ثبت خودش می‌خواند
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
    marketOpen: "بازار جهانی باز است", marketClosed: "بازار جهانی بسته است",
    lastUpdate: "آخرین به‌روزرسانی — ", goldWord: "طلا", silverWord: "نقره",
    fetching: "در حال دریافت خودکار…",
    failed: "دریافت ناموفق: ", autoFailedHint: " — دکمهٔ کنار فیلد را بزن",
    source: "منبع: gold-api", atHour: " — ساعت ", closedTag: " — بازار جهانی بسته است",
    required: "این مقدار لازم است", copied: "کپی شد ✓",
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
    marketOpen: "Global market is open", marketClosed: "Global market is closed",
    lastUpdate: "Last update — ", goldWord: "Gold", silverWord: "Silver",
    fetching: "Fetching automatically…",
    failed: "Fetch failed: ", autoFailedHint: " — use the sync button",
    source: "Source: gold-api", atHour: " — at ", closedTag: " — global market closed",
    required: "This value is required", copied: "Copied ✓",
    marketError: "Couldn't fetch market data — retry",
    locale: "en-US", dir: "ltr"
  }
};
const t = k => T[lang][k];

const fa = n => Math.round(n).toLocaleString(t("locale"));
const fa10k = n => (Math.round(n / 10000) * 10000).toLocaleString(t("locale")); // نتایج تومانی: گرد به ده‌هزار
const fa1d = n => (Math.round(n * 10) / 10).toLocaleString(t("locale"), { maximumFractionDigits: 1 }); // دلاری: یک رقم اعشار
// ارقام داخل فیلد: در فارسی فقط رقم‌ها تبدیل می‌شوند؛ نقطهٔ اعشار می‌ماند تا پارس نشکند
const fieldNum = n => lang === "fa" ? String(n).replace(/[0-9]/g, d => "۰۱۲۳۴۵۶۷۸۹"[d]) : String(n);

/* ── فرمول ── */
const MESGHAL_DIVISOR = 9.5742;   // انس×دلار ÷ این عدد = ذاتی مثقال
const GRAM_PER_MESGHAL = 4.3318;  // هر مثقال = ۴٫۳۳۱۸ گرم ۱۸ عیار

/* ── دریافت انس طلا/نقره از gold-api.com — رایگان، بدون کلید، با CORS ── */
const marketState = {}; // وضعیت هر نماد برای کارت بازار
let lastFetchAt = 0; // زمان آخرین دریافت موفق — مبنای رفرش خودکار هنگام برگشت به اپ

// ماه هلالی با برق چهارپر — هم‌خانوادهٔ آیکون‌های اختصاصی تب‌ها، وفادار به متریال ۳
const MOON_SVG = '<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M12.6 21a9 9 0 0 1-8.55-11.8A9 9 0 0 1 11 3.1c.5-.06.8.5.52.9a7.2 7.2 0 0 0 9.4 10.4c.44-.23.98.1.9.6A9 9 0 0 1 12.6 21Z"/><path d="M17.5 3l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z"/></svg>';
// دات توپُر برای وضعیت «باز» — الگوی live status متریال؛ رنگ از primary تم می‌آید، نه سبز خارج از سیستم
const DOT_SVG = '<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><circle cx="12" cy="12" r="5"/></svg>';

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
  marketState[symbol] = { closed: !!closed, t: tm, at: data.updatedAt }; // زمان خام هم می‌ماند تا با تعویض زبان دوباره فرمت شود
  try{ updateMarketCard(); }catch(e){} // خطای UI کارت نباید دریافت قیمت را ناموفق جلوه دهد
  lastFetchAt = Date.now();
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
  // نوار وضعیت PWA باید با تم هماهنگ شود؛ متای ثابت در تم تاریک رنگ روشن نشان می‌داد
  const meta = document.querySelector('meta[name="theme-color"]');
  if(meta) meta.content = root.dataset.theme === "dark" ? "#131320" : "#565992";
}

/* ── ثبت Service Worker برای PWA (نصب روی گوشی + آفلاین) ── */
if("serviceWorker" in navigator) // تغییر ?v= یعنی اسکریپت ورکر جدید — مرورگر خودش نسخهٔ جدید را نصب می‌کند
  navigator.serviceWorker.register("sw.js?v=" + APP_VERSION, { updateViaCache: "none" }).catch(() => {});

/* ── نمایش زندهٔ مقدار خوانده‌شده + محاسبهٔ زنده ── */
$("usd").addEventListener("input", e => {
  const n = normalize(e.target.value, "usd");
  e.target.supportingText = n ? t("read") + fa(n) + t("toman") : " ";
  e.target.error = false;
  calc(); // نرخ دستی عمداً ذخیره نمی‌شود؛ با هر بازدید خالی است
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

/* بازخورد بصری: پرش کوتاه عدد هنگام به‌روز شدن */
function bump(el){ el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump"); }

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
  bump($("zatiMesghal")); // بازخورد بصری تغییر عدد
}

/* ── قرار دادن نرخ در فیلد + ذخیره برای دفعهٔ بعد و حالت آفلاین ── */
const store = JSON.parse(localStorage.getItem("hobabsanj-rates") || "{}");
function applyRate(fieldId, r, after){
  $(fieldId).value = fieldNum(r.price);
  $(fieldId).error = false;
  $(fieldId).supportingText = " "; // زمان و منبع در کارت وضعیت بازار نمایش داده می‌شود
  store[fieldId] = r;
  try{ localStorage.setItem("hobabsanj-rates", JSON.stringify(store)); }catch(e){}
  after();
}

/* ── دکمه‌های دریافت قیمت — رفرش در هر تب، هر دو فلز را به‌روز می‌کند ── */
const iconTimers = {}; // تایمر برگشت تیک به آیکون رفرش، برای هر دکمه
const FETCH_MAP = { fetchXau: ["ons", "XAU", calc], fetchXag: ["xag", "XAG", silver] };
function setBtnIcon(btnId, name){
  const icon = $(btnId).querySelector("md-icon");
  clearTimeout(iconTimers[btnId]);
  icon.classList.remove("spin"); // تیک و خطا همیشه ثابت‌اند — هیچ‌وقت نمی‌چرخند
  icon.style.animation = "none"; // تضمین دوم: استایل درون‌خطی بر هر کلاس و قاعدهٔ CSS برنده است
  icon.textContent = name;
  if(name === "check") // تیک متریال ۲۰ ثانیه می‌ماند، بعد دوباره آیکون رفرش
    iconTimers[btnId] = setTimeout(() => { icon.textContent = "sync"; }, 20000);
}
async function refreshBoth(btnId){ // کلیک روی تیک هم دوباره به‌روزرسانی می‌کند
  const icon = $(btnId).querySelector("md-icon");
  clearTimeout(iconTimers[btnId]);
  icon.textContent = "sync";
  icon.style.animation = ""; // چرخش فقط همین‌جا، برای آیکون sync، آزاد می‌شود
  icon.classList.add("spin");
  // فلز تبِ دیگر در پس‌زمینه به‌روز می‌شود و آیکون را معطل نمی‌کند —
  // ریشهٔ چرخش طولانی، انتظار برای کُندترین درخواست (تا مهلت ۱۰ ثانیه) بود
  const otherBtn = btnId === "fetchXau" ? "fetchXag" : "fetchXau";
  const [oField, oSymbol, oAfter] = FETCH_MAP[otherBtn];
  fetchPrice(oSymbol)
    .then(r => applyRate(oField, r, oAfter))
    .catch(err => { $(oField).supportingText = t("failed") + err.message; });
  // آیکون فقط تابع فلز همین تب است: به محض رسیدن قیمت، تیک ثابت
  const [field, symbol, after] = FETCH_MAP[btnId];
  try{
    applyRate(field, await fetchPrice(symbol), after);
    setBtnIcon(btnId, "check");
  }catch(err){
    $(field).supportingText = t("failed") + err.message;
    setBtnIcon(btnId, "sync_problem");
  }
}
$("fetchXau").addEventListener("click", () => refreshBoth("fetchXau"));
$("fetchXag").addEventListener("click", () => refreshBoth("fetchXag"));

/* ── ارزش ذاتی شمش نقره ۹۹۹ (یک کیلوگرمی) ── */
function silver(){
  $("xagSkl").hidden = true; // دادهٔ واقعی جایگزین اسکلتون
  const x = decimals($("xag").value);
  if(!x){ $("silverOut").style.display = "none"; return; }
  const v = x * (1000 / 31.1035) * 0.999; // ۱۰۰۰ گرم ÷ گرم‌به‌انس × خلوص ۹۹۹
  $("silverOut").style.display = "block";
  $("silverVal").textContent = fa1d(v) + t("dollar");
  bump($("silverVal"));
}
$("xag").addEventListener("input", silver);

/* ── کارت وضعیت بازار جهانی ── */
function updateMarketCard(){
  const xau = marketState.XAU, xag = marketState.XAG;
  if(!xau && !xag) return;
  $("marketSkl").hidden = true; // پایان اسکلتون
  ($("marketHead") || $("marketLabel")).hidden = false; // سازگاری با HTML قدیمیِ هنوز کش‌شده در CDN
  $("marketRetry").style.display = "none"; // داده رسید؛ حالت خطا پاک
  const closed = (xau && xau.closed) || (xag && xag.closed);
  $("marketCard").className = "market " + (closed ? "closed" : "open");
  $("marketIcon").innerHTML = closed ? MOON_SVG : DOT_SVG; // ماه متریال ۳ / دات یاسی primary
  $("marketLabel").textContent = closed ? t("marketClosed") : t("marketOpen");
  // به‌روزرسانی همگام است؛ فقط جدیدترین ساعت نمایش داده می‌شود — از زمان خام، تا با تعویض زبان دوباره فرمت شود
  const times = [xau, xag].filter(s => s && s.at).map(s => new Date(s.at).getTime());
  const tmStr = times.length
    ? new Date(Math.max(...times)).toLocaleTimeString(t("locale"), { hour: "2-digit", minute: "2-digit" })
    : ((xau && xau.t) || (xag && xag.t) || "—");
  $("marketTimes").textContent = t("lastUpdate") + tmStr;
}

/* ── منوی دوگانهٔ طلا / نقره — با کلیک مستقیم، مستقل از رویداد داخلی کامپوننت ── */
document.querySelectorAll("#nav md-primary-tab").forEach((tab, k) => {
  tab.addEventListener("click", () => {
    ["view-gold", "view-silver"].forEach((id, i) => {
      $(id).hidden = i !== k;
    });
  });
});
// جابه‌جایی با صفحه‌کلید (کلیدهای جهت‌نما) فقط رویداد change را می‌فرستد، نه click
$("nav").addEventListener("change", () => {
  const k = $("nav").activeTabIndex;
  if(k == null || k < 0) return;
  ["view-gold", "view-silver"].forEach((id, i) => { $(id).hidden = i !== k; });
});

/* ── زبان: اعمال همهٔ برچسب‌ها + دکمهٔ سوییچ فا/EN ── */
function applyLang(){
  document.documentElement.lang = lang;
  document.documentElement.dir = t("dir");
  document.title = t("name") + " | " + t("subtitle");
  $("appName").textContent = t("name");
  $("verBadge").textContent = lang === "fa"
    ? fieldNum(APP_VERSION) + (parseFloat(APP_VERSION) < 1 ? " بتا" : "")
    : "v" + APP_VERSION + (parseFloat(APP_VERSION) < 1 ? " Beta" : "");
  $("subtitle").textContent = t("subtitle");
  $("tabGoldLabel").textContent = t("tabGold");
  $("tabSilverLabel").textContent = t("tabSilver");
  $("ons").label = t("onsLabel");
  $("usd").label = t("usdLabel");
  $("xag").label = t("xagLabel");
  $("rowMesghalLabel").textContent = t("rowMesghal");
  $("rowGeramLabel").textContent = t("rowGeram");
  $("silverRowLabel").textContent = t("silverRow");
  updateMarketCard();
  // مقدار فعلی فیلد مبنا است؛ نسخهٔ قبلی مقدار دستی کاربر را با نرخ ذخیره‌شده جایگزین می‌کرد
  ["ons", "xag"].forEach(id => {
    const cur = decimals($(id).value);
    if(cur) $(id).value = fieldNum(cur);
  });
  calc(); silver();
}
$("langBtn").addEventListener("click", () => {
  lang = lang === "fa" ? "en" : "fa";
  localStorage.setItem("hobab-lang", lang);
  applyLang();
});

/* ── باز شدن صفحه: زبان و برچسب‌ها، آخرین نرخ‌های ذخیره‌شده، بعد دریافت خودکار ── */
["ons", "xag"].forEach(id => { // دلار عمداً بازیابی نمی‌شود
  if(store[id]){
    $(id).value = fieldNum(store[id].price);
    $(id).supportingText = " ";
  }
});
applyLang();
try{ localStorage.removeItem("hobab-trend"); }catch(e){} // پاک‌سازی دادهٔ نمودار حذف‌شده

/* دریافت خودکار انس طلا و نقره — با حالت خطا و تلاش مجدد روی کارت بازار */
function marketError(){
  if(marketState.XAU || marketState.XAG) return; // دست‌کم یک دادهٔ معتبر داریم
  $("marketSkl").hidden = true;
  ($("marketHead") || $("marketLabel")).hidden = false; // سازگاری با HTML قدیمیِ هنوز کش‌شده در CDN
  $("marketCard").className = "market closed";
  $("marketIcon").textContent = "error";
  $("marketLabel").textContent = t("marketError");
  $("marketTimes").textContent = "";
  $("marketRetry").style.display = "inline-flex";
}

function autoFetch(){
  [["ons", "XAU", calc], ["xag", "XAG", silver]].forEach(([fieldId, symbol, after]) => {
    if(!$(fieldId).value) $(fieldId).supportingText = t("fetching");
    if(fieldId === "xag" && !$("xag").value) $("xagSkl").hidden = false; // اسکلتون نتیجهٔ نقره
    fetchPrice(symbol)
      .then(r => applyRate(fieldId, r, after))
      .catch(err => {
        if(!$(fieldId).value) $(fieldId).supportingText = t("failed") + err.message + t("autoFailedHint");
        if(fieldId === "xag") $("xagSkl").hidden = true;
        marketError();
      });
  });
}
$("marketRetry").addEventListener("click", autoFetch);
autoFetch();

/* ── رفرش خودکار هوشمند: برگشت به اپ بعد از ۵+ دقیقه غیبت → دریافت بی‌صدا ── */
document.addEventListener("visibilitychange", () => {
  if(document.visibilityState === "visible" && Date.now() - lastFetchAt > 5 * 60 * 1000) autoFetch();
});

/* ── کپی با لمس: لمس کارت نتیجه، عدد اصلی را در کلیپ‌بورد می‌گذارد ── */
function copyValue(valueId, labelId, labelKey){
  const txt = $(valueId).textContent.trim();
  if(!txt || !navigator.clipboard) return;
  navigator.clipboard.writeText(txt).then(() => {
    $(labelId).textContent = t("copied"); // بازخورد کوتاه روی سرصفحهٔ کارت
    setTimeout(() => { $(labelId).textContent = t(labelKey); }, 1200);
  }).catch(() => {});
}
$("out").addEventListener("click", () => copyValue("zatiMesghal", "rowMesghalLabel", "rowMesghal"));
$("silverOut").addEventListener("click", () => copyValue("silverVal", "silverRowLabel", "silverRow"));
