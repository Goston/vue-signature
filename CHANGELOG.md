# Changelog

## 2.7.0

- Resize automatically when hidden modals and delayed layouts become visible.
- Preserve stroke history across resize so undo and SVG stroke export keep working.
- Release input handlers, forwarded events, resize observers and pending image loads on destruction.
- Load saved SVG/PNG/JPEG images through an awaitable `fromDataURL(url, options)` API.
- Preserve imported backgrounds across resize and undo of newly drawn strokes.
- Cancel stale image loads after clear, destruction, or a newer import.
- Fix high-DPI sizing and pointer coordinates when the component has padding.
- Keep signature-pad instances independent through local canvas refs and idempotent initialization.
- Accept zero watermark coordinates and isolate watermark drawing styles.
- Remove global canvas styling that affected unrelated canvases.
- Publish a compiled CommonJS/UMD entry that can be imported without a DOM or a Vue SFC transform.
- Document percentage sizing, Retina bitmap dimensions, SVG imports and pen thickness options.
- Update the development build to Webpack 5 and Babel 7; remove unused Sass dependencies.

### Compatibility

- Runtime remains Vue 2. Building from source requires Node.js 18.12+ and npm.
- `clearOnResize` acts on actual size or pixel-ratio changes, not unchanged resize events.
- Imported images are background layers. Loading another image replaces that background;
  undo removes recorded pen strokes. PNG/JPEG exports include images and watermarks,
  while SVG export continues to contain recorded pen strokes only.
- Percentage height requires a measurable parent height. Without `ResizeObserver`,
  window resize remains supported and `draw()` can refresh a newly visible pad.
- Importing the package in Jest needs no SFC transform; mounting it still needs
  a DOM environment and Canvas support or a Canvas mock.
