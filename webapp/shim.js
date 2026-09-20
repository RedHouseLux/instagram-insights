// Stand-ins for the Google services Code.gs calls, so the same engine runs in a browser.
// Nothing here talks to a network: the spreadsheet lives in memory, "Drive" is the files you picked,
// and history is kept in this browser's localStorage.
(function (global) {
  'use strict';

  // ── Utilities.formatDate: the SimpleDateFormat subset Code.gs uses ──────────
  function formatDate(date, tz, pattern) {
    const parts = {};
    new Intl.DateTimeFormat('en-GB', {
      timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', weekday: 'short',
    }).formatToParts(date).forEach(p => { parts[p.type] = p.value; });
    const dow = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }[parts.weekday];
    return pattern.replace(/'([^']*)'|yyyy|MM|dd|HH|mm|ss|u/g, (tok, lit) => {
      if (lit !== undefined) return lit;
      return { yyyy: parts.year, MM: parts.month, dd: parts.day, HH: parts.hour, mm: parts.minute, ss: parts.second, u: String(dow) }[tok];
    });
  }

  // ── Chainable stub: unknown methods return the same object ─────────────────
  function chain(extra) {
    const target = extra || {};
    const proxy = new Proxy(target, { get: (t, prop) => (prop in t ? t[prop] : () => proxy) });
    return proxy;
  }

  // ── In-memory spreadsheet ──────────────────────────────────────────────────
  function a1(ref) {
    const m = String(ref).match(/^([A-Z]+)(\d+)$/);
    const col = m[1].split('').reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
    return [+m[2], col];
  }

  function makeSheet(name, sheets) {
    const state = { name: name, cells: new Map(), maxRows: 2000, maxCols: 40 };
    const key = (r, c) => r + ':' + c;
    const range = (row, col, nr, nc) => {
      if (typeof row === 'string') { const rc = a1(row); row = rc[0]; col = rc[1]; }
      nr = nr === undefined ? 1 : nr;
      nc = nc === undefined ? 1 : nc;
      const r = chain({
        getValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => {
          const v = state.cells.get(key(row + i, col + j));
          return v === undefined ? '' : v;
        })),
        setValues: vals => {
          vals.forEach((rowVals, i) => rowVals.forEach((v, j) => state.cells.set(key(row + i, col + j), v)));
          return r;
        },
        setValue: v => { state.cells.set(key(row, col), v); return r; },
        setFormula: f => { state.cells.set(key(row, col), f); return r; },
        clearContent: () => {
          for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) state.cells.delete(key(row + i, col + j));
          return r;
        },
        getNumColumns: () => nc,
        getNumRows: () => nr,
      });
      return r;
    };
    const api = chain({
      getName: () => name,
      getSheetId: () => 1000 + sheets.indexOf(api),
      getRange: range,
      getLastRow: () => {
        let last = 0;
        state.cells.forEach((v, k) => { if (v !== '') last = Math.max(last, +k.split(':')[0]); });
        return last;
      },
      getMaxRows: () => state.maxRows,
      getMaxColumns: () => state.maxCols,
      insertRowsAfter: (_, n) => { state.maxRows += n; return api; },
      insertColumnsAfter: (_, n) => { state.maxCols += n; return api; },
      clear: () => { state.cells.clear(); return api; },
      getCharts: () => [],
      newChart: () => chain({ build: () => ({ options: {}, ranges: [] }) }),
      _state: state,
    });
    return api;
  }

  function makeSpreadsheet() {
    const sheets = [];
    const ss = chain({
      getId: () => 'browser',
      getSheetByName: n => sheets.find(s => s.getName() === n) || null,
      insertSheet: (n, idx) => { const s = makeSheet(n, sheets); if (idx === 0) sheets.unshift(s); else sheets.push(s); return s; },
      getSheets: () => sheets.slice(),
      deleteSheet: s => { const i = sheets.indexOf(s); if (i >= 0) sheets.splice(i, 1); },
      toast: () => {},
      _sheets: sheets,
    });
    return ss;
  }

  // ── "Drive": the export files the visitor picked, already unzipped ─────────
  // sources: [{ id, name, entries: [{ name, text }] }]
  function makeDrive(sources) {
    const iterator = list => {
      let i = 0;
      return { hasNext: () => i < list.length, next: () => list[i++] };
    };
    const fileFor = src => ({
      getId: () => src.id,
      getName: () => src.name,
      getMimeType: () => 'application/zip',
      getBlob: () => ({ __entries: src.entries, setContentType() { return this; } }),
    });
    const folder = {
      getId: () => 'exports',
      getName: () => 'Instagram Exports',
      getUrl: () => '#',
      getFiles: () => iterator(sources.map(fileFor)),
      getFolders: () => iterator([]),
      getFilesByName: () => iterator([]),
    };
    return {
      getFolderById: () => folder,
      getFoldersByName: () => iterator([folder]),
      createFolder: () => folder,
    };
  }

  function makeProperties(store) {
    return {
      getProperty: k => (k in store ? store[k] : null),
      setProperty: (k, v) => { store[k] = String(v); },
      deleteProperty: k => { delete store[k]; },
      getProperties: () => Object.assign({}, store),
    };
  }

  // ── Install: point the engine's globals at the stand-ins ───────────────────
  function install(sources, properties) {
    const spreadsheet = makeSpreadsheet();
    const props = makeProperties(properties || {});
    global.SpreadsheetApp = {
      getActive: () => spreadsheet,
      getUi: () => { throw new Error('no spreadsheet UI in the browser'); },
      newConditionalFormatRule: () => chain(),
      InterpolationType: { NUMBER: 'NUMBER', MAX: 'MAX' },
      BorderStyle: { SOLID: 'SOLID' },
      WrapStrategy: { CLIP: 'CLIP' },
    };
    global.DriveApp = makeDrive(sources);
    global.Utilities = {
      formatDate: formatDate,
      unzip: blob => (blob.__entries || []).map(entry => ({
        getName: () => entry.name,
        getDataAsString: () => entry.text,
      })),
    };
    global.PropertiesService = { getScriptProperties: () => props, getUserProperties: () => props };
    global.LockService = { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) };
    global.ScriptApp = { getProjectTriggers: () => [], newTrigger: () => chain() };
    global.HtmlService = { createHtmlOutput: () => chain(), createTemplateFromFile: () => chain() };
    global.Charts = { ChartType: { BAR: 'BAR', COLUMN: 'COLUMN', LINE: 'LINE' } };
    return { spreadsheet: spreadsheet, properties: props };
  }

  // ── Saving and restoring a session, so months add up across visits ─────────
  // The Dashboard and its hidden chart data are rebuilt from the other tabs on every run, so they aren't kept.
  const NOT_SAVED = ['Dashboard', '_charts'];

  function dump(spreadsheet) {
    const out = {};
    spreadsheet.getSheets().filter(s => NOT_SAVED.indexOf(s.getName()) < 0).forEach(sheet => {
      const state = sheet._state;
      const cells = [];
      state.cells.forEach((v, k) => {
        const isDate = Object.prototype.toString.call(v) === '[object Date]';
        cells.push([k, isDate ? { __date: v.toISOString() } : v]);
      });
      out[sheet.getName()] = cells;
    });
    return out;
  }

  function restore(spreadsheet, data) {
    Object.keys(data || {}).forEach(name => {
      const sheet = spreadsheet.getSheetByName(name) || spreadsheet.insertSheet(name);
      data[name].forEach(([k, v]) => {
        sheet._state.cells.set(k, v && typeof v === 'object' && v.__date ? new Date(v.__date) : v);
      });
    });
  }

  // ── Reading a .zip in the browser, with no library ─────────────────────────
  // Only what Instagram's export needs: the central directory, stored and deflated entries.
  async function unzipHtml(buffer) {
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);
    let end = -1;
    for (let i = view.byteLength - 22; i >= 0 && i > view.byteLength - 66000; i--) {
      if (view.getUint32(i, true) === 0x06054b50) { end = i; break; }
    }
    if (end < 0) throw new Error('This file is not a .zip archive.');
    const count = view.getUint16(end + 10, true);
    let pointer = view.getUint32(end + 16, true);
    const decoder = new TextDecoder('utf-8');
    const entries = [];
    for (let i = 0; i < count; i++) {
      if (view.getUint32(pointer, true) !== 0x02014b50) break;
      const method = view.getUint16(pointer + 10, true);
      const compressed = view.getUint32(pointer + 20, true);
      const nameLength = view.getUint16(pointer + 28, true);
      const extraLength = view.getUint16(pointer + 30, true);
      const commentLength = view.getUint16(pointer + 32, true);
      const localOffset = view.getUint32(pointer + 42, true);
      const name = decoder.decode(bytes.subarray(pointer + 46, pointer + 46 + nameLength));
      pointer += 46 + nameLength + extraLength + commentLength;
      if (!/\.html$/i.test(name)) continue;
      const localNameLength = view.getUint16(localOffset + 26, true);
      const localExtraLength = view.getUint16(localOffset + 28, true);
      const start = localOffset + 30 + localNameLength + localExtraLength;
      const raw = bytes.subarray(start, start + compressed);
      let text;
      if (method === 0) {
        text = decoder.decode(raw);
      } else if (method === 8) {
        const stream = new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
        text = await new Response(stream).text();
      } else {
        continue;
      }
      entries.push({ name: name, text: text });
    }
    return entries;
  }

  global.InsightsShim = {
    install: install,
    dump: dump,
    restore: restore,
    unzipHtml: unzipHtml,
    formatDate: formatDate,
  };
})(typeof window !== 'undefined' ? window : globalThis);
