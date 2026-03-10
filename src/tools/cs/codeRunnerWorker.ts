/* ─────────────────────────────────────────────────────────────────────────
   codeRunnerWorker.ts
   Runs in a Web Worker — no window, document, localStorage, or DOM access.
   Receives: { code: string; lang: 'js' | 'python' }
   Sends back: { steps: Step[]; lineMap: number[]; error?: string }
   ─────────────────────────────────────────────────────────────────────── */

type VKind = 'number' | 'string' | 'boolean' | 'null' | 'undefined' | 'function' | 'array' | 'object';
interface VNode {
  kind: VKind;
  prim?: string | number | boolean;
  id?: number; items?: VNode[]; fields?: [string, VNode][]; len?: number;
}
interface Step { line: number; text: string; vars: [string, VNode][]; }
type Lang = 'js' | 'python';

/* ── Serialisation ────────────────────────────────────────────────────── */
function makeVNode(val: unknown, hm: WeakMap<object, number>, hc: { n: number }, depth: number): VNode {
  if (val === null) return { kind: 'null' };
  if (val === undefined) return { kind: 'undefined' };
  if (typeof val === 'function') return { kind: 'function' };
  if (typeof val === 'number') return { kind: 'number', prim: val };
  if (typeof val === 'string') return { kind: 'string', prim: val };
  if (typeof val === 'boolean') return { kind: 'boolean', prim: val };
  if (!hm.has(val as object)) hm.set(val as object, hc.n++);
  const id = hm.get(val as object)!;
  if (Array.isArray(val)) {
    const items = depth < 2 ? (val as unknown[]).slice(0, 24).map(v => makeVNode(v, hm, hc, depth + 1)) : [];
    return { kind: 'array', id, items, len: (val as unknown[]).length };
  }
  const entries = Object.entries(val as object).slice(0, 16);
  const fields: [string, VNode][] = depth < 2
    ? entries.map(([k, v]) => [k, makeVNode(v, hm, hc, depth + 1)]) : [];
  return { kind: 'object', id, fields, len: entries.length };
}

/* ── JS Instrumentation ───────────────────────────────────────────────── */
function extractVarNames(code: string): string[] {
  const names = new Set<string>();
  const re = /\b(?:let|const|var)\s+([a-zA-Z_$]\w*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code))) names.add(m[1]);
  return [...names];
}

function instrumentJS(code: string, varNames: string[]): string {
  const cap = varNames.map(n => `"${n}":__g(function(){return ${n}})`).join(',');
  const mkStep = (ln: number, text: string) =>
    `  __step__(${ln},{${cap}},${JSON.stringify(text.slice(0, 80))});`;
  const lines = code.split('\n');
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i], tr = raw.trim();
    out.push(raw);
    if (!tr || tr.startsWith('//') || tr.startsWith('/*') || tr === '{' || tr === '}') continue;
    if (/^else\b/.test(tr)) continue;
    if (/^(?:for|while|if)\s*\(/.test(tr) && tr.endsWith('{')) continue;
    if (/^function\s+\w+/.test(tr)) continue;
    out.push(mkStep(i + 1, tr));
  }
  return out.join('\n');
}

