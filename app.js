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

const fa = n => Math.round(n).toLocaleString("fa-IR");
const fa10k = n => (Math.round(n / 10000) * 10000).toLocaleString("fa-IR"); // نتایج تومانی: گرد به ده‌هزار تومان
const fa1d = n => (Math.round(n * 10) / 10).toLocaleString("fa-IR", { maximumFractionDigits: 1 }); // اعداد دلاری: حداکثر یک رقم اعشار

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
  if(!res.ok) throw new Error("خطای " + res.status);
  const data = await res.json();
  const t = data.updatedAt
    ? new Date(data.updatedAt).toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" }) : "";
  // بسته بودن بازار: تقویم آخر هفته (قطعی) یا کهنگی دادهٔ منبع (پشتیبان)
  const stale = data.updatedAt && (Date.now() - new Date(data.updatedAt).getTime() > 45 * 60 * 1000);
  const closed = marketClosedNow() || stale;
  marketState[symbol] = { closed: !!closed, t };
  updateMarketCard();
  if(symbol === "XAU") addTrendSample(data.price); // نمونه برای نمودار روند
  return { price: Math.round(data.price * 10) / 10,
           info: "منبع: gold-api" + (t ? " — ساعت " + t : "") + (closed ? " — بازارهای جهانی بسته‌اند" : "") };
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
  e.target.supportingText = n ? "خوانده شد: " + fa(n) + " تومان" : " ";
  e.target.error = false;
  if(n){ // آخرین نرخ دستی را برای دفعهٔ بعد نگه دار
    store.usd = { price: n, info: "آخرین نرخ دستی شما" };
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
    e.target.errorText = empty ? "این مقدار لازم است" : "";
  });
});

/* ── محاسبهٔ زندهٔ ارزش ذاتی — مثقال و گرم هم‌زمان ── */
let last = null; // آخرین نتیجه برای اشتراک
function calc(){
  const ons = decimals($("ons").value);   // انس: بدون انعطاف، با حفظ اعشار
  const usd = normalize($("usd").value, "usd");
  if(!ons || !usd){ $("out").style.display = "none"; return; }

  const mesghal = ons * usd / MESGHAL_DIVISOR;
  const geram = mesghal / GRAM_PER_MESGHAL;
  last = { mesghal, geram };
  $("out").style.display = "block";
  $("zatiMesghal").textContent = fa10k(mesghal) + " تومان";
  $("zatiGeram").textContent = fa10k(geram) + " تومان";
}
/* ── اشتراک نتیجه ── */
$("share").addEventListener("click", () => {
  if(!last) return;
  const text = "ارزش ذاتی طلا — مثقال: " + fa10k(last.mesghal) + " تومان، گرم ۱۸ عیار: " + fa10k(last.geram) + " تومان";
  if(navigator.share) navigator.share({ text: text, url: location.href }).catch(() => {});
  else navigator.clipboard.writeText(text + " — " + location.href);
});

/* ── قرار دادن نرخ در فیلد + ذخیره برای دفعهٔ بعد و حالت آفلاین ── */
const store = JSON.parse(localStorage.getItem("hobabsanj-rates") || "{}");
function applyRate(fieldId, r, after){
  $(fieldId).value = r.price;
  $(fieldId).error = false;
  $(fieldId).supportingText = r.info;
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
      $(fieldId).supportingText = "دریافت ناموفق: " + err.message;
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
  $("silverOut").style.display = "flex";
  $("silverVal").textContent = fa1d(v) + " دلار";
}
$("xag").addEventListener("input", silver);

