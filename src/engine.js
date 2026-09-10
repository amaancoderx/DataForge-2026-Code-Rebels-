/* ============================================================================
   The Interference Budget, toy associative-memory engine.
   Zero dependencies. Deterministic (seeded PRNG). This exact file is inlined
   into the published page by build.mjs AND imported by verify.mjs, so the
   numbers on the page and the numbers in the evidence run share one source.

   THIS IS NOT BDH. It is a teaching model of one mechanism that BDH shares
   with the linear-attention family: an additive outer-product ("Hebbian")
   memory read by a single matrix-vector product.
   ========================================================================== */
var MEM = (function () {
  var NSYM = 8;

  function rngFrom(seed) {              // mulberry32
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function gauss(r) {
    var u = 1 - r(), v = r();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  /* One key: `nact` non-zero coordinates out of d, L2-normalised.
     code "relu"   -> strictly positive entries (BDH-style positive activations)
     code "signed" -> zero-mean gaussian entries (classic random projection)   */
  function makeKey(d, nact, code, r) {
    var k = new Float64Array(d), idx = new Int32Array(d), i, j, t;
    for (i = 0; i < d; i++) idx[i] = i;
    for (i = 0; i < nact; i++) {                       // partial Fisher-Yates
      j = i + Math.floor(r() * (d - i));
      t = idx[i]; idx[i] = idx[j]; idx[j] = t;
    }
    var ss = 0, val;
    for (i = 0; i < nact; i++) {
      val = (code === "signed") ? gauss(r) : (0.35 + 0.65 * r());
      k[idx[i]] = val; ss += val * val;
    }
    var inv = 1 / Math.sqrt(ss || 1);
    for (i = 0; i < nact; i++) k[idx[i]] *= inv;
    var act = idx.slice(0, nact);
    return { v: k, act: act };
  }

  function activeCount(d, pct) {
    return Math.max(1, Math.min(d, Math.round(d * pct / 100)));
  }

  /* A dataset of N  key -> symbol  associations. */
  function makeSet(N, d, pct, code, seed) {
    var r = rngFrom(seed), nact = activeCount(d, pct);
    var keys = [], syms = new Int32Array(N), i;
    for (i = 0; i < N; i++) {
      keys.push(makeKey(d, nact, code, r));
      syms[i] = Math.floor(r() * NSYM) % NSYM;
    }
    return { keys: keys, syms: syms, d: d, N: N, nact: nact, code: code };
  }

  /* Mean |k_i . k_j| over distinct pairs, the quantity that drives crosstalk. */
  function meanOverlap(set, cap) {
    cap = cap || 600;
    var N = set.N, s = 0, c = 0, p, q, A, B, dot, a, t;
    if (N < 2) return 0;
    for (p = 0; p < N - 1 && c < cap; p++) {
      for (q = p + 1; q < N && c < cap; q++) {
        A = set.keys[p]; B = set.keys[q]; dot = 0; a = A.act;
        for (t = 0; t < a.length; t++) dot += A.v[a[t]] * B.v[a[t]];
        s += Math.abs(dot); c++;
      }
    }
    return c ? s / c : 0;
  }

  function newState(d) { return new Float64Array(NSYM * d); }

  /* Read: one matrix-vector product. Keys are unit-norm, so k.k = 1. */
  function read(S, key, d, out) {
    out = out || new Float64Array(NSYM);
    var a = key.act, v = key.v, c, t, acc;
    for (c = 0; c < NSYM; c++) {
      acc = 0;
      for (t = 0; t < a.length; t++) acc += S[c * d + a[t]] * v[a[t]];
      out[c] = acc;
    }
    return out;
  }

  /* One write.
     rule "hebb"  :  S <- lambda S + v k^T          (pure accumulation)
     rule "delta" :  S <- lambda S + beta (v - Sk) k^T   (error-correcting)   */
  var _scratch = new Float64Array(NSYM);
  function write(S, key, sym, d, rule, lambda, beta) {
    var i, c, t, a = key.act, v = key.v;
    if (lambda !== 1) for (i = 0; i < S.length; i++) S[i] *= lambda;
    if (rule === "delta") {
      var yh = read(S, key, d, _scratch), e;
      for (c = 0; c < NSYM; c++) {
        e = beta * (((c === sym) ? 1 : 0) - yh[c]);
        if (e === 0) continue;
        for (t = 0; t < a.length; t++) S[c * d + a[t]] += e * v[a[t]];
      }
    } else {
      for (t = 0; t < a.length; t++) S[sym * d + a[t]] += v[a[t]];
    }
  }

  /* Top-1 accuracy + mean margin (true score / best competitor) over pairs 0..upto. */
  function evaluate(S, set, upto) {
    var d = set.d, n = (upto === undefined) ? set.N : upto;
    var ok = 0, marg = 0, i, c, sc, best, bestc, second, tru, comp;
    var o = new Float64Array(NSYM);
    for (i = 0; i < n; i++) {
      read(S, set.keys[i], d, o);
      best = -Infinity; bestc = -1; second = -Infinity;
      for (c = 0; c < NSYM; c++) {
        sc = o[c];
        if (sc > best) { second = best; best = sc; bestc = c; }
        else if (sc > second) second = sc;
      }
      if (bestc === set.syms[i]) ok++;
      tru = o[set.syms[i]];
      comp = (bestc === set.syms[i]) ? second : best;
      marg += (Math.abs(comp) > 1e-12) ? (tru / Math.abs(comp)) : (tru > 0 ? 4 : 0);
    }
    return { acc: n ? ok / n : 1, margin: n ? marg / n : 0, n: n };
  }

  /* Build the state over the first `upto` writes, from scratch. */
  function build(set, rule, lambda, beta, upto) {
    var n = (upto === undefined) ? set.N : upto, S = newState(set.d), i;
    for (i = 0; i < n; i++) write(S, set.keys[i], set.syms[i], set.d, rule, lambda, beta);
    return S;
  }

  /* Accuracy-vs-writes curve. One incremental pass, sampled at ~`pts` points. */
  function curve(set, rule, lambda, beta, pts) {
    pts = pts || 48;
    var S = newState(set.d), stride = Math.max(1, Math.ceil(set.N / pts));
    var xs = [], ys = [], i;
    for (i = 0; i < set.N; i++) {
      write(S, set.keys[i], set.syms[i], set.d, rule, lambda, beta);
      if ((i + 1) % stride === 0 || i === set.N - 1) {
        xs.push(i + 1); ys.push(evaluate(S, set, i + 1).acc);
      }
    }
    return { xs: xs, ys: ys };
  }

  /* ---- Lab 2 ---------------------------------------------------------------
     Every fact is written twice; the second write is a CORRECTION with a
     different symbol. Only the second symbol is the right answer. Pure
     summation structurally cannot represent this; the delta rule can.       */
  function makeUpdateSet(F, d, pct, code, seed) {
    var r = rngFrom(seed), nact = activeCount(d, pct);
    var keys = [], s1 = new Int32Array(F), s2 = new Int32Array(F), i;
    for (i = 0; i < F; i++) {
      keys.push(makeKey(d, nact, code, r));
      s1[i] = Math.floor(r() * NSYM) % NSYM;
      s2[i] = (s1[i] + 1 + Math.floor(r() * (NSYM - 1))) % NSYM;   // always differs
    }
    return { keys: keys, s1: s1, s2: s2, F: F, d: d, nact: nact, code: code };
  }
  function updateScore(us, rule, upto) {
    var F = (upto === undefined) ? us.F : upto, d = us.d, S = newState(d), i;
    for (i = 0; i < F; i++) write(S, us.keys[i], us.s1[i], d, rule, 1, 1);  // originals
    for (i = 0; i < F; i++) write(S, us.keys[i], us.s2[i], d, rule, 1, 1);  // corrections
    var ok = 0, stale = 0, o = new Float64Array(NSYM), c, best, bestc;
    for (i = 0; i < F; i++) {
      read(S, us.keys[i], d, o); best = -Infinity; bestc = -1;
      for (c = 0; c < NSYM; c++) if (o[c] > best) { best = o[c]; bestc = c; }
      if (bestc === us.s2[i]) ok++; else if (bestc === us.s1[i]) stale++;
    }
    return { acc: F ? ok / F : 1, stale: F ? stale / F : 0, n: F };
  }
  function updateCurve(us, rule, pts) {
    pts = pts || 26;
    var stride = Math.max(1, Math.ceil(us.F / pts)), xs = [], ys = [], f;
    for (f = stride; f <= us.F; f += stride) { xs.push(f); ys.push(updateScore(us, rule, f).acc); }
    if (xs.length === 0 || xs[xs.length - 1] !== us.F) {
      xs.push(us.F); ys.push(updateScore(us, rule, us.F).acc);
    }
    return { xs: xs, ys: ys };
  }

  return {
    NSYM: NSYM, rngFrom: rngFrom, makeSet: makeSet, makeUpdateSet: makeUpdateSet,
    meanOverlap: meanOverlap, build: build, read: read, write: write, newState: newState,
    evaluate: evaluate, curve: curve, updateScore: updateScore, updateCurve: updateCurve,
    activeCount: activeCount
  };
})();
if (typeof module !== "undefined" && module.exports) module.exports = MEM;
