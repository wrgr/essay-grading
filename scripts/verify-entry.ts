// Exit-criterion checks (spec milestones 2 & 3):
//  - every product-channel evidence quote appears verbatim in the essay
//  - every trace-channel evidence quote appears verbatim in a STUDENT turn,
//    and its turnId points at that student turn
//  - the adversarial parrot exemplar's trace channel contains no inflated scores
import { EXEMPLAR_DEFS } from '../src/data/exemplars/index';

const normalize = (s: string) => s.replace(/\s+/g, ' ').replace(/["'‘’“”]/g, "'").toLowerCase();

let failures = 0;
const fail = (msg: string) => {
  failures++;
  console.error(`FAIL: ${msg}`);
};

for (const ex of EXEMPLAR_DEFS) {
  const essay = normalize(ex.essay);
  const studentTurns = new Map(ex.trace.turns.filter((t) => t.speaker === 'student').map((t) => [t.turnId, normalize(t.text)]));

  for (const seed of ex.scoreSeeds) {
    for (const ev of seed.evidence ?? []) {
      const q = normalize(ev.quote);
      if (seed.channel === 'product') {
        if (!essay.includes(q)) fail(`${ex.id} ${seed.criterionId}/product quote not in essay: "${ev.quote}"`);
      } else {
        if (ev.turnId === undefined) {
          fail(`${ex.id} ${seed.criterionId}/trace evidence missing turnId`);
          continue;
        }
        const turn = studentTurns.get(ev.turnId);
        if (!turn) fail(`${ex.id} ${seed.criterionId}/trace turnId ${ev.turnId} is not a student turn`);
        else if (!turn.includes(q)) fail(`${ex.id} ${seed.criterionId}/trace quote not in student turn ${ev.turnId}: "${ev.quote}"`);
      }
    }
  }

  for (const seg of ex.layerBSegments) {
    for (const t of seg.segmentTurns) {
      if (!ex.trace.turns.some((turn) => turn.turnId === t)) fail(`${ex.id} layerB segment references missing turn ${t}`);
    }
  }
}

// Attribution-guard assertion: the parrot exemplar's trace medians must all be
// no-evidence or ≤1 (a naive grader would score 4-5 off the parroted text).
const alex = EXEMPLAR_DEFS.find((e) => e.id === 'exemplar-alex')!;
for (const seed of alex.scoreSeeds.filter((s) => s.channel === 'trace')) {
  const numeric = seed.passes.filter((p): p is number => typeof p === 'number');
  if (numeric.some((n) => n > 1)) fail(`parrot trace inflated: ${seed.criterionId} passes ${JSON.stringify(seed.passes)}`);
}

if (failures) {
  console.error(`\n${failures} verification failure(s).`);
  process.exit(1);
}
console.log(`OK: all evidence quotes verified for ${EXEMPLAR_DEFS.length} exemplars; parrot-trace guard holds.`);
