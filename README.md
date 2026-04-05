# Archive Accelerator

A desktop application for macOS that significantly speeds up working with [web.archive.org](https://web.archive.org/) / the Wayback Machine.

Features include the ability to download and quickly review webpage snapshots, diff included text, view changes in SERP snippets (title and meta description), and — as a handy little SEO feature — view Google Search Console (GSC) KPIs for the URL over time, with markers indicating exactly which changes were made to the page and when.

## Development

1. Create a Google Cloud Console App for OAuth.
2. Copy `.env.example` to `.env` and add your credentials there.

```bash
npm install
npm run dev
```

## Build

```bash
npm run dist
```

## Copyright

Copyright (c) 2026 Daniel Abromeit (https://daniel-abromeit.de/)

Thank you to [KOCH ESSEN](https://koch-essen.de/) for providing the resources without which this project would not have been possible.

Released under the MIT License. [See LICENSE for details.](LICENSE)
