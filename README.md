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

The Vencord checkout and updater live in the separate private repo `vencord-installer`. Venchrome ships a hook that links `plugin/venchrome` into the checkout as `src/userplugins/venchrome`. Link it once into the installer's `hooks/` folder (see its `hooks/README.md`):

```powershell
New-Item -ItemType SymbolicLink -Path ..\vencord-installer\hooks\50-venchrome.mjs -Target ..\Venchrome\vencord-hook\50-venchrome.mjs
```

(Needs Developer Mode or an elevated shell. Otherwise copy the file and set `VENCHROME_DIR` to this repo.) Then rebuild and inject Vencord:

```powershell
& "..\vencord-installer\update-vencord.ps1"
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

## Custom rules via JSON

Options page → **Import / export JSON**: paste (or load) one rule or an array of rules, then **Import**. Each rule has **Copy JSON**; **Export all custom rules** copies them all. Import is all-or-nothing and never overwrites: an `id` already used (built-in preset or existing rule) is refused. Input is treated as data only; unknown keys are ignored.

Ready-made model: [`extension/examples/rule.example.json`](extension/examples/rule.example.json) (a test checks it stays valid). Fields:

| Key | Meaning |
|---|---|
| `id` | Unique, never a preset id. |
| `name` | Activity name shown on Discord. |
| `enabled` | `true`/`false` (default `true`). |
| `hosts` | Host names: `claude.ai` = host + subdomains; `anime-sama` (no dot) = any TLD; `gitlab*` = label prefix. |
| `activityType` | `0` Playing, `2` Listening, `3` Watching. |
| `logo` | Optional https image URL. |
| `fields` | Named values read from the page. `from`: `selector` (`selector`, optional `attr`), `meta` (`name`), `title` / `url` (`regex`, optional `group`, default 1), `mediaSession` (`key`: title, artist, album, artwork). |
| `domMedia` | Optional, for players with no `<audio>/<video>`: `pausedSelector` (element present = paused), `progressSelector`, `currentAttr` / `maxAttr` (attributes holding elapsed/total seconds). Used only when the page has no media element. |
| `pages` | Ordered; the first whose `path` (regex on pathname, optional) and `when` pass wins. |
| `pages[].when` | Conditions `{field, exists}` or `{field, matches}` (regex); all must pass. |
| `pages[].details/state/largeImage/largeText` | Templates: `{field}`, fallback `{a|b}`; built-ins `{url}`, `{host}`, `{title}`. |
| `pages[].button` | `{label, url}`; url must render to https. |
| `pages[].media` | `true` = use media state (timestamps, pause icon). |

Sentence to give an AI: *"Write a Venchrome rule as JSON following `extension/examples/rule.example.json` for <site>: show <what> on Discord. Output only the JSON, check the CSS selectors against the page's real HTML."*

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
