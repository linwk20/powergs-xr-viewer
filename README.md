# PowerGS XR Viewer

Standalone XR Blocks video viewer for the four PowerGS demo videos.

## Contents

- `index.html`: static entry page
- `main.js`: XR Blocks viewer logic
- `assets/`: local MP4 files used by the viewer

## Local Run

Serve the repository as a static site, for example:

```powershell
python -m http.server 8123 --bind 127.0.0.1
```

Then open:

```text
http://127.0.0.1:8123/
```

## Deployment

This project is a plain static website. It does not require a build step.
You can deploy it with GitHub Pages or any static hosting provider.
