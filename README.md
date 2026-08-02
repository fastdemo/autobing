![Autobing icon](img/icon128.png)
# Autobing

Automating your Bing searches so you don't have to!

## What It Does

Autobing is a polished Chrome extension that runs natural, human-like Bing searches for you. Set a search count, pick a delay range, hit Start, and let the extension handle the rest while you go about your day.

## Features

### Automated Search Workflows

- Runs a configurable number of desktop searches per session.
- Random delays between searches keep the rhythm natural and varied.
- Live progress bar tracks each run from start to finish.
- Runs continue even when the popup is closed.

### Dynamic Query Building

- Queries are constructed from a smart 3-part template: **Mood Descriptors**, **Categories**, and **Extra Details**.
- Words combine at random to build natural, human-like phrases such as "best coffee shops near me".
- Strict session deduplication guarantees no query is ever repeated during an active run.

### Customizable Word Banks

- An inline **Settings** panel lets you view and edit all three word banks.
- Each bank ships with 50 curated default phrases, ready to use out of the box.
- Edits auto-save in real time to `chrome.storage.local` and apply to the very next run.

### Automated GitHub Redirect

- When the final search delay finishes completely, Autobing opens your GitHub profile automatically.
- The redirect fires exactly once per run and never triggers on a manual stop.

### Theme Integration

- Dual **Dark** and **Light** modes with a custom Shion Yorigami-inspired palette.
- Smooth animated hover states on the header icon and title.
- Ultra-thin, hover-only scrollbars that appear only when you need them.
- An animated footer with a hover-reveal version tag.

## Install

1. Download or clone this repo:

   ```bash
   git clone https://github.com/fastdemo/autobing.git
   ```

2. Open `chrome://extensions/`.
3. Turn on **Developer mode**.
4. Click **Load unpacked**.
5. Select the extension folder.

## Usage

1. Click the Autobing icon in the toolbar.
2. Set how many searches you want to run.
3. Set the min and max delay in milliseconds.
4. Click **Start**.
5. Open the Settings panel (gear icon) anytime to customize the word banks.

## License

MIT. See [LICENSE](LICENSE).

## Disclaimer

Not affiliated with Microsoft or the Microsoft Rewards program. Use it in line with Microsoft Rewards terms of service.

## Credits

- **Iago** - a Japanese learning app. The mascot's art style references Shion Yorigami (from Touhou Project).

This is an open-source project with no commercial intent. If you are uncomfortable with any asset usage, reach out and it will be taken down.

Made with love by **@fastdemo** <3
