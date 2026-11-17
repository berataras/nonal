# nonal

A local player that opens one unfamiliar YouTube video at a time.

nonal is a small Next.js app for leaving the recommendation feed. Each step picks a public video from a random week, inside a view-count band, and plays it in a single frame. Distance from the video on screen is a choice: same topic, a neighboring topic, or somewhere further away.

The YouTube Data API key stays on the server. Discovered videos are cached on disk and are not part of the git history.

## Features

- One video on screen. **R**, or the end of the current video, loads the next one.
- Three distances: **Aynı tarz**, **Yakın**, and **Uzak**. Changing the distance or the language applies to the next pick.
- Language filter: Turkish, English, or all. Turkish and English keep videos that declare `defaultAudioLanguage`. Videos with no language stay only when **Hepsi** is selected.
- The player starts muted. A control outside the frame turns sound on.
- A local catalog, so a later visit can play from videos already found before spending more API quota.
- Channel exclusion list for channels you already know.

The interface is in Turkish.

## Requirements

- Node.js 20 or newer
- A [YouTube Data API v3](https://developers.google.com/youtube/v3) key, restricted to that API

`search.list` costs 100 quota units. The default daily quota is 10,000 units, about 100 searches. nonal searches only when fewer than five unseen videos remain for the chosen topic and language.

## Getting started

```bash
git clone https://github.com/berataras/nonal.git
cd nonal
npm install
```

Create `.env.local` in the project root:

```bash
YOUTUBE_API_KEY=your_key
```

`.env.example` lists the variable name. Restart the dev server after changing the file.

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Production:

```bash
npm run build
npm run start
```

## Usage

| Control | Effect |
| --- | --- |
| **Aynı tarz** | Next video stays on the current topic. With nothing playing, it uses one of your home topics. |
| **Yakın** | Next video comes from a neighboring topic. |
| **Uzak** | Next video leaves the current topic and its neighbors. With nothing playing, it also stays outside your home topics and their neighbors. |
| **TR / EN / Hepsi** | Limits the pool by spoken language. |
| **Ses / Sessiz** | Unmutes or mutes the current player. |
| **R** | Loads the next video. Ignored while a select is focused, and while Ctrl, Alt, or Command is held. |

The selected distance and language are stored in `localStorage`. On a first visit the distance is **Uzak** and the language is **Hepsi**.

The title and channel name sit under the video. The channel name links to the channel on YouTube.

## Configuration

Two files are read on every request.

### `data/compass.json`

Home topics. The shipped set is `bilim`, `tarih`, and `sanat`. Replace it with the topics you treat as the center. A larger center leaves **Uzak** fewer places to go when nothing is playing.

Allowed topic ids:

`bilim`, `teknoloji`, `tarih`, `felsefe`, `sanat`, `müzik`, `sinema`, `doğa`, `psikoloji`, `yemek`

Neighboring topics and the search phrases for each topic live in `lib/topics.ts`.

### `data/known-channels.json`

Channel ids to leave out, each starting with `UC`. A Google Takeout `subscriptions.csv` is a practical source. An empty list keeps every channel that passes the other filters.

### Discovery limits

`lib/config.ts` holds the numbers used while filling the catalog:

| Limit | Default |
| --- | --- |
| Views | 2,000–300,000 |
| Duration | at least 4 minutes |
| Search window | a random 7 days, from the start of 2008 through one month ago |
| Results per search | 25 |
| Refill threshold | 5 unseen videos for that topic and language |
| Attempts when a week returns nothing | 3 |

Live streams are dropped. So are videos already in the catalog.

### `data/catalog.json`

Created on first use. Each record stores the video id, title, channel, topic, language, publish time, view count, and whether it has been played. The file is gitignored. Deleting it starts the pool over. Played videos are not selected again.

## Project layout

```text
app/page.tsx            player and controls
app/api/next/route.ts   next-video endpoint
lib/pool.ts             catalog selection and refill
lib/youtube.ts          Data API search and filters
lib/topics.ts           topics, neighbors, and queries
lib/config.ts           numeric limits
data/compass.json       home topics
data/known-channels.json
```

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |

## License

[MIT](LICENSE). Copyright (c) 2026 Berat.

The license covers this application's source code. YouTube videos, channel content, and API keys remain subject to Google's terms.
