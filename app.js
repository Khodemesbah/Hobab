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
async function fetchPrice(symbol){ // "XAU" طلا ، "XAG" نقره
  const res = await fetch("https://api.gold-api.com/price/" + symbol,
    { signal: AbortSignal.timeout(10000) }); // حداکثر ۱۰ ثانیه انتظار، بعد خطا
  if(!res.ok) throw new Error("خطای " + res.status);
  const data = await res.json();
  const t = data.updatedAt
    ? new Date(data.updatedAt).toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" }) : "";
  // اگر قیمت بیش از ۴۵ دقیقه به‌روز نشده باشد، بازار جهانی بسته است
  const closed = data.updatedAt && (Date.now() - new Date(data.updatedAt).getTime() > 45 * 60 * 1000);
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
calc(); silver();
fetchPrice("XAU").then(r => applyRate("ons", r, calc)).catch(() => {});
fetchPrice("XAG").then(r => applyRate("xag", r, silver)).catch(() => {});
