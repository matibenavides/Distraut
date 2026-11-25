# Distraut

Extensión de Chrome para reducir distracciones en YouTube

This is a [Plasmo extension](https://docs.plasmo.com/) project bootstrapped with [`plasmo init`](https://www.npmjs.com/package/plasmo).

## Getting Started

First, run the development server:

```bash
pnpm dev
# or
npm run dev
```

Open your browser and load the appropriate development build. For example, if you are developing for the chrome browser, using manifest v3, use: `build/chrome-mv3-dev`.

You can start editing the popup in `popup/index.tsx`. Plasmo recognizes this directory entry automatically. `popup/popup.css` loads shared styles and the styles beside each feature's components; `popup/theme.ts` defines the Ant Design theme. The YouTube content script is `content.ts`, with injected CSS in `styles/youtube.css`. After rebuilding content scripts, reload the extension and the YouTube page.

## Source layout

```text
popup/
  index.tsx       # Plasmo entry, state and view coordination
  popup.css       # Ordered CSS imports
  theme.ts        # Ant Design tokens
  types.ts        # Shared popup contracts (Save callback)
  styles/
    base.css      # Typography, controls and shared utilities
    layout.css    # Popup shell, switches and collections
  components/
    filters/      # AddFilter, RuleLibrary and filters.css
    study-session/ # StudySession and study-session.css
    statistics/   # StatisticsPanel and statistics.css
content.ts        # Plain TypeScript entry for YouTube
styles/
  youtube.css     # Reversible hiding class injected into YouTube
lib/              # Validation, matching, storage and DOM adapters
types/            # Data contracts and CSS import declaration
tests/            # Logic and DOM fixtures
design/           # Visual direction and sketch brief
```

The popup directory is an official [Plasmo extension page convention](https://docs.plasmo.com/framework/ext-pages). Other folder names organize this project; Plasmo does not require them. Keep React and Ant Design imports inside the popup. Add components when an actual feature needs them.

Keep feature-specific styles beside their components. Shared foundations belong in `popup/styles/base.css`; styles for views still owned by the entry belong in `popup/styles/layout.css`. Import CSS only through `popup/popup.css`, in the order base → layout → features, so the global cascade stays explicit. Components receive the `Save` callback through props and import its type from `popup/types.ts`, without depending on the popup entry.

For further guidance, [visit our Documentation](https://docs.plasmo.com/)

## Making production build

Run the following:

```bash
pnpm build
# or
npm run build
```

This should create a production bundle for your extension, ready to be zipped and published to the stores.

## Submit to the webstores

The easiest way to deploy your Plasmo extension is to use the built-in [bpp](https://bpp.browser.market) GitHub action. Prior to using this action however, make sure to build your extension and upload the first version to the store to establish the basic credentials. Then, simply follow [this setup instruction](https://docs.plasmo.com/framework/workflows/submit) and you should be on your way for automated submission!
