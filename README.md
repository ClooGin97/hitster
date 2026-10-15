# hitster

Play Hitster online: click the deck to hear a song, guess the year, then reveal the answer.

Playback runs through **your own Spotify account** (Premium required) via Spotify's Web Playback SDK. To run this yourself:

1. Create an app at the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard).
2. In that app's settings, add a **Redirect URI** that exactly matches the URL you'll serve this site from (e.g. `https://yourusername.github.io/hitster/` or `http://127.0.0.1:8080/` for local testing). It must be `http://` on localhost or `https://` in production — `file://` does not work.
3. Copy the app's **Client ID** into `config.js`:
   ```js
   clientId: "YOUR_SPOTIFY_CLIENT_ID",
   ```
4. Serve the folder over HTTP(S) (e.g. `python3 -m http.server`) and open it at the same URL you registered — the login screen will ask you to log in with Spotify, and playback needs a Premium account.

No backend or client secret required — auth uses the PKCE flow entirely in the browser.

## Deploying on Vercel

This is a static site, so it deploys with no build step:

1. On [vercel.com](https://vercel.com), sign in with GitHub and import this repository (`Add New...` → `Project`).
2. Leave the defaults — `vercel.json` already tells it this is a static ("Other") project with no build command — and click **Deploy**.
3. Once live, add the resulting `https://....vercel.app` URL as another **Redirect URI** in the Spotify app's settings (you can keep the GitHub Pages one too — multiple redirect URIs are allowed).

No code changes are needed to add a host: the redirect URI in `config.js` is computed from whatever domain serves the page.
