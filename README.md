# Venchrome

Shows what you do on chosen websites as a Discord Rich Presence: a Chrome extension (MV3) talks to a Vencord userplugin over a local WebSocket (`127.0.0.1:28463`). No subscription, no background app, no Discord token.

Built-in sites: YouTube, Twitch, GitHub, GitLab (including self-hosted `gitlab*` hosts), Deezer, SoundCloud, anime-sama, claude.ai.

Personal project, not published.

## Requirements

- Vencord **desktop**, built from source (userplugins do not work on Vencord web).
- Node.js + npm (extension), pnpm (Vencord).
- Chrome (or another Chromium browser) with developer mode.

## Install

### 1. Vencord plugin

`plugin/venchrome` is linked into the Vencord checkout as `src/userplugins/venchrome` (junction). Rebuild and inject Vencord:

```powershell
& "..\Vencord Installation\update-vencord.ps1"
```

Restart Discord, then in **Settings → Vencord → Plugins** enable **Venchrome**.

### 2. Discord application

The presence uses one Discord application (shown as the activity owner, assets `pause` and `play`).

- Use the existing app ID `1570214212830232656`, or create your own on the [Developer Portal](https://discord.com/developers/applications) and upload `assets/pause.png` and `assets/play.png` as Rich Presence art assets with the keys `pause` and `play`.
- Paste the ID into the plugin setting **appId**.

### 3. Chrome extension

```powershell
cd extension
npm install
npm run build
```

Open `chrome://extensions`, enable **Developer mode**, **Load unpacked** → `extension/dist`.

After each rebuild: click reload on the extension card, then reload the open tabs of tracked sites.

## Usage

- The popup shows the connection state and the current presence, and has a global on/off switch.
- One tab drives the presence: a tab playing media wins, otherwise the last focused tracked tab.
- Leaving a site (closing or navigating the tab) keeps its presence 30–60 s unless another tab takes over. Closing Chrome clears it at once.
- Private content stays generic by default (private repos, claude.ai conversations).
- Updates are throttled to one every 5 s.

## Add a site

Open the extension **options** page → add a rule. No rebuild needed.

- **Hosts**: `claude.ai` matches that host and its subdomains; `anime-sama` (no dot) matches that name on any TLD; `gitlab*` matches any host label starting with `gitlab`.
- **Fields** read values from the page (CSS selector, meta tag, URL regex, title, media session); **pages** pick a text template per URL path and conditions, e.g. `{title} — {artist}`.
- The live preview evaluates the rule on the current tab.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Popup says disconnected | Discord not running or plugin disabled; the extension retries every 5 s while a tracked site is open (else ~30 s). |
| Nothing on the profile | Check the plugin **appId**; check the site has an enabled rule; wait 5 s. |
| `Failed to fetch dynamically imported module` in a page console | The extension was rebuilt: reload it, then reload the tab. |
| Another activity hides yours | Close other presence tools (PreMiD…) and restart Discord. |
| A timer shows while paused | Discord adds its own timer when no timestamps are sent; it cannot be hidden. |
| Plugin gone after a Vencord update | Run `update-vencord.ps1` again. |

## Development

```powershell
cd extension
npm test        # vitest: extension/tests + plugin/tests
npm run build   # tsc + MV3 build to extension/dist
```

`node Tools/fake-client.mjs activity|clear` sends a test presence to the plugin without the extension.