/* ── کارت وضعیت بازار جهانی ── */
function updateMarketCard(){
  const xau = marketState.XAU, xag = marketState.XAG;
  if(!xau && !xag) return;
  const closed = (xau && xau.closed) || (xag && xag.closed);
  $("marketCard").className = "market " + (closed ? "closed" : "open");
  $("marketIcon").textContent = closed ? "bedtime" : "radio_button_checked";
  $("marketLabel").textContent = closed ? "بازارهای جهانی بسته‌اند" : "بازارهای جهانی بازند";
  const parts = [];
  if(xau) parts.push("طلا: " + (xau.t || "—"));
  if(xag) parts.push("نقره: " + (xag.t || "—"));
  $("marketTimes").textContent = "آخرین به‌روزرسانی — " + parts.join(" · ");
}

/* ── روند انس طلا — نمونه‌گیری روی همین دستگاه، بدون وابستگی جدید ── */
const TREND_KEY = "hobab-trend";
function addTrendSample(p){
  let arr = [];
  try{ arr = JSON.parse(localStorage.getItem(TREND_KEY) || "[]"); }catch(e){}
  const lastS = arr[arr.length - 1];
  if(!lastS || Date.now() - lastS.t > 10 * 60 * 1000){ // حداکثر یک نمونه در ۱۰ دقیقه
    arr.push({ t: Date.now(), p: p });
    if(arr.length > 60) arr = arr.slice(-60); // فقط ۶۰ نمونهٔ آخر
    try{ localStorage.setItem(TREND_KEY, JSON.stringify(arr)); }catch(e){}
  }
  drawTrend(arr);
}

function drawTrend(arr){
  if(!arr){
    try{ arr = JSON.parse(localStorage.getItem(TREND_KEY) || "[]"); }catch(e){ arr = []; }
  }
  if(arr.length === 0){ $("trend").style.display = "none"; return; }
  if(arr.length < 2){ // با یک نقطه هنوز خطی نیست؛ ولی وضعیت را نشان بده
    $("trend").style.display = "block";
    $("spark").style.display = "none";
    $("trendDelta").textContent = "";
    $("trendLabel").textContent = "نمونهٔ اول انس ثبت شد — نمودار از بازدیدهای بعدی شکل می‌گیرد";
    return;
  }
  $("trendLabel").textContent = "روند انس طلا (نمونه‌های این دستگاه)";
  $("spark").style.display = "block";
  const ps = arr.map(s => s.p);
  const min = Math.min.apply(null, ps), max = Math.max.apply(null, ps);
  const span = (max - min) || 1;
  const pts = ps.map((p, i) =>
    (i * (300 / (ps.length - 1))).toFixed(1) + "," + (55 - (p - min) / span * 50).toFixed(1)
  ).join(" ");
  $("spark").innerHTML =
    '<polygon class="area" points="0,60 ' + pts + ' 300,60"/><polyline points="' + pts + '"/>';
  const delta = ps[ps.length - 1] - ps[0];
  $("trendDelta").textContent = (delta >= 0 ? "▲ " : "▼ ") +
    Math.abs(delta / ps[0] * 100).toLocaleString("fa-IR", { maximumFractionDigits: 2 }) + "٪";
  $("trendDelta").style.color = delta >= 0 ? "var(--ok-fg)" : "#C62828";
  $("trend").style.display = "block";
}

/* ── منوی دوگانهٔ طلا / نقره — با کلیک مستقیم، مستقل از رویداد داخلی کامپوننت ── */
document.querySelectorAll("#nav md-primary-tab").forEach((tab, k) => {
  tab.addEventListener("click", () => {
    ["view-gold", "view-silver"].forEach((id, i) => {
      $(id).hidden = i !== k;
    });
  });
});

/* ── باز شدن صفحه: اول آخرین نرخ‌های ذخیره‌شده، بعد دریافت خودکار نرخ تازه ── */
["ons", "usd", "xag"].forEach(id => {
  if(store[id]){
    $(id).value = store[id].price;
    $(id).supportingText = store[id].info + " (ذخیره‌شده)";
  }
});
calc(); silver(); drawTrend();
fetchPrice("XAU").then(r => applyRate("ons", r, calc)).catch(() => {});
fetchPrice("XAG").then(r => applyRate("xag", r, silver)).catch(() => {});