/* ── Python → JS Transpiler ───────────────────────────────────────────── */
function transpilePython(py: string): { js: string; lineMap: number[] } {
  const pyLines = py.split('\n');
  const jsLines: string[] = [];
  const lineMap: number[] = [];
  const declared = new Set<string>();
  const indentStack: number[] = [0];

  const push = (s: string, pyLine: number) => { jsLines.push(s); lineMap.push(pyLine); };

  const convExpr = (s: string) =>
    s.replace(/\bNone\b/g, 'null')
      .replace(/\bTrue\b/g, 'true')
      .replace(/\bFalse\b/g, 'false')
      .replace(/\blen\s*\((\w+)\)/g, '$1.length')
      .replace(/\band\b/g, '&&')
      .replace(/\bor\b/g, '||')
      .replace(/\bnot\s+/g, '!')
      .replace(/\.append\s*\(/g, '.push(');

  for (let pi = 0; pi < pyLines.length; pi++) {
    const raw = pyLines[pi];
    const trimmed = raw.trimEnd();
    const content = raw.trimStart();
    const pyLineNum = pi + 1;

    if (!trimmed) { push('', 0); continue; }
    if (content.startsWith('#')) { push(`// ${content.slice(1).trim()}`, pyLineNum); continue; }

    const indent = raw.length - content.length;

    while (indentStack.length > 1 && indent < indentStack[indentStack.length - 1]) {
      indentStack.pop();
      push('  '.repeat(indentStack.length) + '}', 0);
    }

    const pad = '  '.repeat(indentStack.length);
    const endsColon = content.trimEnd().endsWith(':');

    let m = content.match(/^for\s+(\w+)\s+in\s+range\s*\((.+)\)\s*:$/);
    if (m) {
      const [, v, args] = m;
      const parts = args.split(',').map(s => s.trim());
      const [start, end] = parts.length === 1 ? ['0', parts[0]] : [parts[0], parts[1]];
      if (!declared.has(v)) declared.add(v);
      push(`${pad}for (let ${v} = ${convExpr(start)}; ${v} < ${convExpr(end)}; ${v}++) {`, pyLineNum);
      indentStack.push(indent + 1);
      continue;
    }

    m = content.match(/^for\s+(\w+)\s+in\s+(.+)\s*:$/);
    if (m) {
      const [, v, iter] = m;
      if (!declared.has(v)) declared.add(v);
      push(`${pad}for (let ${v} of ${convExpr(iter)}) {`, pyLineNum);
      indentStack.push(indent + 1);
      continue;
    }

    m = content.match(/^while\s+(.+)\s*:$/);
    if (m) {
      push(`${pad}while (${convExpr(m[1])}) {`, pyLineNum);
      indentStack.push(indent + 1);
      continue;
    }

    m = content.match(/^if\s+(.+)\s*:$/);
    if (m) { push(`${pad}if (${convExpr(m[1])}) {`, pyLineNum); indentStack.push(indent + 1); continue; }
    m = content.match(/^elif\s+(.+)\s*:$/);
    if (m) {
      if (indentStack.length > 1) indentStack.pop();
      push(`${'  '.repeat(indentStack.length)}} else if (${convExpr(m[1])}) {`, pyLineNum);
      indentStack.push(indent + 1);
      continue;
    }
    if (content.trim() === 'else:') {
      if (indentStack.length > 1) indentStack.pop();
      push(`${'  '.repeat(indentStack.length)}} else {`, pyLineNum);
      indentStack.push(indent + 1);
      continue;
    }

    m = content.match(/^print\s*\((.+)\)\s*;?$/);
    if (m) { push(`${pad}// print(${m[1]})`, pyLineNum); continue; }

    m = content.match(/^([a-zA-Z_]\w*)\s*([+\-*\/]=)\s*(.+?)\s*;?$/);
    if (m) {
      const [, name, op, val] = m;
      push(`${pad}${name} ${op} ${convExpr(val)};`, pyLineNum);
      continue;
    }

    m = content.match(/^([a-zA-Z_]\w*)\s*=\s*(.+?)\s*;?$/);
    if (m && !content.includes('==') && !endsColon) {
      const [, name, val] = m;
      const decl = !declared.has(name);
      if (decl) declared.add(name);
      push(`${pad}${decl ? 'let ' : ''}${name} = ${convExpr(val)};`, pyLineNum);
      continue;
    }

    m = content.match(/^(\w+(?:\[.+?\]|(?:\.\w+)+))\s*=\s*(.+?)\s*;?$/);
    if (m && !content.includes('==')) {
      push(`${pad}${convExpr(m[1])} = ${convExpr(m[2])};`, pyLineNum);
      continue;
    }

    let line = convExpr(content.replace(/#.*$/, s => `// ${s.slice(1).trim()}`));
    if (!line.endsWith('{') && !line.endsWith('}') && !line.endsWith(';')) line += ';';
    push(`${pad}${line}`, pyLineNum);
  }

  while (indentStack.length > 1) {
    indentStack.pop();
    push('  '.repeat(indentStack.length) + '}', 0);
  }

  return { js: jsLines.join('\n'), lineMap };
}

/* ── Runner (sandboxed) ───────────────────────────────────────────────── */
interface RunResult { steps: Step[]; lineMap: number[]; error?: string; }

function runCode(code: string, lang: Lang): RunResult {
  let jsCode = code;
  let lineMap: number[] = [];

  if (lang === 'python') {
    const { js, lineMap: lm } = transpilePython(code);
    jsCode = js;
    lineMap = lm;
  }

  const varNames = extractVarNames(jsCode);
  const instrumented = instrumentJS(jsCode, varNames);
  const steps: Step[] = [];
  const hm = new WeakMap<object, number>();
  const hc = { n: 1 };
  const startMs = Date.now();

  const __step__ = (lineNum: number, rawVars: Record<string, unknown>, text: string) => {
    if (Date.now() - startMs > 2500) throw new Error('Execution timed out (2.5 s). Check for infinite loops.');
    if (steps.length >= 250) throw new Error('Too many steps (max 250).');
    const vars: [string, VNode][] = Object.entries(rawVars)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, makeVNode(v, hm, hc, 0)]);
    steps.push({ line: lineNum, text, vars });
  };

  try {
    const pre = '"use strict";function __g(fn){try{return fn();}catch(_){return undefined;}}\n';
    // Shadow dangerous globals so user code cannot access browser/worker APIs
    const sandbox =
      'const window=undefined,document=undefined,process=undefined,' +
      'require=undefined,module=undefined,exports=undefined,' +
      'localStorage=undefined,sessionStorage=undefined,' +
      'fetch=undefined,XMLHttpRequest=undefined,WebSocket=undefined,' +
      'importScripts=undefined,postMessage=undefined,' +
      // eslint-disable-next-line no-eval
      'eval=undefined,Function=undefined;\n';
    // eslint-disable-next-line no-new-func
    new Function('__step__', pre + sandbox + instrumented)(__step__);
  } catch (e: unknown) {
    return { steps, lineMap, error: (e as Error).message };
  }
  return { steps, lineMap };
}

/* ── Worker message handler ───────────────────────────────────────────── */
self.onmessage = (e: MessageEvent<{ code: string; lang: Lang }>) => {
  const result = runCode(e.data.code, e.data.lang);
  self.postMessage(result);
};
