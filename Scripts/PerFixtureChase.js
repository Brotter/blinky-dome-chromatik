/**
 * Per-fixture chase pattern.
 *
 * Reads the "maxChunks" metadata value from each fixture (top-level submodel
 * of the pattern's model) and runs an independent chase on that fixture with
 * that many chunks. Fixtures without a "maxChunks" meta value fall back to
 * the "Default Chunks" knob.
 *
 * To set the value on a fixture, add to its .lxf:
 *   "meta": { "maxChunks": 20 }
 *
 * Values are read as strings and parsed as int; anything non-parseable or
 * <= 0 falls back to the default.
 */

knob("speed",  "Speed",  "Chase cycles per second (0..2 Hz)", 0.3);
knob("size",   "Size",   "Head+tail width as fraction of one chunk", 0.5);
knob("fade",   "Fade",   "Tail softness (0 = hard edge, 1 = long soft tail)", 0.5);
knob("hue",    "Hue",    "Chase color hue", 0);
knob("sat",    "Sat",    "Chase color saturation", 1);
knob("bg",     "BG",     "Background brightness", 0);
knobi("defaultChunks", "Default Chunks", "Fallback chunks for fixtures with no maxChunks meta", 4, 64);
toggle("reverse", "Reverse", "Reverse chase direction", false);

var META_KEY = "maxChunks";
var phase = 0;   // 0..1, position of a head within its chunk

// Override the framework's default run() so we can dispatch per submodel
// instead of per point.
run = function(deltaMs, nowMillis, model, colors, enabledAmount) {
  // Advance phase. speed knob 0..1 -> 0..2 Hz cycles per chunk.
  var dphase = (reverse ? -1 : 1) * (speed * 2) * (deltaMs / 1000);
  phase = (phase + dphase) % 1;
  if (phase < 0) phase += 1;

  var hueDeg = hue * 360;
  var satPct = sat * 100;
  var bgLevel = bg * 100 * enabledAmount;

  // Background across every point first.
  var bgColor = hsb(hueDeg, satPct, bgLevel);
  for (var i = 0; i < model.points.length; ++i) {
    colors[model.points[i].index] = bgColor;
  }

  // Chase per fixture. model.children == top-level submodels == fixtures.
  var kids = model.children;
  for (var c = 0; c < kids.length; ++c) {
    renderFixture(kids[c], hueDeg, satPct, bgLevel, enabledAmount);
  }
};

function chunksFor(sub) {
  var v = sub.meta(META_KEY);
  if (v == null) return defaultChunks;
  var parsed = parseInt(v, 10);
  if (isNaN(parsed) || parsed <= 0) return defaultChunks;
  return parsed;
}

function renderFixture(sub, hueDeg, satPct, bgLevel, enabledAmount) {
  var pts = sub.points;
  var n = pts.length;
  if (n === 0) return;

  var chunks = chunksFor(sub);
  var duty = Math.max(0.02, size);            // pulse width, fraction of chunk
  var exp  = Math.max(0.05, (1 - fade) * 4 + 0.5); // tail sharpness

  for (var j = 0; j < n; ++j) {
    // d = distance behind nearest head, normalized to [0,1) chunk length.
    // 0 = at head, larger = further back in tail, >= duty = outside pulse.
    var d = (phase - j * chunks / n) % 1;
    if (d < 0) d += 1;
    if (d >= duty) continue;   // leave background from the pre-fill pass
    var frac = Math.pow(1 - d / duty, exp);
    var level = bgLevel + (100 - bgLevel) * frac * enabledAmount;
    colors[pts[j].index] = hsb(hueDeg, satPct, level);
  }
}
