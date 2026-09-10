/* ===========================================================================
   verify.mjs, the repeatable evidence run for "The Interference Budget".

   Usage:  node verify.mjs            (human table)
           node verify.mjs --json     (machine-readable)

   It imports the SAME engine.js that build.mjs inlines into the published
   page, so anything printed here is what the page computes. Every number in
   README.md / EVIDENCE.md is produced by this script.
   =========================================================================== */
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const MEM = require(path.join(here, "src", "engine.js"));

const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];
const pct = (x) => (100 * x).toFixed(1).padStart(5) + "%";

/** mean over seeds of f(seed) */
function mean(f) { return SEEDS.reduce((s, sd) => s + f(sd), 0) / SEEDS.length; }

function acc(N, d, sparsity, code, rule, lambda = 1) {
  return mean((sd) => {
    const set = MEM.makeSet(N, d, sparsity, code, sd);
    const S = MEM.build(set, rule, lambda, 1);
    return MEM.evaluate(S, set).acc;
  });
}
function overlap(N, d, sparsity, code) {
  return mean((sd) => MEM.meanOverlap(MEM.makeSet(N, d, sparsity, code, sd)));
}

const out = { seeds: SEEDS, generated: new Date().toISOString(), experiments: {} };
const log = [];
const say = (s) => { log.push(s); };

say("=".repeat(78));
say("THE INTERFERENCE BUDGET, evidence run");
say(`engine: src/engine.js   seeds: ${SEEDS.join(",")}   symbols: ${MEM.NSYM}`);
say("=".repeat(78));

/* --- E1. The claim's first half: fixed state, graceful degradation with N/d --- */
say("\nE1  Additive Hebbian memory, signed dense keys. Accuracy vs N at fixed d.");
say("    Prediction: accuracy is a function of the RATIO N/d, not of N alone.\n");
say("      N/d      d=64      d=128     d=256");
const e1 = {};
for (const ratio of [0.125, 0.25, 0.5, 0.75, 1.0, 1.5, 2.0]) {
  const row = [64, 128, 256].map((d) => acc(Math.round(ratio * d), d, 100, "signed", "hebb"));
  e1[ratio] = row;
  say(`     ${ratio.toFixed(3)}   ${row.map(pct).join("  ")}`);
}
out.experiments.E1_ratio_invariance = e1;

/* --- E2. The BDH module: does sparsity help, and does it need non-negativity? --- */
say("\nE2  Fixed N=96, d=128. Vary sparsity, for SIGNED vs RELU (non-negative) keys.");
say("    Prediction: sparsity alone does little for signed keys (overlap stays ~1/sqrt(d));");
say("    it helps a lot for non-negative keys, whose overlap falls with the active fraction.\n");
say("      active%   signed acc   relu acc   signed |k.k'|   relu |k.k'|");
const e2 = {};
for (const s of [100, 50, 25, 12, 6, 3]) {
  const a1 = acc(96, 128, s, "signed", "hebb"), a2 = acc(96, 128, s, "relu", "hebb");
  const o1 = overlap(96, 128, s, "signed"), o2 = overlap(96, 128, s, "relu");
  e2[s] = { signed_acc: a1, relu_acc: a2, signed_overlap: o1, relu_overlap: o2 };
  say(`      ${String(s).padStart(6)}%   ${pct(a1)}      ${pct(a2)}      ${o1.toFixed(4)}         ${o2.toFixed(4)}`);
}
out.experiments.E2_sparsity_x_code = e2;

/* --- E3. The 60-second headline test ------------------------------------ */
say("\nE3  THE 60-SECOND TEST.  N=96, d=128 held fixed. Only the key code changes.");
const before = acc(96, 128, 100, "relu", "hebb");
const after = acc(96, 128, 5, "relu", "hebb");
const oB = overlap(96, 128, 100, "relu"), oA = overlap(96, 128, 5, "relu");
say(`      dense non-negative (100% active): acc ${pct(before)}   mean overlap ${oB.toFixed(4)}`);
say(`      sparse non-negative (5% active) : acc ${pct(after)}   mean overlap ${oA.toFixed(4)}`);
say(`      state size unchanged both times : ${MEM.NSYM * 128} floats`);
out.experiments.E3_sixty_second = { dense: { acc: before, overlap: oB }, sparse: { acc: after, overlap: oA },
  state_floats: MEM.NSYM * 128 };

/* --- E4. The delta rule on the repeated-key stress test ------------------ */
say("\nE4  Update stress test. Each fact written twice; only the SECOND symbol is correct.");
say("    Prediction: pure summation cannot overwrite; the delta rule can.\n");
say("      facts   hebbian acc   (stale)    delta acc");
const e4 = {};
for (const F of [4, 8, 16, 32, 48]) {
  const h = mean((sd) => MEM.updateScore(MEM.makeUpdateSet(F, 128, 100, "signed", sd), "hebb").acc);
  const hs = mean((sd) => MEM.updateScore(MEM.makeUpdateSet(F, 128, 100, "signed", sd), "hebb").stale);
  const dl = mean((sd) => MEM.updateScore(MEM.makeUpdateSet(F, 128, 100, "signed", sd), "delta").acc);
  e4[F] = { hebb: h, hebb_stale: hs, delta: dl };
  say(`      ${String(F).padStart(5)}   ${pct(h)}       ${pct(hs)}    ${pct(dl)}`);
}
out.experiments.E4_update_stress = e4;

/* --- E5. Cost accounting ------------------------------------------------ */
say("\nE5  Memory accounting at d=128, 8-dim values (floats held).");
say("      N      linear-attention state   KV cache");
const e5 = {};
for (const N of [16, 64, 256, 1024, 4096]) {
  const st = MEM.NSYM * 128, kv = N * (128 + MEM.NSYM);
  e5[N] = { state: st, kv: kv };
  say(`      ${String(N).padStart(5)}  ${String(st).padStart(10)}             ${String(kv).padStart(8)}`);
}
out.experiments.E5_cost = e5;

/* --- E6. Determinism ---------------------------------------------------- */
const r1 = MEM.evaluate(MEM.build(MEM.makeSet(48, 96, 20, "relu", 42), "hebb", 1, 1), MEM.makeSet(48, 96, 20, "relu", 42)).acc;
const r2 = MEM.evaluate(MEM.build(MEM.makeSet(48, 96, 20, "relu", 42), "hebb", 1, 1), MEM.makeSet(48, 96, 20, "relu", 42)).acc;
say(`\nE6  Determinism check (seed 42 twice): ${r1 === r2 ? "PASS" : "FAIL"}  (${r1} vs ${r2})`);
out.experiments.E6_determinism = { pass: r1 === r2, value: r1 };

say("\n" + "=".repeat(78));
say("Caveats: keys are random, not learned, these are lower bounds on what a");
say("trained model achieves. Values are one-hot over 8 symbols. No softmax, no");
say("normalisation, no training. This is a teaching model, not BDH.");
say("=".repeat(78));

if (process.argv.includes("--json")) console.log(JSON.stringify(out, null, 2));
else console.log(log.join("\n"));
