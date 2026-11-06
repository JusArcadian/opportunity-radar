/*
  sw.js - the "service worker". It is what makes Radar installable and lets it open offline.

  ELI5: it's a little helper that sits between the app and the internet.
  - The app's own files (HTML, CSS, JS, icons) are saved on the phone the first time,
    so the app opens instantly, even with no signal.
  - The job feed (data/*.json) always tries the internet first so you get today's jobs,
    and falls back to the last saved copy when you're offline.
  Bump VERSION whenever you change an app file, so phones pick up the new version.
*/
const VERSION = "radar-v0.9.3";
const APP_FILES = [
  "./", "./index.html", "./styles.css", "./job-picker.js", "./resume.js", "./talk.js", "./app.js", "./manifest.webmanifest",
  "./icons/icon-192.png", "./icons/icon-512.png", "./icons/maskable-512.png", "./icons/apple-touch-icon.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(APP_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  // delete caches from older versions
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== location.origin) return; // only our own files
  if (url.pathname.includes("/data/")) {
    // job feed: network first, saved copy when offline
    event.respondWith(
      fetch(event.request).then((res) => {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(event.request, copy));
        return res;
      }).catch(() => caches.match(event.request))
    );
    return;
  }
  // app files: saved copy first, internet if missing
  event.respondWith(caches.match(event.request).then((hit) => hit || fetch(event.request)));
});
