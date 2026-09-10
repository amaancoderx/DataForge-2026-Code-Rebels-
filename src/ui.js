/* ============================================================================
   ui.js, controls, canvas rendering and the quiz for "The Interference Budget".
   Depends only on MEM (src/engine.js). No libraries, no network.
   ========================================================================== */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var SYM = ["A", "B", "C", "D", "E", "F", "G", "H"];

  /* ---- theme-aware palette, re-read whenever the theme changes ---------- */
  var C = {};
  function palette() {
    var cs = getComputedStyle(document.body);
    var g = function (n) { return cs.getPropertyValue(n).trim(); };
    C = {
      ink: g("--ink"), ink2: g("--ink2"), ink3: g("--ink3"),
      line: g("--line"), line2: g("--line2"), panel: g("--panel"), bg: g("--bg"),
      accent: g("--accent"), good: g("--good"), bad: g("--bad"), warn: g("--warn")
    };
  }

  /* ---- canvas helper: DPR-correct sizing -------------------------------- */
  function ctxFor(cv, cssH) {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = cv.clientWidth || 600, h = cssH;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    }
    cv.style.height = h + "px";
    var x = cv.getContext("2d");
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    x.clearRect(0, 0, w, h);
    return { x: x, w: w, h: h };
  }
  function font(x, px, weight) {
    x.font = (weight || 500) + " " + px + 'px ui-monospace,"SF Mono",Consolas,monospace';
  }

  /* ---- state ------------------------------------------------------------ */
  var st = { N: 24, d: 64, s: 100, lam: 1, rule: "hebb", code: "signed", q: 1, seed: 7 };
  var DEFAULTS = JSON.parse(JSON.stringify(st));

  /* ======================= LAB 1 ========================================= */
  function renderLab1() {
    var set = MEM.makeSet(st.N, st.d, st.s, st.code, st.seed);
    var S = MEM.build(set, st.rule, st.lam, 1);
    var ev = MEM.evaluate(S, set);
    var ov = MEM.meanOverlap(set);

    /* stats */
    var a = $("sAcc"); a.textContent = (100 * ev.acc).toFixed(1) + "%";
    a.className = "v " + (ev.acc > 0.9 ? "ok" : ev.acc > 0.6 ? "mid" : "no");
    $("sAccS").innerHTML = "top-1 over " + set.N + " pairs &middot; margin &times;" + ev.margin.toFixed(2);
    $("sSnr").textContent = ov.toFixed(3);
    $("sSnr").className = "v " + (ov < 0.12 ? "ok" : ov < 0.35 ? "mid" : "no");
    $("sState").textContent = (MEM.NSYM * st.d).toLocaleString();
    $("sKv").textContent = (st.N * (st.d + MEM.NSYM)).toLocaleString();

    /* bars: truth beside estimate */
    var qi = Math.min(st.q, st.N) - 1;
    $("qlab").textContent = "#" + (qi + 1);
    var scores = MEM.read(S, set.keys[qi], st.d);
    drawBars($("cvBars"), scores, set.syms[qi]);

    /* heatmap of S */
    drawHeat($("cvHeat"), S, st.d);

    /* curve: current settings vs dense signed baseline */
    var cur = MEM.curve(set, st.rule, st.lam, 1, 48);
    var baseSet = MEM.makeSet(st.N, st.d, 100, "signed", st.seed);
    var base = MEM.curve(baseSet, "hebb", 1, 1, 48);
    drawCurve($("cvCurve"), [
      { xs: base.xs, ys: base.ys, col: C.ink3, dash: [4, 4] },
      { xs: cur.xs, ys: cur.ys, col: C.accent, dash: null }
    ], st.d, st.N);
  }

  function drawBars(cv, scores, truth) {
    var o = ctxFor(cv, 300), x = o.x, w = o.w, h = o.h;
    var padL = 34, padR = 12, padT = 26, padB = 30;
    var iw = w - padL - padR, ih = h - padT - padB;
    var best = -Infinity, bi = 0, i, mx = 0;
    for (i = 0; i < scores.length; i++) {
      if (scores[i] > best) { best = scores[i]; bi = i; }
      mx = Math.max(mx, Math.abs(scores[i]));
    }
    mx = Math.max(mx, 1e-6);
    var bw = iw / scores.length, zero = padT + ih / 2;

    x.strokeStyle = C.line; x.lineWidth = 1;
    x.beginPath(); x.moveTo(padL, zero + .5); x.lineTo(w - padR, zero + .5); x.stroke();

    for (i = 0; i < scores.length; i++) {
      var bh = (scores[i] / mx) * (ih / 2 - 6);
      var bx = padL + i * bw + bw * 0.18, bwid = bw * 0.64;
      var correct = (i === truth), winner = (i === bi);
      x.fillStyle = correct ? C.good : (winner ? C.bad : C.accent);
      x.globalAlpha = correct || winner ? 1 : 0.42;
      if (bh >= 0) x.fillRect(bx, zero - bh, bwid, bh);
      else x.fillRect(bx, zero, bwid, -bh);
      x.globalAlpha = 1;
      font(x, 11, correct ? 700 : 500);
      x.fillStyle = correct ? C.good : (winner ? C.bad : C.ink3);
      x.textAlign = "center";
      x.fillText(SYM[i], bx + bwid / 2, h - 12);
    }
    font(x, 11, 600); x.textAlign = "left";
    x.fillStyle = C.ink3;
    x.fillText("score", 4, padT - 12);
    x.textAlign = "right";
    var okk = (bi === truth);
    x.fillStyle = okk ? C.good : C.bad;
    x.fillText(okk ? "✓ correct, truth " + SYM[truth]
                   : "✗ returned " + SYM[bi] + ", truth " + SYM[truth], w - padR, padT - 12);
  }

  function drawHeat(cv, S, d) {
    var o = ctxFor(cv, 300), x = o.x, w = o.w, h = o.h;
    var padL = 26, padT = 22, padB = 22, padR = 8;
    var iw = w - padL - padR, ih = h - padT - padB;
    var rows = MEM.NSYM, cw = iw / d, rh = ih / rows;
    var mx = 1e-9, i;
    for (i = 0; i < S.length; i++) mx = Math.max(mx, Math.abs(S[i]));
    var r, c, v, t;
    for (r = 0; r < rows; r++) {
      for (c = 0; c < d; c++) {
        v = S[r * d + c] / mx;
        if (v >= 0) { t = v; x.fillStyle = "rgba(79,47,214," + (0.06 + 0.94 * t) + ")"; }
        else { t = -v; x.fillStyle = "rgba(194,55,43," + (0.06 + 0.94 * t) + ")"; }
        x.fillRect(padL + c * cw, padT + r * rh, Math.max(cw, 0.6), rh - 0.5);
      }
      font(x, 10, 600); x.fillStyle = C.ink3; x.textAlign = "right";
      x.fillText(SYM[r], padL - 6, padT + r * rh + rh / 2 + 3);
    }
    x.strokeStyle = C.line; x.lineWidth = 1;
    x.strokeRect(padL + .5, padT + .5, iw - 1, ih - 1);
    font(x, 10, 500); x.fillStyle = C.ink3; x.textAlign = "left";
    x.fillText("neuron 0", padL, h - 7);
    x.textAlign = "right";
    x.fillText("neuron " + (d - 1), w - padR, h - 7);
    x.textAlign = "left";
    x.fillText("rows = the 8 symbols   ·   max |S| = " + mx.toFixed(2), padL, padT - 8);
  }

  function drawCurve(cv, series, d, N) {
    var o = ctxFor(cv, 250), x = o.x, w = o.w, h = o.h;
    var padL = 44, padR = 14, padT = 18, padB = 34;
    var iw = w - padL - padR, ih = h - padT - padB;
    var X = function (v) { return padL + (v / Math.max(N, 1)) * iw; };
    var Y = function (v) { return padT + (1 - v) * ih; };

    /* gridlines */
    x.strokeStyle = C.line; x.lineWidth = 1;
    font(x, 10, 500); x.fillStyle = C.ink3; x.textAlign = "right";
    [0, .25, .5, .75, 1].forEach(function (g) {
      x.beginPath(); x.moveTo(padL, Y(g) + .5); x.lineTo(w - padR, Y(g) + .5); x.stroke();
      x.fillText((100 * g).toFixed(0) + "%", padL - 7, Y(g) + 3);
    });
    /* chance line */
    x.strokeStyle = C.line2; x.setLineDash([2, 3]);
    x.beginPath(); x.moveTo(padL, Y(1 / MEM.NSYM) + .5); x.lineTo(w - padR, Y(1 / MEM.NSYM) + .5); x.stroke();
    x.setLineDash([]);
    x.textAlign = "left"; x.fillStyle = C.ink3;
    x.fillText("chance", padL + 4, Y(1 / MEM.NSYM) - 4);

    /* N = d marker */
    if (d <= N) {
      x.strokeStyle = C.bad; x.setLineDash([3, 3]); x.globalAlpha = .7;
      x.beginPath(); x.moveTo(X(d), padT); x.lineTo(X(d), padT + ih); x.stroke();
      x.setLineDash([]); x.globalAlpha = 1;
      x.fillStyle = C.bad; x.textAlign = "left";
      x.fillText("N = d", X(d) + 4, padT + 10);
    }

    series.forEach(function (s) {
      if (!s.xs.length) return;
      x.strokeStyle = s.col; x.lineWidth = 2; x.lineJoin = "round";
      if (s.dash) x.setLineDash(s.dash);
      x.beginPath();
      for (var i = 0; i < s.xs.length; i++) {
        var px = X(s.xs[i]), py = Y(s.ys[i]);
        if (i === 0) x.moveTo(px, py); else x.lineTo(px, py);
      }
      x.stroke(); x.setLineDash([]);
    });

    x.fillStyle = C.ink3; font(x, 10, 500);
    x.textAlign = "center";
    x.fillText("pairs written →  (N = " + N + ",  d = " + d + ")", padL + iw / 2, h - 9);
  }

  /* ======================= LAB 2 ========================================= */
  var st2 = { F: 12, s: 100 };
  function renderLab2() {
    var us = MEM.makeUpdateSet(st2.F, 128, st2.s, "signed", st.seed);
    var hb = MEM.updateScore(us, "hebb"), dl = MEM.updateScore(us, "delta");
    var eh = $("sHeb"), ed = $("sDel");
    eh.textContent = (100 * hb.acc).toFixed(0) + "%";
    eh.className = "v " + (hb.acc > 0.9 ? "ok" : hb.acc > 0.6 ? "mid" : "no");
    ed.textContent = (100 * dl.acc).toFixed(0) + "%";
    ed.className = "v " + (dl.acc > 0.9 ? "ok" : dl.acc > 0.6 ? "mid" : "no");
    $("sState2").textContent = (MEM.NSYM * 128).toLocaleString();

    var ch = MEM.updateCurve(us, "hebb", 22), cd = MEM.updateCurve(us, "delta", 22);
    drawCurve2($("cvCurve2"), ch, cd, st2.F);
  }
  function drawCurve2(cv, a, b, F) {
    var o = ctxFor(cv, 240), x = o.x, w = o.w, h = o.h;
    var padL = 44, padR = 14, padT = 16, padB = 32;
    var iw = w - padL - padR, ih = h - padT - padB;
    var X = function (v) { return padL + (v / Math.max(F, 1)) * iw; };
    var Y = function (v) { return padT + (1 - v) * ih; };
    x.strokeStyle = C.line; x.lineWidth = 1; font(x, 10, 500);
    x.fillStyle = C.ink3; x.textAlign = "right";
    [0, .5, 1].forEach(function (g) {
      x.beginPath(); x.moveTo(padL, Y(g) + .5); x.lineTo(w - padR, Y(g) + .5); x.stroke();
      x.fillText((100 * g).toFixed(0) + "%", padL - 7, Y(g) + 3);
    });
    [[a, C.bad], [b, C.good]].forEach(function (p) {
      var s = p[0]; if (!s.xs.length) return;
      x.strokeStyle = p[1]; x.lineWidth = 2.2; x.lineJoin = "round"; x.beginPath();
      for (var i = 0; i < s.xs.length; i++) {
        var px = X(s.xs[i]), py = Y(s.ys[i]);
        if (i === 0) x.moveTo(px, py); else x.lineTo(px, py);
      }
      x.stroke();
    });
    x.fillStyle = C.ink3; x.textAlign = "center"; font(x, 10, 500);
    x.fillText("facts, each written twice →", padL + iw / 2, h - 9);
  }

  /* ======================= wiring ======================================== */
  var raf = null;
  function schedule() {
    if (raf) return;
    raf = requestAnimationFrame(function () { raf = null; renderLab1(); renderLab2(); });
  }
  function slider(id, lab, fmt, set) {
    var el = $(id);
    if (!el) return;
    var upd = function () { $(lab).textContent = fmt(+el.value); set(+el.value); schedule(); };
    el.addEventListener("input", upd);
    upd();
  }
  function segment(id, set) {
    var seg = $(id); if (!seg) return;
    seg.addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b) return;
      Array.prototype.forEach.call(seg.querySelectorAll("button"), function (o) {
        o.setAttribute("aria-pressed", String(o === b));
      });
      set(b.dataset.v); schedule();
    });
  }

  function syncQMax() {
    var q = $("cQ"); q.max = String(st.N);
    if (+q.value > st.N) { q.value = String(st.N); st.q = st.N; $("vQ").textContent = st.N; }
  }

  function init() {
    palette();
    slider("cN", "vN", function (v) { return v; }, function (v) { st.N = v; syncQMax(); });
    slider("cD", "vD", function (v) { return v; }, function (v) { st.d = v; });
    slider("cS", "vS", function (v) { return v + "%"; }, function (v) { st.s = v; });
    slider("cL", "vL", function (v) { return (v / 1000).toFixed(3); }, function (v) { st.lam = v / 1000; });
    slider("cQ", "vQ", function (v) { return v; }, function (v) { st.q = v; });
    segment("segRule", function (v) { st.rule = v; });
    segment("segCode", function (v) { st.code = v; });
    slider("cN2", "vN2", function (v) { return v; }, function (v) { st2.F = v; });
    slider("cS2", "vS2", function (v) { return v + "%"; }, function (v) { st2.s = v; });

    $("btnSeed").addEventListener("click", function () {
      st.seed = (Math.random() * 1e9) | 0; schedule();
    });
    $("btnReset").addEventListener("click", function () {
      st = JSON.parse(JSON.stringify(DEFAULTS));
      $("cN").value = st.N; $("cD").value = st.d; $("cS").value = st.s;
      $("cL").value = 1000; $("cQ").value = 1;
      ["segRule", "segCode"].forEach(function (sid) {
        Array.prototype.forEach.call($(sid).querySelectorAll("button"), function (b, i) {
          b.setAttribute("aria-pressed", String(i === 0));
        });
      });
      $("vN").textContent = st.N; $("vD").textContent = st.d;
      $("vS").textContent = st.s + "%"; $("vL").textContent = "1.000"; $("vQ").textContent = "1";
      syncQMax(); schedule();
    });

    /* the 60-second test: script the two states, narrate, land on the payoff */
    $("btn60").addEventListener("click", function () {
      document.getElementById("lab1").scrollIntoView({ behavior: "smooth", block: "start" });
      var steps = [
        { N: 96, d: 128, s: 100, code: "signed", msg: "1/3  N=96, d=128, signed keys. This works." },
        { N: 96, d: 128, s: 100, code: "relu", msg: "2/3  Same N, same d, same state size, only the code is now non-negative. It collapses." },
        { N: 96, d: 128, s: 5, code: "relu", msg: "3/3  Still the same N and d. Sparsify to 5% and it comes back." }
      ];
      var i = 0;
      (function step() {
        if (i >= steps.length) { $("btn60").textContent = "↻  Run it again"; return; }
        var s = steps[i++];
        st.N = s.N; st.d = s.d; st.s = s.s; st.code = s.code;
        $("cN").value = s.N; $("vN").textContent = s.N;
        $("cD").value = s.d; $("vD").textContent = s.d;
        $("cS").value = s.s; $("vS").textContent = s.s + "%";
        Array.prototype.forEach.call($("segCode").querySelectorAll("button"), function (b) {
          b.setAttribute("aria-pressed", String(b.dataset.v === s.code));
        });
        syncQMax(); renderLab1(); renderLab2();
        $("btn60").textContent = s.msg;
        setTimeout(step, 2600);
      })();
    });
    $("btnjump").addEventListener("click", function () {
      document.getElementById("sandbox").scrollIntoView({ behavior: "smooth", block: "start" });
    });

    buildQuiz();
    schedule();

    window.addEventListener("resize", schedule);
    var mq = window.matchMedia("(prefers-color-scheme: dark)");
    (mq.addEventListener ? mq.addEventListener.bind(mq, "change") : mq.addListener.bind(mq))(function () {
      palette(); schedule();
    });
  }

  /* ======================= quiz ========================================== */
  var QS = [
    {
      q: "You store 40 pairs in d=64 and get 96% recall. You now need to store 80 pairs. What single change most reliably restores 96%, assuming a signed dense code?",
      opts: [
        "Double d to 128, keeping the code and rule the same",
        "Add a second state matrix and average the two reads",
        "Set the decay λ to 0.95 so old memories fade",
        "Nothing, 80 pairs exceeds the matrix's storage capacity"
      ],
      right: 0,
      exp: "Accuracy tracks the ratio N/d, so doubling both N and d holds it roughly constant, experiment E1 shows the same numbers at d=64, 128 and 256. The last option is the misconception this page exists to kill: nothing 'ran out of space'. The state holds 8×d floats no matter how many pairs you write; what degrades is separability, not capacity."
    },
    {
      q: "A colleague says: 'BDH gets its interference control from sparsity, so let's sparsify our signed linear-attention keys to 5% and get the same benefit.' What is wrong with this?",
      opts: [
        "Sparsity only reduces overlap when the code is also non-negative; with signed keys the shared terms cancel anyway and overlap stays near 1/√d",
        "Sparsity would reduce overlap, but the state matrix gets too small to hold the memories",
        "Nothing is wrong, sparsity reduces overlap identically for signed and non-negative codes",
        "BDH does not use sparsity; it uses a delta rule"
      ],
      right: 0,
      exp: "This is the result in Act III. Sparsifying signed keys from 100% to 3% moves accuracy 94.5% → 94.4%, nothing. Sparsifying non-negative keys over the same range moves it 20.3% → 90.8%. Sparsity and non-negativity only pay off as a pair, which is why BDH-GPU's framing puts 'positive activation vectors' and its ReLU-lowrank structure together. And BDH does not use a delta rule: its published update (Eq. 7/16) is a purely additive decayed sum of outer products."
    },
    {
      q: "In the repeated-key test, pure Hebbian writing scores about 50% rather than degrading smoothly toward chance (12.5%). Why 50% specifically?",
      opts: [
        "The state holds both the stale value and the correction with equal weight, so the read is a near-tie broken by crosstalk noise, a coin flip between two specific symbols",
        "Half the writes are dropped because the matrix saturates",
        "The decay term λ halves the older write",
        "It is a coincidence of the 8-symbol vocabulary"
      ],
      right: 0,
      exp: "Both writes add the same key vector into two different rows of S with the same magnitude, so querying that key returns two roughly equal scores. The winner is decided by whatever crosstalk from other memories happens to break the tie, hence ~50%, split between correct and stale, which is exactly what the 'stale' column reports. The delta rule scores ~100% here because it subtracts the stale value as part of the second write, leaving nothing to tie with."
    }
  ];
  function buildQuiz() {
    var host = $("quiz");
    QS.forEach(function (Q, qi) {
      var d = document.createElement("div"); d.className = "q";
      var t = document.createElement("div"); t.className = "qt";
      t.textContent = (qi + 1) + ". " + Q.q; d.appendChild(t);
      var o = document.createElement("div"); o.className = "opts";
      var exp = document.createElement("div"); exp.className = "exp"; exp.hidden = true;
      exp.textContent = Q.exp;
      Q.opts.forEach(function (txt, i) {
        var b = document.createElement("button");
        b.type = "button"; b.textContent = txt;
        b.addEventListener("click", function () {
          Array.prototype.forEach.call(o.children, function (c) { c.disabled = true; });
          b.className = (i === Q.right) ? "right" : "wrong";
          if (i !== Q.right) o.children[Q.right].className = "right";
          exp.hidden = false;
        });
        o.appendChild(b);
      });
      d.appendChild(o); d.appendChild(exp); host.appendChild(d);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
