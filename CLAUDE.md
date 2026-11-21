# Nanda Town Trace Viewer

Single-page viewer for Nanda Town / NEST trace files (`.jsonl`), built for the HALHack pilot (Nov 20, 2026, Human oversight track).

## Layout
- `src/head.html` – markup and CSS
- `src/app.js` – all logic (parsing, metrics, sortable table, conversation thread, file picker / drag-drop)
- `src/sample.js` – built-in sample: the default `marketplace` run as `[from, to, message]` sends, signatures stripped
- `build.sh` – concatenates `src/` into `trace-viewer.html`. Edit `src/`, then run `./build.sh`. Never edit `trace-viewer.html` by hand.
- No dependencies or server: open `trace-viewer.html` in a browser.

## Trace format (from the default marketplace run)
- One JSON object per line. `kind` is `start`, `stop`, `send` or `receive`.
- `send`: `agent`, `to`, `corr`, `msg`, `size`, `ts`. `receive`: `agent`, `from`, `corr`, `msg`.
- `msg` is a string like `buy:product-6:12|sig:<hex>`. Types seen: `buy`, `sold`, `reject`.
- A send is delivered if a `receive` has the same `corr`; otherwise it counts as dropped.
- All `ts` values are 0, so file order is the timeline.
- A reply has its own `corr`, not the offer's. Replies are paired with offers in file order (next reply from that seller to that buyer). This pairs all 500 offers in the sample.
- In a `reject`, the number is NOT an asking price: each seller sends the same value in every rejection. The UI calls it "reply value".
- Sample run: 100 agents (50 buyers, 50 sellers), 500 offers, 266 deals, 234 rejections, 0 dropped, 467 unique pairs. These match the default `nest report`.

## Ideas not built yet
- Load a second trace (e.g. a run with injected faults) and compare it with the baseline.
- Test the Dropped column with a faulted run (`nandatown run --help` lists scenarios).
- Explain anomalies, e.g. seller-23 sold product-4 at 52 but rejected 60 from another buyer.
