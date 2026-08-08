![Autobing icon](img/icon128.png)
# Autobing

Automate Bing search sessions from a lightweight Chrome popup.

## Highlights

Autobing builds varied Bing queries, runs them in the active tab, and keeps the session visible with live progress and statistics.

## Features

- **Automated search sessions**: Run a fixed batch or use Endless Mode for continuous searching.
- **Flexible search modes**: Configure desktop, mobile, or combined desktop/mobile sessions.
- **Natural query generation**: Combines descriptors, categories, and extra details into varied queries without repeating combinations during a pool cycle.
- **Configurable timing**: Set minimum and maximum delays between searches in milliseconds.
- **Visit Results**: Optionally opens one random result from the top five after every five searches, keeps the visit tab branded, and closes it after a short delay.
- **Eco Mode**: Temporarily hides heavy Bing result-page content while a session runs to reduce page overhead. It is scoped to the active search tab.
- **Target-tab isolation**: Search automation, Eco Mode, favicon changes, and tab-title changes stay scoped to the session's target tab.
- **Live session feedback**: Track elapsed time, search count, percentage, progress, query-pool statistics, and Endless Mode state.
- **Editable word banks**: Customize descriptors, categories, and extra details from Settings with saved preferences.
- **Light and dark themes**: Switch themes from the popup footer.
- **Restorable settings**: Restore the default word banks, timing values, and saved preferences from Settings.

## Install

1. Clone the repo:

   ```bash
   git clone https://github.com/fastdemo/autobing.git
   ```

2. Open `chrome://extensions/`.
3. Turn on Developer mode.
4. Click Load unpacked.
5. Select the extension folder.

## Usage

1. Click the Autobing icon in the toolbar.
2. Choose a search mode and set the search count, or enable Endless Mode.
3. Set the minimum and maximum delay in milliseconds.
4. Optionally enable Eco Mode or Visit Results in Settings.
5. Click Start and keep the target Bing tab open while the session runs.
6. Use the gear icon to edit word banks and view session statistics.

## Settings

Settings are grouped into three areas:

- **General**: Eco Mode and Visit Results.
- **Search Queries**: Descriptors, Categories, and Extras.
- **Statistics**: Current searches, available combinations, and pool usage.

Preferences are stored locally by the extension and can be restored from the Settings view.

## License

MIT. See [LICENSE](LICENSE).

## Disclaimer

Not affiliated with Microsoft or the Microsoft Rewards program. Use it responsibly and in line with Microsoft's terms of service.

## Credits

- **Iago** - a Japanese learning app. The mascot's art style references Shion Yorigami (from Touhou Project).

This is an open-source project with no commercial intent. If you are uncomfortable with any asset usage, reach out and it will be taken down.

Made with love by **@fastdemo** <3
