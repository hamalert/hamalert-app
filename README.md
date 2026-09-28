# HamAlert app

This is the source code for the HamAlert app, available on the [Play Store](https://play.google.com/store/apps/details?id=org.hamalert.app) and the [App Store](https://itunes.apple.com/us/app/hamalert/id1200759798?mt=8). Its main purpose is to receive push notifications (via FCM and APNS) from the HamAlert backend and display them to the user.

The app is built with Apache Cordova for cross-platform compatibility, and uses [Onsen UI](https://onsen.io) for a native-like feel adapted to the two platforms.

## Running in a desktop browser

For quick UI iteration (e.g. testing how a new spot type renders) you don't need a phone or an emulator: the app can run in a desktop Chromium window via Cordova's `browser` platform, talking to a local HamAlert web app instead of the production server at hamalert.org.

Prerequisites:

* Node.js (a recent LTS version)
* A local HamAlert web app to log into, either:
  * `hamalert-server`'s one-command dev stack: `npm run local-dev` in the `hamalert-server` repo (starts the web app at `http://localhost:8081`, and prints a seeded user/password you can log in with), or
  * a standalone `hamalert-web` checkout run per its own instructions, also listening on `http://localhost:8081`

Then, from this repo:

```
cd HamAlert
npm install
npm run browser-dev
```

This adds Cordova's `browser` platform (if not already added; `platforms/` and `plugins/` are gitignored, so this never dirties the working tree) and launches the app in a Chromium window served at `http://localhost:8000`. Log in with a user from your local stack, e.g. `N0CALL` / `testpass123`.

By default browser dev mode talks to `http://localhost:8081`. To point it at a different local API origin, open the app with an `?api=` query parameter, e.g. `http://localhost:8000/?api=http://localhost:9081`. The value is remembered in `localStorage` (key `apiBase`) for next time; clear that key (or your browser's site data for the app) to reset it. You can also set the `HAMALERT_API_BASE` environment variable before running `npm run browser-dev` to have that origin pre-allowed by the browser platform's Content-Security-Policy.

What doesn't work in browser dev mode:

* Push notifications — the app detects that pushes aren't meaningful under `cordova-browser` (there's no server-side counterpart for the plugin's Web Push shim) and skips registration entirely, logging a message to the console instead of erroring out.
* Notification sounds (nothing plays a sound without a push to react to).

Dark/light theme detection does work in the browser (it's backed by `prefers-color-scheme`, i.e. your OS/browser setting), and the status bar plugin calls are silently no-ops there, as they are on a real device that isn't Android/iOS.

Everything else — login, the spot list, spot details, mutes, and the in-app-browser links to the web app (triggers, limits, destinations, settings, account deletion) — works the same as on a device.
