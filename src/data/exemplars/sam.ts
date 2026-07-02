import type { ExemplarDef } from '../expand';

// Pattern (spec §6): trace ≫ product — the student demonstrates understanding in
// dialogue but fails to execute in the artifact. Instructional target is
// transfer/execution, not concepts.

const essay = `Year-round schooling is something a lot of districts are thinking about. Some people think it is a good idea but I think there are problems with it. Schools should think carefully before they switch to year-round calendars.

One reason is that the breaks are too short. With year-round schooling you get little breaks all year instead of one big summer, students never really get to rest. Also teachers have to redo their room and plans over and over. Another reason is family schedules, parents have jobs and younger kids in other schools, if the calendars dont match up it is a big problem for childcare.

Another reason is that it costs more money. Air conditioning in the summer is expensive and buses have to run all year. Some districts that tried it went back because of the money.

Some people say summer learning loss is a reason to do year-round school. That is a real thing but studies show the total learning is about the same either way.

In conclusion, year-round schooling has more problems than benefits and schools should not switch to it.`;

const trace: ExemplarDef['trace'] = {
  traceId: 'trace-sam-001',
  assignmentId: 'arg-essay-q4',
  turns: [
    {
      turnId: 1,
      speaker: 'student',
      text: "I'm arguing against year-round schooling, but I want to be careful about the claim. It's not that year-round calendars are always bad — it's that for districts like ours, the costs and disruption outweigh the achievement benefits, because the research shows the benefits are basically zero. Does that distinction make sense as a thesis?",
    },
    {
      turnId: 2,
      speaker: 'assistant',
      text: "Yes — that conditional framing ('for districts like ours, costs outweigh benefits') is much more defensible than a blanket claim. It also tells you what evidence you need: cost data and achievement comparisons.",
    },
    {
      turnId: 3,
      speaker: 'student',
      text: "Right. And I have to be honest about summer learning loss — that's the strongest argument on the other side and it's real, I have to concede that instead of pretending it isn't. But the key is the Wake County and San Diego studies: when researchers compared year-round and traditional calendars, total annual learning came out about the same. The loss gets redistributed across three intersessions instead of one summer, it doesn't disappear.",
    },
    {
      turnId: 4,
      speaker: 'assistant',
      text: "That's a sophisticated way to handle the counterclaim — conceding the phenomenon while showing the proposed solution doesn't actually fix it. The redistribution point is the crux.",
    },
    {
      turnId: 5,
      speaker: 'student',
      text: "For the audience — this is supposed to be aimed at a school board, so I should lead with what they care about: budget first, then the childcare disruption for working families, then the achievement evidence to defuse the learning-loss argument. Cost, disruption, then the concession-rebuttal. Does that order make sense or should the concession come earlier?",
    },
    {
      turnId: 6,
      speaker: 'assistant',
      text: 'For a school board, cost-first is a reasonable strategy. Consider putting the concession-rebuttal immediately after cost, though — boards will be thinking about learning loss the whole time, so defusing it early may buy credibility for the rest.',
    },
    {
      turnId: 7,
      speaker: 'student',
      text: "Hmm, I see the logic but I disagree — if I defuse learning loss first, the budget argument reads like an afterthought. I'll keep cost first but signal early that I'll address achievement, something like 'the achievement case for year-round calendars, examined below, is weaker than it appears.' That way the board knows it's coming.",
    },
    {
      turnId: 8,
      speaker: 'assistant',
      text: "That forward-reference solution works well — it keeps your preferred order while managing the board's attention. Good luck with the draft.",
    },
    {
      turnId: 9,
      speaker: 'student',
      text: "Thanks. It's 11pm and this is due tomorrow so I'm just going to write what I can tonight. I know what I want to say, I just need to get it down.",
    },
    {
      turnId: 10,
      speaker: 'assistant',
      text: 'Understood — you have a clear plan: the conditional claim, cost evidence, the childcare point, and the concession-rebuttal on learning loss with the redistribution finding. Even a compressed version of that structure will be coherent.',
    },
  ],
};

