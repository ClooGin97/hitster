(function () {
  "use strict";

  const loginScreen = document.getElementById("loginScreen");
  const deckScreen = document.getElementById("deckScreen");
  const loginBtn = document.getElementById("loginBtn");
  const loginStatus = document.getElementById("loginStatus");
  const logoutBtn = document.getElementById("logoutBtn");

  const deckCard = document.getElementById("deckCard");
  const deckCountEl = document.getElementById("deckCount");
  const playPauseBtn = document.getElementById("playPauseBtn");
  const guessForm = document.getElementById("guessForm");
  const yearInput = document.getElementById("yearInput");
  const nextBtn = document.getElementById("nextBtn");
  const restartBtn = document.getElementById("restartBtn");
  const statusEl = document.getElementById("status");
  const progressWrap = document.getElementById("progressWrap");
  const progressFill = document.getElementById("progressFill");

  const TRACK_MS = 30000;

  let deck = [];
  let current = null; // { song, track }
  let state = "idle"; // idle -> loading -> playing -> revealed
  let isPlaying = false;

  let progressInterval = null;
  let autoStopTimer = null;
  let elapsedMs = 0;
  let segmentStart = null;

  // ---------- Screen switching ----------

  function showLogin(message) {
    loginScreen.hidden = false;
    deckScreen.hidden = true;
    loginStatus.textContent = message || "";
  }

  function showDeck() {
    loginScreen.hidden = true;
    deckScreen.hidden = false;
  }

  // ---------- Deck / game flow ----------

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
    stopPlayback();
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
    guessForm.hidden = true;
    yearInput.value = "";
    nextBtn.hidden = true;
    progressWrap.hidden = true;
    progressFill.style.width = "0%";
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
    current = { song, track: null };

    deckCard.className = "card back-card loading";
    const hint = deckCard.querySelector(".card-hint");
    if (hint) hint.textContent = "Loading…";
    setStatus("Finding the track on Spotify…");

    try {
      const track = await SpotifyPlayer.searchTrack(song.title, song.artist);
      if (!track) {
        setStatus("Couldn't find this track on Spotify — revealing it so play can continue.");
        showRevealed();
        return;
      }
      current.track = track;

      await SpotifyPlayer.playTrackUri(track.uri);
      isPlaying = true;
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
      guessForm.hidden = false;
      yearInput.value = "";
      progressWrap.hidden = false;
      startPlaybackTimers();
      yearInput.focus();
    } catch (err) {
      setStatus("Couldn't play this track (" + err.message + "). Revealing card instead.");
      showRevealed();
    }
  }

  async function togglePlayPause() {
    if (state !== "playing" || !current || !current.track) return;
    try {
      if (isPlaying) {
        await SpotifyPlayer.pause();
        isPlaying = false;
        deckCard.classList.remove("playing");
        setPlayPauseLabel(false);
        pausePlaybackTimers();
      } else {
        await SpotifyPlayer.resume();
        isPlaying = true;
        deckCard.classList.add("playing");
        setPlayPauseLabel(true);
        resumePlaybackTimers();
      }
    } catch (err) {
      setStatus("Playback error: " + err.message);
    }
  }

  function setPlayPauseLabel(playing) {
    playPauseBtn.innerHTML = playing
      ? '<span class="icon icon-pause"></span>Pause'
      : '<span class="icon icon-play"></span>Play';
  }

  function showRevealed(timedOut) {
    stopPlayback();
    state = "revealed";
    const song = current.song;

    const rawGuess = yearInput.value.trim();
    const guess = rawGuess === "" ? null : parseInt(rawGuess, 10);
    // A guess typed but never submitted before time ran out doesn't count.
    const hasGuess = !timedOut && guess !== null && Number.isFinite(guess);
    const correct = hasGuess && guess === song.year;

    let verdictHtml = "";
    let verdictClass = "";
    if (timedOut) {
      verdictHtml = '<div class="verdict timeout">⏰ Too late!</div>';
    } else if (hasGuess) {
      verdictHtml = correct
        ? '<div class="verdict correct">✔ Correct!</div>'
        : '<div class="verdict wrong">✘ Not quite</div>';
      verdictClass = correct ? " correct" : " wrong";
    }
    const guessLineHtml = hasGuess
      ? '<div class="reveal-guess">Your guess: ' + guess + (correct ? "" : " · off by " + Math.abs(guess - song.year) + (Math.abs(guess - song.year) === 1 ? " year" : " years")) + "</div>"
      : "";

    deckCard.className = "card revealed" + verdictClass;
    deckCard.innerHTML =
      '<div class="card-inner">' +
      verdictHtml +
      '<div class="reveal-year">' + song.year + "</div>" +
      '<div class="reveal-title">' + escapeHtml(song.title) + "</div>" +
      '<div class="reveal-artist">' + escapeHtml(song.artist) + "</div>" +
      guessLineHtml +
      "</div>";
    playPauseBtn.hidden = true;
    guessForm.hidden = true;
    progressWrap.hidden = true;
    nextBtn.hidden = false;
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  // ---------- Playback timers (30s cap + progress bar) ----------

  function tickProgress() {
    const elapsed = elapsedMs + (segmentStart ? Date.now() - segmentStart : 0);
    progressFill.style.width = Math.min(elapsed / TRACK_MS, 1) * 100 + "%";
  }

  function startPlaybackTimers() {
    elapsedMs = 0;
    segmentStart = Date.now();
    clearInterval(progressInterval);
    progressInterval = setInterval(tickProgress, 200);
    scheduleAutoStop(TRACK_MS);
  }

  function pausePlaybackTimers() {
    if (segmentStart) {
      elapsedMs += Date.now() - segmentStart;
      segmentStart = null;
    }
    clearInterval(progressInterval);
    clearTimeout(autoStopTimer);
  }

  function resumePlaybackTimers() {
    segmentStart = Date.now();
    clearInterval(progressInterval);
    progressInterval = setInterval(tickProgress, 200);
    scheduleAutoStop(TRACK_MS - elapsedMs);
  }

  function scheduleAutoStop(ms) {
    clearTimeout(autoStopTimer);
    autoStopTimer = setTimeout(() => {
      // Time's up: turn the card over automatically, whether or not a guess was entered.
      if (state === "playing") showRevealed(true);
    }, Math.max(ms, 0));
  }

  function stopPlaybackTimers() {
    clearInterval(progressInterval);
    clearTimeout(autoStopTimer);
    segmentStart = null;
    elapsedMs = 0;
  }

  function stopPlayback() {
    stopPlaybackTimers();
    if (isPlaying) {
      isPlaying = false;
      SpotifyPlayer.pause().catch(() => {});
    }
  }

  // ---------- Wiring ----------

  deckCard.addEventListener("click", () => {
    if (state === "idle") drawCard();
  });
  playPauseBtn.addEventListener("click", togglePlayPause);
  guessForm.addEventListener("submit", (e) => {
    e.preventDefault();
    if (state === "playing") showRevealed();
  });
  nextBtn.addEventListener("click", resetCardToBack);
  restartBtn.addEventListener("click", newGame);

  loginBtn.addEventListener("click", () => {
    loginStatus.textContent = "Redirecting to Spotify…";
    SpotifyAuth.login().catch((err) => showLogin(err.message));
  });
  logoutBtn.addEventListener("click", () => {
    SpotifyAuth.logout();
    window.location.reload();
  });

  // ---------- Boot ----------

  async function main() {
    try {
      await SpotifyAuth.handleRedirect();
    } catch (err) {
      showLogin(err.message);
      return;
    }

    if (!SpotifyAuth.isLoggedIn()) {
      showLogin("");
      return;
    }

    showLogin("Connecting to Spotify…");
    try {
      await SpotifyPlayer.init();
    } catch (err) {
      SpotifyAuth.logout();
      showLogin(err.message);
      return;
    }

    showDeck();
    newGame();
  }

  main();
})();
