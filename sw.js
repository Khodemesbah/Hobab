/* نسخه از پارامتر ?v= آدرس ثبت می‌آید (sw.js?v=…) — تنها جای تعریفش app.js است */
const APP_VERSION = new URL(self.location.href).searchParams.get("v") || "dev";
const CACHE = "hobab-v" + APP_VERSION;
const ASSETS = ["./", "./index.html", "./styles.css", "./app.js", "./manifest.json", "./icon.svg",
  "./fonts/AbarMid-Regular.woff2", "./fonts/AbarMid-SemiBold.woff2",
  "./fonts/AbarMid-Bold.woff2", "./fonts/AbarMid-ExtraBold.woff2"];

self.addEventListener("install", e => {
  // cache:"reload" — عبور از کش HTTP مرورگر؛ فایل‌های نسخهٔ جدید همیشه مستقیم از شبکه
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: "reload" })))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener("fetch", e => {
  if(e.request.method !== "GET") return;
  if(new URL(e.request.url).origin !== self.location.origin) return; // API و CDN همیشه از شبکه

  /* HTML و app.js: اول شبکه، تا آپدیت‌ها و آدرس ثبت ?v= جدید همیشه فوری برسند؛ کش فقط برای آفلاین */
  if(e.request.mode === "navigate" || new URL(e.request.url).pathname.endsWith("/app.js")){
    e.respondWith(
      fetch(e.request).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return res;
      }).catch(() => caches.match(e.request).then(hit => hit || caches.match("./")))
    );
    return;
  }

  /* بقیهٔ فایل‌ها: کش‌اول از کشِ نسخه‌دار — با هر انتشار، CACHE عوض می‌شود و همه از شبکه تازه می‌شوند */
  e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request)));
});
