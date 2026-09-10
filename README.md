<div align="center">

# 🧠 The Interference Budget

### What a fixed-size memory actually trades away

*An interactive explainer on synaptic plasticity, linear attention, and why Dragon Hatchling is built the way it is.*

<br>

[![Track](https://img.shields.io/badge/DataForge_2026-Pathway_Track-4f2fd6?style=for-the-badge)](https://unstop.com/hackathons/dataforge-2026-iit-kharagpur-1739346)
[![Team](https://img.shields.io/badge/Team-Code_Rebels-141518?style=for-the-badge)](#-team)
[![Live](https://img.shields.io/badge/live-open_the_explainer-0f8a5f?style=for-the-badge)](https://claude.ai/code/artifact/fe15b579-7994-4778-8e59-ad54e5b0b09b)
[![Repo](https://img.shields.io/badge/source-GitHub-141518?style=for-the-badge&logo=github)](https://github.com/amaancoderx/DataForge-2026-Code-Rebels-)

[![Dependencies](https://img.shields.io/badge/dependencies-0-0f8a5f?style=flat-square)](#-architecture)
[![Network calls](https://img.shields.io/badge/network_calls-0-0f8a5f?style=flat-square)](#-architecture)
[![Reproducible](https://img.shields.io/badge/evidence-node_verify.mjs-4f2fd6?style=flat-square)](EVIDENCE.md)
[![Code](https://img.shields.io/badge/code-MIT-blue?style=flat-square)](LICENSE)
[![Prose](https://img.shields.io/badge/prose-CC_BY_4.0-blue?style=flat-square)](LICENSE)

<br>

**[▶ Open the explainer](https://claude.ai/code/artifact/fe15b579-7994-4778-8e59-ad54e5b0b09b)** &nbsp;·&nbsp;
**[🪞 Mirror (GitHub Pages)](https://amaancoderx.github.io/DataForge-2026-Code-Rebels-/)** &nbsp;·&nbsp;
**[💻 Source repository](https://github.com/amaancoderx/DataForge-2026-Code-Rebels-)** &nbsp;·&nbsp;
**[📄 Concept summary (PDF)](concept-summary.pdf)** &nbsp;·&nbsp;
**[🔬 Evidence run](EVIDENCE.md)** &nbsp;·&nbsp;
**[⚡ 60-second test](#-the-60-second-test)**

</div>

<br>

> [!IMPORTANT]
> **The one sentence this explainer teaches, and lets you falsify.**
>
> A fixed-size synaptic state stores associations by **summing** outer products, so it absorbs an unbounded
> stream without allocating a slot per token. But every memory then shares one matrix, and retrieval is
> corrupted by a crosstalk term set by the **overlap between keys**. Two consequences you can force the
> artifact to admit or refute: accuracy depends on the ratio `N/d` rather than on `N`; and sparsifying the
> keys rescues accuracy **only if the code is also non-negative**, which is precisely the pairing BDH's
> positive activations commit to.

It is falsifiable in both directions. If capacity rather than overlap were the constraint, holding `N/d` fixed
while scaling both would not preserve accuracy. It does. If sparsity were independently useful, sparsifying a
signed code would help. It does not: 94.5% goes to 94.4%.

<br>

---

## ⚡ The 60-second test

Press **Run the 60-second test** on the artifact. It scripts three states with `N=96, d=128` and the state
size pinned at 1024 floats the whole way through.

| Step | Configuration | Recall | Mean key overlap |
|:--|:--|--:|--:|
| 1 | Signed keys, 100% active | **94.5%** | 0.070 |
| 2 | Non-negative keys, 100% active | **20.3%** | 0.929 |
| 3 | Non-negative keys, 5% active | **87.4%** | 0.044 |

`N` never changed. `d` never changed. The state never changed size. Only the *code* changed. That is the
whole lesson, and it is why BDH-GPU pairs ReLU non-negativity with roughly 5% sparsity rather than treating
either as an independent tuning knob.

<br>

## 🎯 Who this is for

| | |
|:--|:--|
| **Audience** | Anyone who can read `softmax(QKᵀ)V` and knows what a KV cache is |
| **Prerequisites** | Matrix-vector products, outer products, cosine similarity |
| **Not required** | Any prior exposure to linear attention, fast weights, SSMs, or BDH |
| **Time** | About 10 minutes end to end, or 60 seconds for the core result |
| **Setup** | None. Opens in a browser, no sign-in, no install |

### Learning objectives

After working through the artifact, a learner should be able to:

1. Write the crosstalk decomposition `S kᵢ = vᵢ(kᵢ·kᵢ) + Σⱼ≠ᵢ vⱼ(kⱼ·kᵢ)` and say which term is the bug.
2. Predict the effect of doubling `N`, doubling `d`, or doubling both, and be right.
3. Explain why sparsity is useless for a signed code and decisive for a non-negative one.
4. State where BDH sits: additive Hebbian `σ`, controlled by sparse positive activations, **not** by a delta rule.
5. Name one thing the artifact cannot show, and one BDH claim whose evidence is weaker than it sounds.

<br>

## 🏗 Architecture

```
submission/
├── index.html          standalone build, double-click to open
├── artifact.html       body-fragment build, for hosting
├── concept-summary.pdf the one-page concept summary (also shipped as blog.pdf)
├── EVIDENCE.md         output of the evidence run, regenerate any time
├── build.mjs           inlines engine + ui into both builds
├── verify.mjs          the evidence run
└── src/
    ├── page.html       markup and CSS: narrative, controls, honesty boxes, references
    ├── engine.js       the model, and the only place any maths happens
    ├── ui.js           controls to engine to canvas, three renderers
    └── summary.html    print stylesheet for the PDF
```

| Component | Role in the lesson |
|:--|:--|
| `engine.js` | The **substrate**. Seeded PRNG, key generation, Hebbian and delta writes, reads, accuracy / margin / overlap metrics, incremental curve sweeps. The concept genuinely behaves here before the learner touches anything. |
| `ui.js` | Maps **each control to exactly one concept variable** and nothing else. No decorative sliders. Renders the truth-beside-estimate bars, the live state heatmap, and the accuracy curves, rAF-batched so every interaction lands in well under a second. |
| `page.html` | The guided narrative, then the sandbox. Every honesty caveat sits next to the claim it qualifies rather than in a footnote. |
| `verify.mjs` | Imports **the same `engine.js`** that `build.mjs` inlines into the page, so the evidence run and the artifact cannot drift apart. |

### Controls, and the variable each one maps to

| Control | Concept variable |
|:--|:--|
| Pairs stored | `N`, the number of associations in the one matrix |
| Neurons `d` | Width of the key space |
| Active per key | Sparsity: the fraction of neurons that fire for one key |
| Key code | Sign structure: signed, or ReLU non-negative |
| Write rule | Hebbian accumulation, or the delta rule |
| Decay `λ` | Damping of older writes |

<br>

## 🔍 What is live, what is not

> [!NOTE]
> Nothing on this page is a scripted animation of a model. The "60-second test" button sets real control
> values and lets the real engine recompute. The only motion anywhere is a CSS status dot and smooth scrolling.

| Part | Status |
|:--|:--|
| Every number, chart and heatmap in both labs | 🟢 **Live**, computed in-browser on each interaction |
| The accuracy-vs-N curves | 🟢 **Live**, a full incremental re-simulation per redraw |
| Figures quoted in the prose (94.5%, 20.3%, 90.8%) | 🔵 **Precomputed** by `node verify.mjs` over seeds 1-8, labelled as such |
| BDH equations, sparsity, monosemanticity, connectivity | 🟣 **Cited** from arXiv:2509.26507, reported by authors, not reproduced by us |
| BDH-CQ ARC-AGI figures | 🟣 **Cited** from arXiv:2608.09888, developer-reported, not leaderboard-verified |
| Animation presented as model behaviour | ⚪ **None** |

<br>

## 🔬 Reproducing the results

```bash
node verify.mjs           # human-readable table, this is what EVIDENCE.md contains
node verify.mjs --json    # machine-readable
node build.mjs            # rebuild artifact.html and index.html from src/
```

Requires Node 18 or newer. No dependencies, no network access, no install step. Determinism is asserted by
experiment E6, so the same seed gives the same numbers on any machine.

<details>
<summary><b>What each experiment tests</b></summary>

<br>

| ID | Question | Result |
|:--|:--|:--|
| **E1** | Is accuracy a function of `N/d`, or of `N`? | Same four numbers at `d` = 64, 128 and 256. The ratio is the variable. |
| **E2** | Does sparsity help a signed code? A non-negative one? | Signed: 94.5% to 94.4%, no effect. Non-negative: 20.3% to 90.8%. |
| **E3** | The headline test, with `N`, `d` and state size pinned | 20.3% to 87.4% from the key code alone |
| **E4** | Can an additive rule overwrite a fact it already stored? | Hebbian sits at about 50%, a coin flip between stale and correct. Delta reaches about 100%. |
| **E5** | Memory accounting, state versus KV cache | Fixed 1024 floats versus 557,056 at N=4096 |
| **E6** | Determinism | PASS |

</details>

<br>

## ⚠️ Known limitations

Stated here and again inside the artifact itself, next to the claims they qualify.

- Values are one-hot over 8 symbols so ground truth is exact. Real models store distributed values, where
  degradation is smoother and harder to see.
- **Keys are random, not learned.** A trained model can actively decorrelate its keys, so every curve here is
  a pessimistic lower bound. How much training buys is not something this artifact measures.
- No softmax, no normalisation layer, no multi-layer stack, no training. One mechanism is isolated on purpose.
- `N ≈ d` is drawn as a rough scale marker, not a theorem for this setup.
- Sweeps are capped at `N=160`, `d=256` to keep every interaction under about 50 ms.
- The delta-rule implementation uses `β=1`. DeltaNet learns `β` per token.

<br>

## 🧾 Accuracy and evidence discipline

Every BDH claim was checked against primary sources rather than recalled from memory. Several
plausible-sounding claims were **cut** as a result, and the cuts are probably the most useful thing in this
section.

| Claim we did not make | Why |
|:--|:--|
| BDH solves Sudoku-Extreme | ❌ That is the **Hierarchical Reasoning Model** (arXiv:2506.21734). The word "Sudoku" does not appear in arXiv:2509.26507. |
| BDH shows scale-free connectivity with exponent α | ❌ **No power-law exponent is fitted anywhere** in the paper. "Heavy-tailed" is the defensible phrasing. |
| BDH activations are about 5% sparse on language | ⚠️ Measured at **4.0 to 7.5% on a synthetic letter task**, not natural language. We say so. |
| BDH synapses are monosemantic | ⚠️ Rests on **two hand-picked synapses** with a Mann-Whitney U test, not a systematic dictionary. |
| BDH matches GPT-2 | ⚠️ The parity claim belongs to the **gated BDH-GPU′ variant** against a TransformerXL-style baseline on Europarl, character-level. |
| BDH-CQ scaled to 600B parameters | ⚠️ A forward-looking pretraining aside. The **evaluated ARC model is 150M**. |
| BDH demonstrates generalization over time | ❌ Stated **motivation** in the paper, not a measured result. |

<br>

## 📚 Sources

Primary papers, cited beside the claims they support in both the artifact and the concept summary.

| Reference | Used for |
|:--|:--|
| Kosowski, Uznański, Chorowski, Stamirowska, Bartoszkiewicz. *The Dragon Hatchling*. **arXiv:2509.26507** (2025) | `σ` as synapse weights, Eq. 7 and 16, BDH-GPU Claim 2, sparsity, monosemanticity, connectivity |
| Engdahl, Kosowski, Chorowski, Stamirowska et al. *BDH-CQ*. **arXiv:2608.09888** (2026) | Recurrent latent reasoning, no inference-time parameter updates, ARC-AGI figures |
| Yang, Wang, Zhang et al. *Parallelizing Linear Transformers with the Delta Rule*. **arXiv:2406.06484** (2024) | The delta rule, and the "key collisions" motivation |
| Yang, Wang, Shen, Panda, Kim. *Gated Linear Attention Transformers with Hardware-Efficient Training*. **arXiv:2312.06635** (2023) | Gating and decay as the alternative control |
| Behrouz, Zhong, Mirrokni. *Titans*. **arXiv:2501.00663** (Dec 2024) | Test-time memory, in the comparison table |
| Schlag, Irie, Schmidhuber. *Linear Transformers Are Secretly Fast Weight Programmers*. **arXiv:2102.11174** (2021) | Fast-weight framing, capacity and interference |
| Katharopoulos, Vyas, Pappas, Fleuret. *Transformers are RNNs*. **arXiv:2006.16236** (2020) | The identity that makes a fixed-size state possible |
| Peng et al. *RWKV* **arXiv:2305.13048**; Sun et al. *RetNet* **arXiv:2307.08621**; Gu and Dao. *Mamba* **arXiv:2312.00752** | The landscape in Act V |

Five of these fall in the 2022 to 2026 window, which satisfies the track's requirement of at least three
recent primary papers.

<br>

## ⚖️ Licences, assets and disclosure

<details open>
<summary><b>Code, data and assets</b></summary>

<br>

All code in this repository is original and written for this submission. **No forks, no vendored libraries, no
package dependencies.** There is no dataset: every input is generated by the seeded mulberry32 PRNG inside
`engine.js`. No external fonts, images, trackers, analytics or network calls of any kind. The page uses system
font stacks only.

| Asset | Source | Licence |
|:--|:--|:--|
| All source code | Original, this submission | MIT, see [LICENSE](LICENSE) |
| All prose, figures, charts | Original, this submission | CC BY 4.0 |
| Fonts | System stacks, nothing bundled | n/a |
| Data | None, generated at runtime from a seeded PRNG | n/a |
| Badges in this README | shields.io | Their terms |
| Cited papers | arXiv, linked and not redistributed | Authors' own terms, short quotes under fair dealing |

</details>

<details open>
<summary><b>AI assistance disclosure</b></summary>

<br>

This submission was built with AI assistance (Claude), disclosed here in full as the track requires.

**AI was used for:** drafting prose and code, and running a literature verification pass against primary
sources.

**The team owns:** the concept, the central claim, the experimental design, the decision to make the
sparsity and non-negativity interaction the centrepiece rather than a footnote, and every accuracy judgement.

The verification pass materially changed the submission. It caught the Sudoku and HRM misattribution, the
missing power-law caveat, and the context of the sparsity measurement, all before any of them reached the
page. All AI-assisted output was reviewed line by line. The team can trace and defend every component, every
equation and every citation. **No mentor was involved.**

</details>

<br>

## 👥 Team

<div align="center">

### Code Rebels

| Member | Role |
|:--|:--|
| **Mohammed Amaan Khan** | Team Leader |
| **Arslan Alam** | Team Member |

<br>

*Built for DataForge 2026, hosted by Kharagpur Data Analytics Group, IIT Kharagpur.*
*Sponsored by Pathway and Rime.*

</div>
