/* با هر انتشار، نام کش را همراه ?v= عوض کن تا نسخهٔ جدید جایگزین شود */
const CACHE = "hobab-v0.9.4";
const ASSETS = ["./", "./index.html", "./styles.css?v=0.9.4", "./app.js?v=0.9.4", "./manifest.json", "./icon.svg"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
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

  /* HTML: اول شبکه، تا آپدیت‌ها همیشه فوری برسند؛ کش فقط برای حالت آفلاین */
  if(e.request.mode === "navigate"){
    e.respondWith(
      fetch(e.request).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return res;
      }).catch(() => caches.match(e.request).then(hit => hit || caches.match("./")))
    );
    return;
  }

  /* بقیهٔ فایل‌ها نسخه‌دارند (?v=)؛ کش‌شان امن است */
  e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request)));
});
