// Spotify Authorization Code with PKCE — no client secret, works from a static site.
// Docs: https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow
const SpotifyAuth = (() => {
  "use strict";

  const STORAGE = {
    verifier: "spotify_code_verifier",
    accessToken: "spotify_access_token",
    refreshToken: "spotify_refresh_token",
    expiresAt: "spotify_expires_at",
  };

  function randomString(length) {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    const values = crypto.getRandomValues(new Uint8Array(length));
    for (let i = 0; i < length; i++) result += chars[values[i] % chars.length];
    return result;
  }

  async function sha256Base64Url(input) {
    const data = new TextEncoder().encode(input);
    const digest = await crypto.subtle.digest("SHA-256", data);
    return btoa(String.fromCharCode(...new Uint8Array(digest)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  }

  async function login() {
    if (!SPOTIFY_CONFIG.clientId || SPOTIFY_CONFIG.clientId === "YOUR_SPOTIFY_CLIENT_ID") {
      throw new Error("Missing Spotify Client ID. Set it in config.js.");
    }
    const verifier = randomString(64);
    sessionStorage.setItem(STORAGE.verifier, verifier);
    const challenge = await sha256Base64Url(verifier);

    const params = new URLSearchParams({
      client_id: SPOTIFY_CONFIG.clientId,
      response_type: "code",
      redirect_uri: SPOTIFY_CONFIG.redirectUri,
      code_challenge_method: "S256",
      code_challenge: challenge,
      scope: SPOTIFY_CONFIG.scopes.join(" "),
    });
    window.location.href = "https://accounts.spotify.com/authorize?" + params.toString();
  }

  function logout() {
    Object.values(STORAGE).forEach((k) => sessionStorage.removeItem(k));
  }

  function storeTokenResponse(data) {
    sessionStorage.setItem(STORAGE.accessToken, data.access_token);
    if (data.refresh_token) sessionStorage.setItem(STORAGE.refreshToken, data.refresh_token);
    const expiresAt = Date.now() + (data.expires_in - 30) * 1000;
    sessionStorage.setItem(STORAGE.expiresAt, String(expiresAt));
  }

  async function exchangeCodeForToken(code) {
    const verifier = sessionStorage.getItem(STORAGE.verifier);
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: SPOTIFY_CONFIG.redirectUri,
      client_id: SPOTIFY_CONFIG.clientId,
      code_verifier: verifier,
    });
    const res = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!res.ok) throw new Error("Spotify token exchange failed (" + res.status + ")");
    storeTokenResponse(await res.json());
  }

  async function refreshAccessToken() {
    const refreshToken = sessionStorage.getItem(STORAGE.refreshToken);
    if (!refreshToken) throw new Error("No refresh token available");
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: SPOTIFY_CONFIG.clientId,
    });
    const res = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!res.ok) throw new Error("Spotify token refresh failed (" + res.status + ")");
    storeTokenResponse(await res.json());
  }

  // Runs once on page load. If Spotify sent us back with ?code=..., trade it for a token.
  async function handleRedirect() {
    const url = new URL(window.location.href);
    const code = url.searchParams.get("code");
    const error = url.searchParams.get("error");
    if (!code && !error) return;

    url.searchParams.delete("code");
    url.searchParams.delete("state");
    url.searchParams.delete("error");
    window.history.replaceState({}, document.title, url.pathname + url.search + url.hash);

    if (error) throw new Error("Spotify login failed: " + error);
    await exchangeCodeForToken(code);
  }

  function isLoggedIn() {
    return !!sessionStorage.getItem(STORAGE.accessToken);
  }

  async function getValidAccessToken() {
    const expiresAt = Number(sessionStorage.getItem(STORAGE.expiresAt) || 0);
    if (Date.now() >= expiresAt) {
      await refreshAccessToken();
    }
    const token = sessionStorage.getItem(STORAGE.accessToken);
    if (!token) throw new Error("Not logged in to Spotify");
    return token;
  }

  return { login, logout, handleRedirect, isLoggedIn, getValidAccessToken };
})();
