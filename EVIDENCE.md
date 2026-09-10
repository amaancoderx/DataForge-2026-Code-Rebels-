# EVIDENCE, repeatable run

Regenerate with `node verify.mjs` (Node 18+, no dependencies).
This script imports `src/engine.js`, the same file `build.mjs` inlines into the published page,
so these numbers and the artifact's numbers come from one implementation.

```
==============================================================================
THE INTERFERENCE BUDGET, evidence run
engine: src/engine.js   seeds: 1,2,3,4,5,6,7,8   symbols: 8
==============================================================================

E1  Additive Hebbian memory, signed dense keys. Accuracy vs N at fixed d.
    Prediction: accuracy is a function of the RATIO N/d, not of N alone.

      N/d      d=64      d=128     d=256
     0.125   100.0%  100.0%  100.0%
     0.250   100.0%  100.0%   99.8%
     0.500    98.0%   97.3%   98.0%
     0.750    95.3%   94.5%   93.1%
     1.000    88.1%   88.8%   89.1%
     1.500    77.7%   81.2%   80.3%
     2.000    69.8%   72.1%   70.4%

E2  Fixed N=96, d=128. Vary sparsity, for SIGNED vs RELU (non-negative) keys.
    Prediction: sparsity alone does little for signed keys (overlap stays ~1/sqrt(d));
    it helps a lot for non-negative keys, whose overlap falls with the active fraction.

      active%   signed acc   relu acc   signed |k.k'|   relu |k.k'|
         100%    94.5%       20.3%      0.0705         0.9287
          50%    93.9%       26.6%      0.0700         0.4641
          25%    94.0%       50.4%      0.0690         0.2326
          12%    94.0%       72.0%      0.0570         0.1105
           6%    93.1%       86.5%      0.0395         0.0591
           3%    94.4%       90.8%      0.0210         0.0322

E3  THE 60-SECOND TEST.  N=96, d=128 held fixed. Only the key code changes.
      dense non-negative (100% active): acc  20.3%   mean overlap 0.9287
      sparse non-negative (5% active) : acc  87.4%   mean overlap 0.0436
      state size unchanged both times : 1024 floats

E4  Update stress test. Each fact written twice; only the SECOND symbol is correct.
    Prediction: pure summation cannot overwrite; the delta rule can.

      facts   hebbian acc   (stale)    delta acc
          4    50.0%        50.0%    100.0%
          8    53.1%        46.9%    100.0%
         16    43.8%        56.3%    100.0%
         32    48.4%        51.6%     96.9%
         48    50.8%        49.0%     94.3%

E5  Memory accounting at d=128, 8-dim values (floats held).
      N      linear-attention state   KV cache
         16        1024                 2176
         64        1024                 8704
        256        1024                34816
       1024        1024               139264
       4096        1024               557056

E6  Determinism check (seed 42 twice): PASS  (0.7916666666666666 vs 0.7916666666666666)

==============================================================================
Caveats: keys are random, not learned, these are lower bounds on what a
trained model achieves. Values are one-hot over 8 symbols. No softmax, no
normalisation, no training. This is a teaching model, not BDH.
==============================================================================
```
