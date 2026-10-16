// A stand-in 2D context for tests: it keeps the transform the way a browser does (with a
// save/restore stack) and records what was drawn, with the transform at the time.
export interface Matrix {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

export interface Drawn {
  op: string;
  args: unknown[];
  matrix: Matrix;
  alpha: number;
  composite: string;
  style: unknown;
}

const IDENTITY: Matrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

function multiply(m: Matrix, n: Matrix): Matrix {
  return {
    a: m.a * n.a + m.c * n.b,
    b: m.b * n.a + m.d * n.b,
    c: m.a * n.c + m.c * n.d,
    d: m.b * n.c + m.d * n.d,
    e: m.a * n.e + m.c * n.f + m.e,
    f: m.b * n.e + m.d * n.f + m.f,
  };
}

export class FakeContext {
  matrix: Matrix = { ...IDENTITY };
  private stack: { matrix: Matrix; alpha: number; composite: string }[] = [];
  depth = 0;
  maxDepth = 0;
  drawn: Drawn[] = [];
  globalAlpha = 1;
  globalCompositeOperation = 'source-over';
  fillStyle: unknown = '#000';
  strokeStyle: unknown = '#000';
  lineWidth = 1;
  lineCap = 'butt';
  lineJoin = 'miter';
  font = '10px sans-serif';
  textAlign = 'start';
  textBaseline = 'alphabetic';

  private record(op: string, args: unknown[], style: unknown) {
    this.drawn.push({ op, args, matrix: { ...this.matrix }, alpha: this.globalAlpha, composite: this.globalCompositeOperation, style });
  }

  save() {
    this.stack.push({ matrix: { ...this.matrix }, alpha: this.globalAlpha, composite: this.globalCompositeOperation });
    this.depth++;
    this.maxDepth = Math.max(this.maxDepth, this.depth);
  }
  restore() {
    const top = this.stack.pop();
    if (!top) throw new Error('restore without save');
    this.depth--;
    this.matrix = top.matrix;
    this.globalAlpha = top.alpha;
    this.globalCompositeOperation = top.composite;
  }
  translate(x: number, y: number) {
    this.matrix = multiply(this.matrix, { a: 1, b: 0, c: 0, d: 1, e: x, f: y });
  }
  rotate(r: number) {
    const c = Math.cos(r);
    const s = Math.sin(r);
    this.matrix = multiply(this.matrix, { a: c, b: s, c: -s, d: c, e: 0, f: 0 });
  }
  scale(x: number, y: number) {
    this.matrix = multiply(this.matrix, { a: x, b: 0, c: 0, d: y, e: 0, f: 0 });
  }
  setTransform(a: number | Matrix, b?: number, c?: number, d?: number, e?: number, f?: number) {
    this.matrix = typeof a === 'number' ? { a, b: b ?? 0, c: c ?? 0, d: d ?? 1, e: e ?? 0, f: f ?? 0 } : { ...a };
  }
  getTransform(): Matrix {
    return { ...this.matrix };
  }
  drawImage(...args: unknown[]) {
    this.record('drawImage', args, null);
  }
  fillRect(...args: unknown[]) {
    this.record('fillRect', args, this.fillStyle);
  }
  strokeRect(...args: unknown[]) {
    this.record('strokeRect', args, this.strokeStyle);
  }
  fill(...args: unknown[]) {
    this.record('fill', args, this.fillStyle);
  }
  stroke(...args: unknown[]) {
    this.record('stroke', args, this.strokeStyle);
  }
  fillText(...args: unknown[]) {
    this.record('fillText', args, this.fillStyle);
  }
  strokeText(...args: unknown[]) {
    this.record('strokeText', args, this.strokeStyle);
  }
  beginPath() {}
  moveTo() {}
  lineTo() {}
  arc() {}
}
