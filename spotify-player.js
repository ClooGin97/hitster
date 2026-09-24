// Wraps the Spotify Web Playback SDK: turns this browser tab into a Spotify
// Connect device so we can start/stop real playback. Requires a Premium account.
const SpotifyPlayer = (() => {
  "use strict";

  let player = null;
  let deviceId = null;
  let readyResolve, readyReject;
  const readyPromise = new Promise((res, rej) => {
    readyResolve = res;
    readyReject = rej;
  });

  function loadSdkScript() {
    return new Promise((resolve, reject) => {
      if (window.Spotify) return resolve();
      const script = document.createElement("script");
      script.src = "https://sdk.scdn.co/spotify-player.js";
      script.onerror = () => reject(new Error("Could not load the Spotify Web Playback SDK"));
      document.body.appendChild(script);
      window.onSpotifyWebPlaybackSDKReady = resolve;
    });
  }

  async function init() {
    await loadSdkScript();

    player = new Spotify.Player({
      name: "Hitster Online",
      getOAuthToken: (cb) => {
        SpotifyAuth.getValidAccessToken().then(cb).catch(() => cb(null));
      },
      volume: 0.9,
    });

    player.addListener("ready", ({ device_id }) => {
      deviceId = device_id;
      readyResolve();
    });
    player.addListener("not_ready", () => {
      deviceId = null;
    });
    player.addListener("initialization_error", ({ message }) => readyReject(new Error(message)));
    player.addListener("authentication_error", ({ message }) => readyReject(new Error(message)));
    player.addListener("account_error", () =>
      readyReject(new Error("This Spotify account can't stream here — Web playback requires Spotify Premium."))
    );

    const connected = await player.connect();
    if (!connected) throw new Error("Could not connect the Spotify player");

    return readyPromise;
  }

  async function apiRequest(path, options) {
    const token = await SpotifyAuth.getValidAccessToken();
    const res = await fetch("https://api.spotify.com/v1" + path, {
      ...options,
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
        ...(options && options.headers),
      },
    });
    if (!res.ok && res.status !== 204) {
      const body = await res.text();
      throw new Error("Spotify API error " + res.status + ": " + body);
    }
    return res.status === 204 ? null : res.json();
  }

  async function searchTrack(title, artist) {
    const q = encodeURIComponent('track:"' + title + '" artist:"' + artist + '"');
    const data = await apiRequest("/search?q=" + q + "&type=track&limit=1");
    let track = data.tracks && data.tracks.items && data.tracks.items[0];
    if (!track) {
      // Fall back to a looser, unquoted search if the exact match found nothing.
      const looseQ = encodeURIComponent(artist + " " + title);
      const looseData = await apiRequest("/search?q=" + looseQ + "&type=track&limit=1");
      track = looseData.tracks && looseData.tracks.items && looseData.tracks.items[0];
    }
    return track || null;
  }

  async function playTrackUri(uri) {
    if (!deviceId) throw new Error("Spotify player isn't ready yet");
    await apiRequest("/me/player/play?device_id=" + deviceId, {
      method: "PUT",
      body: JSON.stringify({ uris: [uri] }),
    });
  }

  function pause() {
    return player ? player.pause() : Promise.resolve();
  }

  function resume() {
    return player ? player.resume() : Promise.resolve();
  }

  function togglePlay() {
    return player ? player.togglePlay() : Promise.resolve();
  }

  function onStateChanged(handler) {
    if (player) player.addListener("player_state_changed", handler);
  }

  // Must be called synchronously inside a real click/tap handler (before any
  // await) — on mobile browsers this is what unlocks audio output for the
  // SDK's playback element. Calling /play afterwards via the Web API is
  // otherwise treated as unrequested autoplay and silently blocked.
  function activateElement() {
    if (player && typeof player.activateElement === "function") {
      player.activateElement();
    }
  }

  return { init, searchTrack, playTrackUri, pause, resume, togglePlay, onStateChanged, activateElement };
})();
