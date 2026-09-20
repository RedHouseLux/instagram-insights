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
  };

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

  return { radar: radar, matrix: matrix, donut: donut, slope: slope, scatter: scatter, icon: icon, icons: ICONS };
}());
