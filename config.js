// Fill this in with the Client ID from your own Spotify app:
// https://developer.spotify.com/dashboard -> Create app
// Add this exact page's URL as a Redirect URI in that app's settings.
const SPOTIFY_CONFIG = {
  clientId: "YOUR_SPOTIFY_CLIENT_ID",
  redirectUri: window.location.origin + window.location.pathname,
  scopes: ["streaming", "user-read-email", "user-read-private", "user-modify-playback-state"],
};
