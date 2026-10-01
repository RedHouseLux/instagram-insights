// SVG chart primitives and line icons for the dashboard. Deliberately dependency-free: a CDN <script> would
// mean the browser announcing to a third party every time this page is opened, which is a strange trade for a
// tool whose whole claim is that nothing leaves your own Google account. Everything here is a few hundred
// lines of path arithmetic, and it inherits the page's CSS variables, which a canvas library could not.
//
// Every shape takes its colour from `currentColor` or an explicit CSS custom property, so light and dark mode
// are handled by the same tokens the rest of the page uses — no second palette, no theme-switching code here.
var CH = (function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';

  function n(tag, attrs, kids) {
    var node = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'text') node.textContent = attrs[k];
      else node.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { node.appendChild(c); });
    return node;
  }

  /** A root <svg> that scales to its container and keeps its aspect ratio. */
  function root(vbW, vbH, cls) {
    return n('svg', {
      viewBox: '0 0 ' + vbW + ' ' + vbH,
      class: 'ch ' + (cls || ''),
      preserveAspectRatio: 'xMidYMid meet',
      role: 'img',
    });
  }

  /** Splits a long axis label into at most two lines, so radar labels never overrun the viewBox. */
  function wrap(label, per) {
    var words = String(label).split(/\s+/);
    var lines = [''];
    words.forEach(function (w) {
      var line = lines[lines.length - 1];
      if (!line) lines[lines.length - 1] = w;
      else if ((line + ' ' + w).length <= per) lines[lines.length - 1] = line + ' ' + w;
      else lines.push(w);
    });
    return lines.slice(0, 2);
  }

  // ── Radar ────────────────────────────────────────────────────────────────────────────────────────────
  // Honest only when every axis shares one scale, which is why it is used for the 0–100 proxies and nothing
  // else. Rings are labelled so the reader can tell 40 from 80 without counting, and each vertex carries a
  // dot — a bare polygon makes it too easy to misread where an axis actually lands.
  function radar(axes, opts) {
    opts = opts || {};
    var max = opts.max || 100;
    // Wide enough for the longest axis label to sit outside the polygon without leaving the viewBox:
    // "Conscientiousness" is one unbreakable 17-character word, and at 9.5px it needs ~81px of run-out
    // from the right-hand vertex. Sizing to the text rather than to the shape is what stops it clipping.
    var W = 380, H = 290, cx = 190, cy = 142, r = 92;
    var svg = root(W, H, 'ch-radar');
    var count = axes.length;
    var angle = function (i) { return (Math.PI * 2 * i) / count - Math.PI / 2; };
    var at = function (i, frac) {
      return [cx + Math.cos(angle(i)) * r * frac, cy + Math.sin(angle(i)) * r * frac];
    };

    [0.25, 0.5, 0.75, 1].forEach(function (frac) {
      var pts = axes.map(function (_, i) { return at(i, frac).join(','); }).join(' ');
      svg.appendChild(n('polygon', { points: pts, class: 'ch-ring' }));
    });
    // Ticks sit on the due-left radius, not the vertical: an axis always starts at the top, so a tick placed
    // there lands underneath the first axis label and its value — "Openness 86" with "100" printed through it.
    // Due left is free for both the 5- and 6-axis cases (no vertex falls at 180°), which is why it is used.
    [0.5, 1].forEach(function (frac) {
      svg.appendChild(n('text', {
        x: cx - r * frac, y: cy + 3, class: 'ch-tick', 'text-anchor': 'middle',
        text: String(Math.round(max * frac)),
      }));
    });

    axes.forEach(function (_, i) {
      var p = at(i, 1);
      svg.appendChild(n('line', { x1: cx, y1: cy, x2: p[0], y2: p[1], class: 'ch-spoke' }));
    });

    var poly = axes.map(function (a, i) { return at(i, Math.max(0, Math.min(1, a.value / max))).join(','); }).join(' ');
    svg.appendChild(n('polygon', { points: poly, class: 'ch-area' }));
    axes.forEach(function (a, i) {
      var p = at(i, Math.max(0, Math.min(1, a.value / max)));
      svg.appendChild(n('circle', { cx: p[0], cy: p[1], r: 3.5, class: 'ch-dot' }));
    });

    axes.forEach(function (a, i) {
      var p = at(i, 1.17);
      var ang = angle(i);
      var anchor = Math.abs(Math.cos(ang)) < 0.3 ? 'middle' : (Math.cos(ang) > 0 ? 'start' : 'end');
      var lines = wrap(a.label, 13);
      var t = n('text', { x: p[0], y: p[1] - (lines.length - 1) * 5, class: 'ch-axis', 'text-anchor': anchor });
      lines.forEach(function (line, k) {
        t.appendChild(n('tspan', { x: p[0], dy: k ? 11 : 0, text: line }));
      });
      t.appendChild(n('tspan', { x: p[0], dy: 12, class: 'ch-axis-v', text: String(Math.round(a.value)) }));
      svg.appendChild(t);
    });
    return svg;
  }

  // ── Risk matrix ──────────────────────────────────────────────────────────────────────────────────────
  // Likelihood × impact, both 1–5, so position carries the meaning that a bar chart of scores throws away:
  // 5×1 and 1×5 share a score of 5 and are completely different problems. Several risks routinely land in the
  // same cell, so a cell holds their codes rather than one dot hiding four others.
  function matrix(cells, opts) {
    opts = opts || {};
    var W = 330, H = 300, pad = 42, size = (W - pad - 14) / 5;
    var svg = root(W, H, 'ch-matrix');
    var band = function (score) {
      return score >= 15 ? 'critical' : score >= 10 ? 'high' : score >= 5 ? 'medium' : 'low';
    };
    for (var L = 1; L <= 5; L++) {
      for (var I = 1; I <= 5; I++) {
        var x = pad + (L - 1) * size;
        var y = pad + (5 - I) * size;
        svg.appendChild(n('rect', {
          x: x, y: y, width: size - 2, height: size - 2, rx: 3,
          class: 'ch-cell ch-cell-' + band(L * I),
        }));
      }
    }
    cells.forEach(function (c) {
      var x = pad + (c.likelihood - 1) * size;
      var y = pad + (5 - c.impact) * size;
      var codes = c.codes;
      var perRow = codes.length > 2 ? 2 : codes.length;
      codes.forEach(function (code, k) {
        var col = k % perRow, row = Math.floor(k / perRow);
        var rows = Math.ceil(codes.length / perRow);
        svg.appendChild(n('text', {
          x: x + (size - 2) * (col + 0.5) / perRow,
          y: y + (size - 2) * (row + 0.5) / rows + 4,
          class: 'ch-code', 'text-anchor': 'middle', text: code,
        }));
      });
    });
    for (var t = 1; t <= 5; t++) {
      svg.appendChild(n('text', { x: pad + (t - 0.5) * size - 1, y: H - 20, class: 'ch-tick', 'text-anchor': 'middle', text: String(t) }));
      svg.appendChild(n('text', { x: pad - 8, y: pad + (5 - t) * size + size / 2, class: 'ch-tick', 'text-anchor': 'end', text: String(t) }));
    }
    svg.appendChild(n('text', { x: pad + size * 2.5, y: H - 6, class: 'ch-axis', 'text-anchor': 'middle', text: 'Likelihood →' }));
    svg.appendChild(n('text', {
      x: 12, y: pad + size * 2.5, class: 'ch-axis', 'text-anchor': 'middle',
      transform: 'rotate(-90 12 ' + (pad + size * 2.5) + ')', text: 'Impact →',
    }));
    return svg;
  }

  // ── Donut ────────────────────────────────────────────────────────────────────────────────────────────
  // Composition of one whole, capped at six named slices plus Other — past that, a categorical palette stops
  // being distinguishable and the chart starts lying about how separable the parts are.
  function donut(slices, opts) {
    opts = opts || {};
    var W = 210, H = 210, cx = 105, cy = 105, rOuter = 92, rInner = 58;
    var svg = root(W, H, 'ch-donut');
    var total = slices.reduce(function (s, x) { return s + x.value; }, 0) || 1;
    var a0 = -Math.PI / 2;
    var paths = [];
    slices.forEach(function (s, i) {
      var sweep = (s.value / total) * Math.PI * 2;
      // A slice at or above half the circle needs the large-arc flag, or the path renders inside out.
      var large = sweep > Math.PI ? 1 : 0;
      var a1 = a0 + sweep;
      var p = function (a, r) { return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; };
      var o0 = p(a0, rOuter), o1 = p(a1, rOuter), i1 = p(a1, rInner), i0 = p(a0, rInner);
      var seg = n('path', {
        d: 'M' + o0 + 'A' + rOuter + ',' + rOuter + ' 0 ' + large + ' 1 ' + o1
          + 'L' + i1 + 'A' + rInner + ',' + rInner + ' 0 ' + large + ' 0 ' + i0 + 'Z',
        fill: s.color, class: 'ch-slice', tabindex: '0', role: 'button',
        'aria-label': s.label + ', ' + Math.round(100 * s.value / total) + ' percent',
      });
      paths.push(seg);
      svg.appendChild(seg);
      a0 = a1;
    });

    var centreV = n('text', { x: cx, y: cy - 4, class: 'ch-centre-v', 'text-anchor': 'middle', text: opts.centre || '' });
    var centreK = n('text', { x: cx, y: cy + 14, class: 'ch-centre-k', 'text-anchor': 'middle', text: opts.centreLabel || '' });
    svg.appendChild(centreV);
    svg.appendChild(centreK);

    // Hover and keyboard focus drive the same handler, so the detail this chart reveals is reachable without
    // a pointer. Dimming the others rather than brightening the hovered one keeps the highlighted slice at
    // exactly the colour the legend shows it in — a highlight that changes the hue would break that match.
    if (opts.onPick) {
      // onPick receives the slice and, when a pointer drove the pick, where that pointer was — which is what
      // lets the caller put a hover card next to the slice instead of in a fixed block under the chart.
      // A keyboard pick passes no position on purpose: there is no cursor to sit beside, so the caller
      // anchors the card instead of dropping it wherever the mouse was last left.
      var pick = function (i, evt) {
        paths.forEach(function (p, k) { p.classList.toggle('is-dim', i !== null && k !== i); });
        if (i === null) { centreV.textContent = opts.centre || ''; centreK.textContent = opts.centreLabel || ''; }
        else {
          centreV.textContent = Math.round(100 * slices[i].value / total) + '%';
          centreK.textContent = String(slices[i].label).toUpperCase().slice(0, 18);
        }
        opts.onPick(i === null ? null : slices[i], evt || null);
      };
      paths.forEach(function (p, i) {
        p.addEventListener('mouseenter', function (e) { pick(i, e); });
        // Without this the card is placed once on entry and then stays put while the pointer travels the
        // width of the slice, which on the big slices means it ends up a long way from the cursor.
        p.addEventListener('mousemove', function (e) { if (opts.onMove) opts.onMove(slices[i], e); });
        p.addEventListener('focus', function () { pick(i, null); });
        p.addEventListener('click', function (e) { pick(i, e); });
      });
      svg.addEventListener('mouseleave', function () { pick(null); });
      svg.addEventListener('focusout', function (e) {
        if (!svg.contains(e.relatedTarget)) pick(null);
      });
    }
    return svg;
  }

  // ── Scatter ──────────────────────────────────────────────────────────────────────────────────────────
  // Before on x, after on y, with the line y = x drawn through it. Every point's side of that diagonal says
  // whether it grew or shrank and its distance says by how much, which a slope chart can only show by making
  // the reader trace thirteen crossing lines. The diagonal is the chart: without it this is just a cloud.
  function scatter(points, opts) {
    opts = opts || {};
    var W = 420, H = 380, pad = 48, plot = W - pad - 22;
    var svg = root(W, H, 'ch-scatter');
    var max = Math.max.apply(null, points.map(function (p) { return Math.max(p.x, p.y); })) || 1;
    max = Math.ceil(max * 100 / 5) * 5 / 100; // round the axis up to a whole 5 percentage points
    var X = function (v) { return pad + (v / max) * plot; };
    var Y = function (v) { return (H - pad) - (v / max) * (H - pad - 22); };

    [0.25, 0.5, 0.75, 1].forEach(function (f) {
      svg.appendChild(n('line', { x1: X(max * f), y1: 22, x2: X(max * f), y2: H - pad, class: 'ch-ring' }));
      svg.appendChild(n('line', { x1: pad, y1: Y(max * f), x2: X(max), y2: Y(max * f), class: 'ch-ring' }));
      svg.appendChild(n('text', { x: X(max * f), y: H - pad + 14, class: 'ch-tick', 'text-anchor': 'middle', text: (100 * max * f).toFixed(0) + '%' }));
      svg.appendChild(n('text', { x: pad - 6, y: Y(max * f) + 3, class: 'ch-tick', 'text-anchor': 'end', text: (100 * max * f).toFixed(0) + '%' }));
    });
    svg.appendChild(n('line', { x1: X(0), y1: Y(0), x2: X(max), y2: Y(max), class: 'ch-diag' }));
    svg.appendChild(n('text', { x: X(max) - 4, y: Y(max) + 14, class: 'ch-tick', 'text-anchor': 'end', text: 'no change' }));

    points.forEach(function (p) {
      var cls = 'ch-pt' + (p.highlight ? ' ch-pt-' + p.highlight : '');
      svg.appendChild(n('circle', { cx: X(p.x), cy: Y(p.y), r: p.highlight ? 6 : 4, class: cls }));
      // Only the named movers are labelled. Thirteen labels on thirteen points is a word cloud, not a chart;
      // the unlabelled dots still carry the distribution, which is what they are there for.
      if (p.highlight) {
        svg.appendChild(n('text', {
          x: X(p.x) + 9, y: Y(p.y) - 7, class: 'ch-slope-l', text: p.label,
        }));
      }
    });
    svg.appendChild(n('text', { x: pad + plot / 2, y: H - 8, class: 'ch-axis', 'text-anchor': 'middle', text: opts.xLabel || 'before' }));
    svg.appendChild(n('text', {
      x: 12, y: (H - pad) / 2, class: 'ch-axis', 'text-anchor': 'middle',
      transform: 'rotate(-90 12 ' + ((H - pad) / 2) + ')', text: opts.yLabel || 'after',
    }));
    return svg;
  }

  // ── Slope ────────────────────────────────────────────────────────────────────────────────────────────
  // Two moments, one line each: the form that makes "which of these moved" a shape rather than a subtraction
  // the reader has to perform. Only the named movers are drawn in colour; everything else recedes.
  function slope(items, opts) {
    opts = opts || {};
    // Sized for a full-width panel. An SVG scales its type with its box, so a narrow viewBox stretched across
    // 900px renders 10px labels at 24px; authoring the box near its real display width keeps the text honest
    // and gives the lines room to actually cross, which is the whole point of the form.
    // The left gutter fits the longest theme name ("Psychology & Relationships") without clipping.
    var W = 760, H = 320, left = 200, right = W - 108, top = 28, bottom = H - 34;
    var svg = root(W, H, 'ch-slope');
    var max = Math.max.apply(null, items.map(function (i) { return Math.max(i.from, i.to); })) || 1;
    var y = function (v) { return bottom - (v / max) * (bottom - top); };
    [left, right].forEach(function (x) {
      svg.appendChild(n('line', { x1: x, y1: top - 8, x2: x, y2: bottom + 6, class: 'ch-spoke' }));
    });
    items.forEach(function (it) {
      var cls = 'ch-line' + (it.highlight ? ' ch-line-' + it.highlight : '');
      svg.appendChild(n('line', { x1: left, y1: y(it.from), x2: right, y2: y(it.to), class: cls }));
      svg.appendChild(n('circle', { cx: left, cy: y(it.from), r: it.highlight ? 4 : 2.5, class: cls }));
      svg.appendChild(n('circle', { cx: right, cy: y(it.to), r: it.highlight ? 4 : 2.5, class: cls }));
      if (it.highlight) {
        svg.appendChild(n('text', { x: left - 8, y: y(it.from) + 4, class: 'ch-slope-l', 'text-anchor': 'end', text: it.label }));
        svg.appendChild(n('text', { x: right + 8, y: y(it.to) + 4, class: 'ch-slope-l', text: (100 * it.to).toFixed(1) + '%' }));
      }
    });
    svg.appendChild(n('text', { x: left, y: bottom + 20, class: 'ch-tick', 'text-anchor': 'middle', text: opts.fromLabel || 'before' }));
    svg.appendChild(n('text', { x: right, y: bottom + 20, class: 'ch-tick', 'text-anchor': 'middle', text: opts.toLabel || 'now' }));
    return svg;
  }

  // ── Small-multiple line ──────────────────────────────────────────────────────────────────────────────
  // One series per chart, so the title names it and there is no legend box. Everything that qualifies a point
  // is drawn on the point rather than explained beside it:
  //  · a gap where there is no data (a missing week is not a zero, and joining across it would invent a trend)
  //  · a hollow dot where the point rests on too little (a partial week, or a value worked out rather than
  //    reported), and a dashed segment into or out of a worked-out one
  //  · a wash behind the line for "your usual range" — what the previous weeks covered — and a ring on any
  //    point that falls outside it
  //  · ticks along the top for events (you posted, a burst of follows) and an accent dot for the bucket the
  //    rest of the page is showing.
  // Only the last value is labelled; the crosshair and the table view carry the rest. The chart is focusable
  // and the arrow keys walk the crosshair, so what a pointer can read a keyboard can too.
  //
  // points: [{ x, v (number|null), hollow, dashed, band: [lo, hi]|null, flag, selected }]
  // opts:   { xMin, xMax, zero (default true), fmt, xLabels: [{ x, text }], markers: [{ x, kind }],
  //           onHover(i, evt|null, anchor), onLeave(), onPick(i), label }
  function line(points, opts) {
    opts = opts || {};
    var W = 320, H = 138, L = 40, R = 44, T = 16, B = 24;
    var svg = root(W, H, 'ch-line-sm');
    svg.setAttribute('tabindex', '0');
    if (opts.label) svg.setAttribute('aria-label', opts.label);
    var fmt = opts.fmt || function (v) { return String(v); };
    var vals = [];
    points.forEach(function (p) {
      if (p.v !== null && p.v !== undefined && !isNaN(p.v)) vals.push(+p.v);
      if (p.band) { vals.push(p.band[0]); vals.push(p.band[1]); }
    });
    var zero = opts.zero !== false;
    var lo = vals.length ? Math.min.apply(null, vals) : 0;
    var hi = vals.length ? Math.max.apply(null, vals) : 1;
    if (zero) lo = Math.min(0, lo);
    if (hi === lo) { hi = lo + (lo === 0 ? 1 : Math.abs(lo) * 0.1); }
    if (!zero) { var padV = (hi - lo) * 0.15; lo -= padV; hi += padV; }
    var xMin = opts.xMin !== undefined ? opts.xMin : 0;
    var xMax = opts.xMax !== undefined ? opts.xMax : Math.max(1, points.length - 1);
    var X = function (x) { return xMax === xMin ? L + (W - L - R) / 2 : L + (x - xMin) / (xMax - xMin) * (W - L - R); };
    var Y = function (v) { return T + (1 - (v - lo) / (hi - lo)) * (H - T - B); };

    // Recessive frame: three hairlines and the two extreme values on the axis.
    [lo, (lo + hi) / 2, hi].forEach(function (v, k) {
      svg.appendChild(n('line', { x1: L, x2: W - R, y1: Y(v), y2: Y(v), class: k === 0 && zero ? 'ch-base' : 'ch-ring' }));
    });
    svg.appendChild(n('text', { x: L - 6, y: Y(hi) + 3, class: 'ch-tick', 'text-anchor': 'end', text: fmt(hi) }));
    svg.appendChild(n('text', { x: L - 6, y: Y(lo) + 3, class: 'ch-tick', 'text-anchor': 'end', text: fmt(lo) }));
    (opts.xLabels || []).forEach(function (l, k, all) {
      svg.appendChild(n('text', {
        x: X(l.x), y: H - 6, class: 'ch-tick',
        'text-anchor': all.length > 1 && k === 0 ? 'start' : all.length > 1 && k === all.length - 1 ? 'end' : 'middle',
        text: l.text,
      }));
    });

    // Usual range: one polygon per unbroken run of banded points.
    var run = [];
    var flushBand = function () {
      if (run.length > 1) {
        var top = run.map(function (p) { return X(p.x) + ',' + Y(p.band[1]); });
        var bottom = run.slice().reverse().map(function (p) { return X(p.x) + ',' + Y(p.band[0]); });
        svg.appendChild(n('polygon', { points: top.concat(bottom).join(' '), class: 'ch-band' }));
      }
      run = [];
    };
    points.forEach(function (p) { if (p.band) run.push(p); else flushBand(); });
    flushBand();

    (opts.markers || []).forEach(function (m) {
      var x = X(m.x);
      svg.appendChild(m.kind === 'post'
        ? n('path', { d: 'M' + (x - 4) + ',' + (T - 11) + 'L' + (x + 4) + ',' + (T - 11) + 'L' + x + ',' + (T - 4) + 'Z', class: 'ch-mark' })
        : n('path', { d: 'M' + x + ',' + (T - 12) + 'L' + (x + 4) + ',' + (T - 8) + 'L' + x + ',' + (T - 4) + 'L' + (x - 4) + ',' + (T - 8) + 'Z', class: 'ch-mark ch-mark-alt' }));
    });

    // The line, broken at every gap; a segment touching a worked-out point is dashed. Each segment carries its own
    // length and a delay proportional to where it starts, which is all the CSS draw-in needs to run left to right
    // in about 600ms whatever the number of points (the animation itself is in app.css, behind data-motion).
    var span = Math.max(1, points.length - 1);
    var at = function (k) { return Math.round(600 * k / span) + 'ms'; };
    for (var i = 1; i < points.length; i++) {
      var a = points[i - 1], b = points[i];
      if (a.v === null || b.v === null || a.v === undefined || b.v === undefined) continue;
      var seg = n('line', {
        x1: X(a.x), y1: Y(a.v), x2: X(b.x), y2: Y(b.v), class: 'ch-series' + (a.dashed || b.dashed ? ' is-dashed' : ''),
      });
      seg.setAttribute('style', '--len:' + Math.ceil(Math.hypot(X(b.x) - X(a.x), Y(b.v) - Y(a.v))) + ';--d:' + at(i - 1) + ';--dur:' + Math.round(600 / span) + 'ms');
      svg.appendChild(seg);
    }
    var cross = n('line', { x1: 0, x2: 0, y1: T - 2, y2: H - B, class: 'ch-cross' });
    cross.style.display = 'none';
    svg.appendChild(cross);
    var dots = points.map(function (p) {
      if (p.v === null || p.v === undefined) return null;
      if (p.flag) svg.appendChild(n('circle', { cx: X(p.x), cy: Y(p.v), r: 7.5, class: 'ch-flag' }));
      var dot = n('circle', {
        cx: X(p.x), cy: Y(p.v), r: p.selected ? 5 : 4,
        class: 'ch-pt-sm' + (p.hollow ? ' is-hollow' : '') + (p.selected ? ' is-selected' : ''),
        style: '--d:' + at(p.x - (opts.xMin || 0)),
      });
      svg.appendChild(dot);
      return dot;
    });
    var last = null;
    for (var j = points.length - 1; j >= 0; j--) if (points[j].v !== null && points[j].v !== undefined) { last = j; break; }
    if (last !== null) {
      svg.appendChild(n('text', { x: X(points[last].x) + 8, y: Y(points[last].v) + 4, class: 'ch-end', text: fmt(points[last].v) }));
    }

    // Hit areas: a full-height column per point, as wide as the gap to its neighbours, so the pointer only has
    // to be near a date, never on a 4px dot.
    var active = null;
    var show = function (k, evt) {
      active = k;
      cross.style.display = '';
      cross.setAttribute('x1', X(points[k].x));
      cross.setAttribute('x2', X(points[k].x));
      dots.forEach(function (d, m) { if (d) d.classList.toggle('is-hot', m === k); });
      if (opts.onHover) opts.onHover(k, evt || null, svg);
    };
    var hide = function () {
      active = null;
      cross.style.display = 'none';
      dots.forEach(function (d) { if (d) d.classList.remove('is-hot'); });
      if (opts.onLeave) opts.onLeave();
    };
    points.forEach(function (p, k) {
      var left = k === 0 ? L - 6 : (X(points[k - 1].x) + X(p.x)) / 2;
      var right = k === points.length - 1 ? W - R + 6 : (X(p.x) + X(points[k + 1].x)) / 2;
      var hit = n('rect', { x: left, y: 0, width: Math.max(1, right - left), height: H, class: 'ch-hit' });
      hit.addEventListener('mousemove', function (e) { show(k, e); });
      hit.addEventListener('click', function () { if (opts.onPick) opts.onPick(k); });
      svg.appendChild(hit);
    });
    svg.addEventListener('mouseleave', hide);
    svg.addEventListener('blur', hide);
    svg.addEventListener('keydown', function (e) {
      if (!points.length) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        var k = active === null ? (e.key === 'ArrowRight' ? 0 : points.length - 1)
          : Math.max(0, Math.min(points.length - 1, active + (e.key === 'ArrowRight' ? 1 : -1)));
        show(k, null);
      } else if ((e.key === 'Enter' || e.key === ' ') && active !== null && opts.onPick) {
        e.preventDefault();
        opts.onPick(active);
      } else if (e.key === 'Escape') hide();
    });
    return svg;
  }

  // ── Line icons ───────────────────────────────────────────────────────────────────────────────────────
  // Monochrome, stroked, 24×24, drawn on one grid so they sit together as a set. They take their colour from
  // the element around them, which is what keeps them legible in both themes without a second set of assets.
  var ICONS = {
    anxiety: 'M3 9c2-2 3 2 5 0s3 2 5 0 3 2 5 0M3 15c2-2 3 2 5 0s3 2 5 0 3 2 5 0',
    sadness: 'M12 3c3 5 5 7.5 5 10a5 5 0 0 1-10 0c0-2.5 2-5 5-10z',
    anger: 'M13 2 4 14h6l-1 8 9-12h-6z',
    fear: 'M12 3 2 20h20zM12 10v4M12 17v.5',
    hope: 'M12 21V9M12 9C12 5 9 3 5 3c0 4 3 6 7 6zM12 12c0-3 2.5-5 6-5 0 3-2.5 5-6 5z',
    joy: 'M12 3v2M4.2 6.2l1.4 1.4M21 12h-2M3 12h2M19.8 6.2l-1.4 1.4M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM10 13c.6.8 3.4.8 4 0',
    love: 'M12 20S3.5 14.5 3.5 8.8A4.3 4.3 0 0 1 12 6.7a4.3 4.3 0 0 1 8.5 2.1C20.5 14.5 12 20 12 20z',
    feed: 'M3 5h18v14H3zM3 10h18M8 10v9',
    person: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4 3.6-6 8-6s8 2 8 6',
    pulse: 'M3 12h4l2-6 3 12 2.5-8 1.5 2h5',
    clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3.5 2',
    users: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2 20c0-3.6 3.1-5.5 7-5.5s7 1.9 7 5.5M17 5.2a3.5 3.5 0 0 1 0 6.6M18.5 14.4c2.1.7 3.5 2.2 3.5 4.4',
    alert: 'M12 3 2 20h20zM12 9v5M12 17v.5',
    search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3',
    quiet: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM8.5 14c1.8-1.4 5.2-1.4 7 0M9 9.5v.5M15 9.5v.5',
    layers: 'M12 3 2 8l10 5 10-5zM2 12.5l10 5 10-5M2 17l10 5 10-5',
    trend: 'M3 20h18M4 16l5-5 4 3 7-8M16 6h4v4',
    account: 'M12 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM5.5 19c.8-3 3.4-4.5 6.5-4.5s5.7 1.5 6.5 4.5M3 3h18v18H3z',
    trigger: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 2v4M12 18v4M2 12h4M18 12h4',
  };

  // ── Dot groups ───────────────────────────────────────────────────────────────────────────────────────
  // Every session as a dot on one minutes axis, one row per group, with each row's median as a tick and one line
  // across all rows for the threshold that counts as long. Rows are HTML with an SVG track each, so the labels stay
  // at their real size on a phone instead of shrinking with a single wide viewBox.
  // groups: [{ label, sub, values: [{ v, data }] }]
  // opts:   { max, line: { v, label }, fmt, onHover(data, evt|null, anchor), onLeave() }
  function dotGroups(groups, opts) {
    opts = opts || {};
    var H = 34;
    var max = opts.max || 1;
    // Percent of the track's width, so the track can be any width and a dot stays a circle: a stretched viewBox
    // would squash every dot into an ellipse.
    var pct = function (v) { return 1.5 + Math.min(1, v / max) * 97; };
    var X = function (v) { return pct(v) + '%'; };
    var step = max <= 30 ? 5 : max <= 60 ? 10 : max <= 150 ? 20 : 60;
    var wrap = document.createElement('div');
    wrap.className = 'dg';
    var track = function (kids) {
      var svg = n('svg', { class: 'ch-dg', height: H, width: '100%' });
      for (var t = 0; t <= max; t += step) svg.appendChild(n('line', { x1: X(t), x2: X(t), y1: 0, y2: H, class: 'ch-ring' }));
      if (opts.line) svg.appendChild(n('line', { x1: X(opts.line.v), x2: X(opts.line.v), y1: 0, y2: H, class: 'ch-dg-line' }));
      kids.forEach(function (k) { svg.appendChild(k); });
      return svg;
    };
    groups.forEach(function (g) {
      var row = document.createElement('div');
      row.className = 'dg-row';
      var label = document.createElement('div');
      label.className = 'dg-l';
      var b = document.createElement('b');
      b.textContent = g.label;
      var s = document.createElement('span');
      s.textContent = g.sub || '';
      label.appendChild(b);
      label.appendChild(s);
      var dots = [];
      var hits = [];
      var sorted = g.values.map(function (x) { return x.v; }).sort(function (a, z) { return a - z; });
      var med = sorted.length ? sorted[Math.floor((sorted.length - 1) / 2)] : null;
      // A fixed, deterministic spread across the row's height: the same session lands in the same place on every
      // render, and dots that share a minute fan out rather than stacking into one.
      g.values.forEach(function (x, k) {
        var y = H / 2 + (((k * 7) % 9) - 4) * 2.6;
        var dot = n('circle', { cx: X(x.v), cy: y, r: 4, class: 'ch-dg-dot', style: '--d:' + Math.round(4 * pct(x.v)) + 'ms' });
        var hit = n('circle', { cx: X(x.v), cy: y, r: 9, class: 'ch-hit' });
        if (opts.onHover) {
          hit.addEventListener('mouseenter', function (e) { dot.classList.add('is-hot'); opts.onHover(x.data, e); });
          hit.addEventListener('mousemove', function (e) { opts.onHover(x.data, e); });
          hit.addEventListener('mouseleave', function () { dot.classList.remove('is-hot'); if (opts.onLeave) opts.onLeave(); });
        }
        dots.push(dot);
        hits.push(hit);
      });
      var marks = med === null ? dots : dots.concat([n('line', { x1: X(med), x2: X(med), y1: 3, y2: H - 3, class: 'ch-dg-med' })]);
      var svg = track(marks.concat(hits));
      svg.setAttribute('role', 'img');
      svg.setAttribute('aria-label', g.label + ': ' + g.values.length + (med !== null ? ', median ' + (opts.fmt ? opts.fmt(med) : med) : ''));
      row.appendChild(label);
      row.appendChild(svg);
      wrap.appendChild(row);
    });
    // The axis shares the tracks' geometry, so a tick and a dot at the same minute line up exactly.
    var axis = document.createElement('div');
    axis.className = 'dg-row dg-axis';
    axis.appendChild(document.createElement('div'));
    var labels = document.createElement('div');
    labels.className = 'dg-ticks';
    for (var t = 0; t <= max; t += step) {
      var tick = document.createElement('span');
      tick.style.left = X(t);
      tick.textContent = opts.fmt ? opts.fmt(t) : String(t);
      labels.appendChild(tick);
    }
    if (opts.line) {
      var mark = document.createElement('span');
      mark.className = 'dg-line-l';
      mark.style.left = X(opts.line.v);
      mark.textContent = opts.line.label;
      labels.appendChild(mark);
    }
    axis.appendChild(labels);
    wrap.appendChild(axis);
    return wrap;
  }

  // ── Tile sparkline ───────────────────────────────────────────────────────────────────────────────────
  // The last few buckets of one tile's measure, no axis: its job is the shape of the run and where the newest point
  // sits in it, which the dark end dot marks. Gaps stay gaps.
  function spark(values, opts) {
    opts = opts || {};
    var W = 120, H = 28, P = 4;
    var svg = root(W, H, 'ch-spark');
    svg.setAttribute('aria-label', (opts.label || '') + ': ' + values.filter(function (v) { return v !== null; }).length + ' points');
    var vals = values.filter(function (v) { return v !== null && !isNaN(v); });
    var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
    if (hi === lo) { hi = lo + 1; lo = lo - 1; }
    var X = function (k) { return P + (values.length < 2 ? 0 : k / (values.length - 1)) * (W - 2 * P); };
    var Y = function (v) { return H - P - (v - lo) / (hi - lo) * (H - 2 * P); };
    var run = [];
    var flush = function () {
      if (run.length > 1) svg.appendChild(n('polyline', { points: run.join(' '), class: 'ch-spark-l' }));
      run = [];
    };
    values.forEach(function (v, k) { if (v === null || isNaN(v)) flush(); else run.push(X(k) + ',' + Y(v)); });
    flush();
    var last = values.length - 1;
    if (values[last] !== null && !isNaN(values[last])) svg.appendChild(n('circle', { cx: X(last), cy: Y(values[last]), r: 3.5, class: 'ch-spark-d' }));
    return svg;
  }

  function icon(name, size) {
    var svg = root(24, 24, 'ch-icon');
    svg.setAttribute('width', size || 20);
    svg.setAttribute('height', size || 20);
    svg.setAttribute('aria-hidden', 'true');
    svg.appendChild(n('path', {
      d: ICONS[name] || ICONS.feed,
      fill: 'none', stroke: 'currentColor', 'stroke-width': 1.6,
      'stroke-linecap': 'round', 'stroke-linejoin': 'round',
    }));
    return svg;
  }

  return { radar: radar, matrix: matrix, donut: donut, slope: slope, scatter: scatter, line: line, dotGroups: dotGroups, spark: spark, icon: icon, icons: ICONS };
}());