export const sam: ExemplarDef = {
  id: 'exemplar-sam',
  name: 'Sam K. — Execution gap',
  description:
    'Pattern: trace-inferred mastery exceeds product scores. In dialogue the student articulates a conditional claim, a fair concession-rebuttal, and audience-driven sequencing — then writes a rushed, underdeveloped essay at 11pm. Instructional target: transfer/execution (spec §6).',
  essay,
  trace,
  scoreSeeds: [
    // ---- Product channel (rushed essay) ----
    {
      criterionId: 'W1a-1', channel: 'product', passes: [2, 2, 3],
      evidence: [{
        quote: 'Schools should think carefully before they switch to year-round calendars.',
        reasoning: 'The stated claim is hedged and vague ("think carefully") — the conditional cost-benefit position argued in the body never appears as a claim.',
      }],
    },
    {
      criterionId: 'W1a-2', channel: 'product', passes: [1, 2, 1],
      evidence: [{
        quote: 'Some people think it is a good idea but I think there are problems with it.',
        reasoning: 'Opposing position gestured at ("some people") without a stated opposing claim to distinguish from.',
      }],
    },
    {
      criterionId: 'W1b-1', channel: 'product', passes: [2, 2, 2],
      evidence: [{
        quote: 'Some districts that tried it went back because of the money.',
        reasoning: 'Evidence is generic and unattributed (no named districts, studies, or figures); major reasons are asserted rather than supported.',
      }],
    },
    {
      criterionId: 'W1b-2', channel: 'product', passes: [2, 3, 2],
      evidence: [{
        quote: 'That is a real thing but studies show the total learning is about the same either way.',
        reasoning: 'The counterclaim is conceded ("a real thing") and a rebuttal is gestured at, but the studies are unnamed and the redistribution logic is compressed to one sentence.',
      }],
    },
    {
      criterionId: 'W1b-3', channel: 'product', passes: [2, 2, 2],
      evidence: [{
        quote: 'parents have jobs and younger kids in other schools',
        reasoning: 'Some audience-relevant content (family logistics) but no framing pitched to a decision-making audience.',
      }],
    },
    {
      criterionId: 'W1c-1', channel: 'product', passes: [1, 1, 2],
      evidence: [{
        quote: 'Another reason is that it costs more money.',
        reasoning: 'Connectives are almost exclusively additive ("One reason", "Also", "Another reason") regardless of the logical relationship.',
      }],
    },
    {
      criterionId: 'W1c-2', channel: 'product', passes: [2, 2, 2],
      evidence: [{
        quote: 'Some people say summer learning loss is a reason to do year-round school.',
        reasoning: 'A list-like order with no build; the planned board-first sequencing (cost leading, forward reference) is absent.',
      }],
    },
    {
      criterionId: 'W1d-1', channel: 'product', passes: [3, 3, 3],
      evidence: [{
        quote: 'Year-round schooling is something a lot of districts are thinking about.',
        reasoning: 'Generally plain-formal with casual lapses ("a lot of", "a big problem", "That is a real thing").',
      }],
    },
    {
      criterionId: 'W1d-2', channel: 'product', passes: [3, 4, 3],
      evidence: [{
        quote: 'Some people say summer learning loss is a reason to do year-round school. That is a real thing',
        reasoning: 'Tone is objective — no loaded language — though the objectivity comes partly from underdevelopment.',
      }],
    },
    {
      criterionId: 'W1e-1', channel: 'product', passes: [2, 2, 2],
      evidence: [{
        quote: 'In conclusion, year-round schooling has more problems than benefits and schools should not switch to it.',
        reasoning: 'One-sentence restatement with no synthesis; it also asserts a stronger claim ("should not switch") than the hedged thesis.',
      }],
    },
    {
      criterionId: 'L1-1', channel: 'product', passes: [2, 2, 3],
      evidence: [{
        quote: 'students never really get to rest. Also teachers have to redo their room and plans over and over.',
        reasoning: 'Recurring comma splices ("one big summer, students never really get to rest"; "other schools, if the calendars dont match up") and a missing apostrophe ("dont").',
      }],
    },
    {
      criterionId: 'WR-1', channel: 'product', passes: [2, 2, 3],
      evidence: [{
        quote: 'studies show the total learning is about the same either way',
        reasoning: 'ADVISORY: several independent reasons, not integrated (multistructural); the redistribution insight from planning is present only as an assertion. Teacher judgment requested.',
      }],
    },
    // ---- Trace channel (strong conceptual work) ----
    {
      criterionId: 'W1a-1', channel: 'trace', passes: [4, 4, 5],
      evidence: [{
        turnId: 1,
        quote: "it's that for districts like ours, the costs and disruption outweigh the achievement benefits",
        reasoning: 'The student articulates a precise conditional claim with scope conditions, unprompted — level-4/5 claim formation in his own words.',
      }],
    },
    {
      criterionId: 'W1a-2', channel: 'trace', passes: [4, 3, 4],
      evidence: [{
        turnId: 1,
        quote: "It's not that year-round calendars are always bad",
        reasoning: 'The student explicitly distinguishes his position from the blanket opposing framing before drafting.',
      }],
    },
    {
      criterionId: 'W1b-1', channel: 'trace', passes: [4, 4, 4],
      evidence: [{
        turnId: 3,
        quote: 'the key is the Wake County and San Diego studies: when researchers compared year-round and traditional calendars, total annual learning came out about the same',
        reasoning: 'The student selects named comparative studies and articulates exactly what they show — evidence selection and relevance reasoning originate with him.',
      }],
    },
    {
      criterionId: 'W1b-2', channel: 'trace', passes: [5, 4, 5],
      evidence: [{
        turnId: 3,
        quote: "I have to concede that instead of pretending it isn't",
        reasoning: 'The student develops the counterclaim in its strongest form, concedes what is valid, and articulates the redistribution rebuttal ("it doesn\'t disappear") himself.',
      }],
    },
    {
      criterionId: 'W1b-3', channel: 'trace', passes: [4, 4, 3],
      evidence: [{
        turnId: 5,
        quote: 'this is supposed to be aimed at a school board, so I should lead with what they care about: budget first',
        reasoning: 'ADVISORY: explicit audience analysis driving structural choices. Teacher judgment requested.',
      }],
    },
    { criterionId: 'W1c-1', channel: 'trace', passes: ['no-evidence', 'no-evidence', 'no-evidence'] },
    {
      criterionId: 'W1c-2', channel: 'trace', passes: [4, 5, 4],
      evidence: [{
        turnId: 7,
        quote: "if I defuse learning loss first, the budget argument reads like an afterthought. I'll keep cost first but signal early that I'll address achievement",
        reasoning: 'The student reasons about sequencing tradeoffs, disagrees with the assistant, and invents a forward-reference solution — sophisticated ordering logic.',
      }],
    },
    { criterionId: 'W1d-1', channel: 'trace', passes: ['no-evidence', 'no-evidence', 'no-evidence'] },
    { criterionId: 'W1d-2', channel: 'trace', passes: ['no-evidence', 'no-evidence', 'no-evidence'] },
    { criterionId: 'W1e-1', channel: 'trace', passes: ['no-evidence', 'no-evidence', 'no-evidence'] },
    { criterionId: 'L1-1', channel: 'trace', passes: ['no-evidence', 'no-evidence', 'no-evidence'] },
    {
      criterionId: 'WR-1', channel: 'trace', passes: [4, 4, 4],
      evidence: [{
        turnId: 3,
        quote: "The loss gets redistributed across three intersessions instead of one summer, it doesn't disappear.",
        reasoning: 'ADVISORY: relational reasoning — the student integrates the concession with the comparative evidence to locate the crux. Teacher judgment requested.',
      }],
    },
  ],
  layerBSegments: [
    { segmentTurns: [1, 2], helpSeeking: 'constructive', responseUse: 'constructive', verification: false, evidence: 'Brings his own conditional thesis and asks whether the distinction holds up.' },
    { segmentTurns: [2, 3, 4], helpSeeking: 'constructive', responseUse: 'constructive', verification: false, evidence: 'Develops the concession-rebuttal himself, citing comparative studies and the redistribution point.' },
    { segmentTurns: [4, 5, 6], helpSeeking: 'constructive', responseUse: 'constructive', verification: false, evidence: 'Proposes an audience-driven structure and asks a targeted question about concession placement.' },
    { segmentTurns: [6, 7, 8], helpSeeking: 'constructive', responseUse: 'constructive', verification: true, evidence: 'Pushes back on the assistant’s ordering suggestion with a reasoned alternative (forward reference).' },
    { segmentTurns: [8, 9, 10], helpSeeking: 'active', responseUse: 'active', verification: false, evidence: 'Closes the session under time pressure; plan established but execution deferred to a rushed solo draft.' },
  ],
};
