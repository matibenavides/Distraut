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

You can start editing the popup in `popup/index.tsx`. Plasmo recognizes this directory entry automatically. Its stylesheet and Ant Design theme live alongside it in `popup/popup.css` and `popup/theme.ts`. The YouTube content script is `content.ts`, with injected CSS in `styles/youtube.css`. After rebuilding content scripts, reload the extension and the YouTube page.

## Source layout

```text
popup/
  index.tsx       # Plasmo popup entry and React view
  popup.css       # Popup layout and surfaces
  theme.ts        # Ant Design tokens
content.ts        # Plain TypeScript entry for YouTube
styles/
  youtube.css     # Reversible hiding class injected into YouTube
lib/              # Validation, matching, storage and DOM adapters
types/            # Data contracts and CSS import declaration
tests/            # Logic and DOM fixtures
design/           # Visual direction and sketch brief
```

The popup directory is an official [Plasmo extension page convention](https://docs.plasmo.com/framework/ext-pages). Other folder names organize this project; Plasmo does not require them. Keep React and Ant Design imports inside the popup. Add components when an actual feature needs them.

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
