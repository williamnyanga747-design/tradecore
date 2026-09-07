// ULTIMATE TRANSLATION AUDIT — scans all t()/translate() literals across src/**,
// checks coverage in the 4 dicts inside src/utils/format.ts, writes reports.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');

// ---------- 1. collect source files ----------
function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(tsx?|jsx?)$/.test(e.name)) out.push(p);
  }
  return out;
}
const files = walk(SRC, []);

// ---------- 2. extract string literals passed to t(...) / translate(...) ----------
const usage = new Map(); // key -> [{file,line}]
for (const f of files) {
  const rel = path.relative(ROOT, f).replace(/\\/g, '/');
  const src = fs.readFileSync(f, 'utf8');
  const lines = src.split(/\r?\n/);
  const re = /\b(?:t|translate)\(\s*(['"])((?:[^'\\\n]|\\.)*)\1/g;
  let m;
  while ((m = re.exec(src))) {
    const quote = m[1];
    const raw = m[2];
    // unescape minimal
    const key = raw.replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    const line = src.slice(0, m.index).split('\n').length;
    if (!usage.has(key)) usage.set(key, []);
    usage.get(key).push({ file: rel, line });
  }
}

// ---------- 3. parse dicts from format.ts ----------
const fmtPath = path.join(SRC, 'utils/format.ts');
const fmt = fs.readFileSync(fmtPath, 'utf8');
function dictSlice(name) {
  const di = fmt.indexOf('export const ' + name + ': Record<string, string> = {');
  if (di < 0) return null;
  const ni = fmt.indexOf('\nexport ', di + 10);
  return fmt.slice(di, ni > 0 ? ni : undefined);
}
function parseDict(name) {
  const body = dictSlice(name);
  const d = new Map();
  if (!body) return d;
  const unq = (x) => x.replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  // boundary-free scanners: handle several entries per line + any quote combination
  const patterns = [
    /'((?:[^'\\]|\\.)*)'\s*:\s*'((?:[^'\\]|\\.)*)'/g,
    /"((?:[^"\\]|\\.)*)"\s*:\s*"((?:[^"\\]|\\.)*)"/g,
    /'((?:[^'\\]|\\.)*)'\s*:\s*"((?:[^"\\]|\\.)*)"/g,
    /"((?:[^"\\]|\\.)*)"\s*:\s*'((?:[^'\\]|\\.)*)'/g
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(body))) {
      const k = unq(m[1]);
      if (!d.has(k) && k.length && !/^(http|data:)/.test(k)) d.set(k, unq(m[2]));
    }
  }
  return d;
}
const dicts = {
  englishDict: parseDict('englishDict'),
  swahiliDict: parseDict('swahiliDict'),
  frenchDict: parseDict('frenchDict'),
  spanishDict: parseDict('spanishDict')
};
// pageTitleMap (keys may be unquoted identifiers)
const ptmBody = dictSlice('pageTitleMap') || '';
const ptmKeys = new Set();
{
  const re = /^\s*'([^']+)'\s*:/gm;
  let m;
  while ((m = re.exec(ptmBody))) ptmKeys.add(m[1]);
}

// ---------- 4. classify ----------
// Heuristic Swahili detector for en-gap triage
const SW_MARKERS = /\b(bidhaa|bei|ofa|mteja|muuzaji|wauzaji|hakuna|tafuta|tafta|nunua|kuuza|piga|kubali|kataa|simu|jina|yako|yangu|zangu|yetu|wako|bado|sasa|hii|hiyo|kila|ndani|kabla|baada|namba|pesa|malipo|lipa|kulipa|agizo|maagizo|duka|maduka|soko|bei|zaidi|chini|juu|haraka|polepole|leo|jana|kesho|asante|karibu|habari|tafadhali|ndiyo|hapana|wote|wingi|chache|mpya|pya|kubwa|ndogo|nzuri|mbaya|rahisi|ghali|bure|punguzo|pungufu|zima|fungua|funga|tuma|tumia|jaribu|subiri|anza|maliza|kamilisha|ondoa|weka|badilisha|angalia|tafuta|soma|andika|nakala|picha|video|sauti|rangi|saizi|kiasi|idadi|jumla|bei|kiasi|salio|akaunti|benki|pusha|tozo|ushuru|ripoti|takwimu|chat|ujumbe|ujumbe|arifa|taarifa|historia|profilo|nenosiri|jina|mtumiaji|mfanyabiashara|kampuni|bidhaa|huduma|oda|daftari|ankara|risiti|matumizi|mapato|faida|hasara|rasilmali|dhima|wateja|wadhamini)\b/i;

const report = { generatedAt: new Date().toISOString(), totalKeys: usage.size, langs: {}, enNeedsReview: [], ok: {} };
const missing = { en_swahili: [], sw_english_source: [], fr: [], es: [] };

for (const [key, locs] of [...usage.entries()].sort()) {
  const inEn = dicts.englishDict.has(key);
  const inSw = dicts.swahiliDict.has(key);
  const inFr = dicts.frenchDict.has(key);
  const inEs = dicts.spanishDict.has(key);
  const inPtm = ptmKeys.has(key);

  if (!inEn && !inPtm && SW_MARKERS.test(key)) {
    missing.en_swahili.push(key); // Swahili-source key that would show raw to EN users
  }
  if (!inSw) {
    // sw users see key as-is; gap only matters if key is English-source
    if (!SW_MARKERS.test(key)) missing.sw_english_source.push(key);
  }
  if (!inFr) missing.fr.push(key);
  if (!inEs) missing.es.push(key);
}

report.langs = {
  en_missing_swahili_keys: missing.en_swahili.length,
  sw_missing_english_keys: missing.sw_english_source.length,
  fr_missing: missing.fr.length,
  es_missing: missing.es.length
};
fs.writeFileSync(path.join(ROOT, 'scripts', 'audit-report.json'), JSON.stringify({
  ...report,
  missing
}, null, 1));

console.log('Files scanned:', files.length);
console.log('Unique t()/translate() keys:', usage.size);
console.log('Dict sizes:', Object.fromEntries(Object.entries(dicts).map(([n, d]) => [n, d.size])), '| pageTitleMap keys:', ptmKeys.size);
console.log('--- GAPS ---');
console.log('EN (Swahili-source keys w/o englishDict):', missing.en_swahili.length);
console.log('SW (English-source keys w/o swahiliDict):', missing.sw_english_source.length);
console.log('FR missing:', missing.fr.length);
console.log('ES missing:', missing.es.length);
console.log('Full details -> scripts/audit-report.json');
