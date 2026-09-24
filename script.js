(function () {
  "use strict";

  const deckCard = document.getElementById("deckCard");
  const deckCountEl = document.getElementById("deckCount");
  const playPauseBtn = document.getElementById("playPauseBtn");
  const revealBtn = document.getElementById("revealBtn");
  const nextBtn = document.getElementById("nextBtn");
  const restartBtn = document.getElementById("restartBtn");
  const statusEl = document.getElementById("status");
  const progressWrap = document.getElementById("progressWrap");
  const progressFill = document.getElementById("progressFill");

  let deck = [];
  let current = null; // { song, previewUrl }
  let audio = null;
  let state = "idle"; // idle -> loading -> playing/paused -> revealed
  let jsonpCounter = 0;

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function newGame() {
    deck = shuffle(SONGS);
    updateDeckCount();
    resetCardToBack();
    setStatus("");
    restartBtn.hidden = true;
  }

  function updateDeckCount() {
    deckCountEl.textContent = deck.length;
  }

  function setStatus(msg) {
    statusEl.textContent = msg;
  }

  function resetCardToBack() {
    stopAudio();
    current = null;
    state = "idle";
    deckCard.className = "card back-card";
    deckCard.innerHTML =
      '<div class="card-inner">' +
      '<div class="disc"></div>' +
      '<div class="card-brand">HITSTER</div>' +
      '<div class="card-hint">Click to draw &amp; play</div>' +
      "</div>";
    playPauseBtn.hidden = true;
    revealBtn.hidden = true;
    nextBtn.hidden = true;
    progressWrap.hidden = true;
    progressFill.style.width = "0%";
  }

  function jsonp(url) {
    return new Promise((resolve, reject) => {
      const cbName = "hitsterCb" + Date.now() + jsonpCounter++;
      const script = document.createElement("script");
      let done = false;

      const cleanup = () => {
        delete window[cbName];
        if (script.parentNode) script.parentNode.removeChild(script);
      };

      window[cbName] = (data) => {
        done = true;
        cleanup();
        resolve(data);
      };

      script.src = url + (url.includes("?") ? "&" : "?") + "callback=" + cbName;
      script.onerror = () => {
        if (!done) {
          cleanup();
          reject(new Error("Network error contacting iTunes"));
        }
      };
      document.body.appendChild(script);

      setTimeout(() => {
        if (!done) {
          cleanup();
          reject(new Error("Lookup timed out"));
        }
      }, 8000);
    });
  }

  async function fetchPreview(song) {
    const term = encodeURIComponent(song.artist + " " + song.title);
    const url = "https://itunes.apple.com/search?term=" + term + "&entity=song&limit=5&country=US";
    const data = await jsonp(url);
    if (!data || !data.results || !data.results.length) return null;
    const withPreview = data.results.find((r) => r.previewUrl);
    return withPreview ? withPreview.previewUrl : null;
  }

  function stopAudio() {
    if (audio) {
      audio.pause();
      audio.removeAttribute("src");
      audio = null;
    }
  }

  async function drawCard() {
    if (state !== "idle") return;
    if (deck.length === 0) {
      setStatus("That's the whole deck! Reshuffle to keep playing.");
      restartBtn.hidden = false;
      return;
    }

    state = "loading";
    const song = deck.pop();
    updateDeckCount();
    current = { song, previewUrl: null };

    deckCard.className = "card back-card loading";
    deckCard.querySelector(".card-hint") &&
      (deckCard.querySelector(".card-hint").textContent = "Loading…");
    setStatus("Finding the track…");

    try {
      const previewUrl = await fetchPreview(song);
      current.previewUrl = previewUrl;

      if (!previewUrl) {
        setStatus("No preview found for this track — revealing it so play can continue.");
        showRevealed();
        return;
      }

      audio = new Audio(previewUrl);
      audio.addEventListener("timeupdate", updateProgress);
      audio.addEventListener("ended", () => {
        deckCard.classList.remove("playing");
        setPlayPauseLabel(false);
      });

      await audio.play();
      state = "playing";
      setStatus("");
      deckCard.className = "card playing";
      deckCard.innerHTML =
        '<div class="card-inner">' +
        '<div class="disc"></div>' +
        '<div class="card-brand">?</div>' +
        '<div class="card-hint">Guess the year!</div>' +
        "</div>";

      playPauseBtn.hidden = false;
      setPlayPauseLabel(true);
      revealBtn.hidden = false;
      progressWrap.hidden = false;
    } catch (err) {
      setStatus("Couldn't load audio (" + err.message + "). Revealing card instead.");
      showRevealed();
    }
  }

  function updateProgress() {
    if (!audio || !audio.duration) return;
    const pct = (audio.currentTime / audio.duration) * 100;
    progressFill.style.width = pct + "%";
  }

  function togglePlayPause() {
    if (!audio) return;
    if (audio.paused) {
      audio.play();
      deckCard.classList.add("playing");
      setPlayPauseLabel(true);
    } else {
      audio.pause();
      deckCard.classList.remove("playing");
      setPlayPauseLabel(false);
    }
  }

  function setPlayPauseLabel(isPlaying) {
    playPauseBtn.innerHTML = isPlaying
      ? '<span class="icon icon-pause"></span>Pause'
      : '<span class="icon icon-play"></span>Play';
  }

  function showRevealed() {
    stopAudio();
    state = "revealed";
    const song = current.song;
    deckCard.className = "card revealed";
    deckCard.innerHTML =
      '<div class="card-inner">' +
      '<div class="reveal-year">' + song.year + "</div>" +
      '<div class="reveal-title">' + escapeHtml(song.title) + "</div>" +
      '<div class="reveal-artist">' + escapeHtml(song.artist) + "</div>" +
      "</div>";
    playPauseBtn.hidden = true;
    revealBtn.hidden = true;
    progressWrap.hidden = true;
    nextBtn.hidden = false;
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function handleDeckClick() {
    if (state === "idle") {
      drawCard();
    }
  }

  deckCard.addEventListener("click", handleDeckClick);
  playPauseBtn.addEventListener("click", togglePlayPause);
  revealBtn.addEventListener("click", showRevealed);
  nextBtn.addEventListener("click", resetCardToBack);
  restartBtn.addEventListener("click", newGame);

  newGame();
})();
