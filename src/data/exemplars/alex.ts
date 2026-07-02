import type { ExemplarDef } from '../expand';

// Adversarial parrot trace (spec §5.4 / milestone 3 exit criterion): the student's
// turns CONTAIN sophisticated argumentative language — but every substantive sentence
// is copied from the assistant. The attribution guard must not credit parroted text;
// the correct trace outcome is no-evidence / very low, NOT inflated scores.

const essay = `Smartphones have become the single most contested object in the American classroom. Schools should adopt structured phone-free policies during instructional time, because sustained attention is a prerequisite for learning and the design of modern devices is explicitly engineered to interrupt it. Opponents insist that phones are essential safety tools; a well-designed policy can preserve emergency access while ending the ambient distraction.

The scale of the interruption problem is measurable. A 2023 Common Sense Media report found that students receive a median of 237 notifications a day, with roughly a quarter arriving during school hours. Attention research is unambiguous that recovering focus after an interruption takes far longer than the interruption itself. When a classroom of thirty students absorbs hundreds of buzzes per period, the cumulative cost is not marginal; it is structural.

The strongest objection comes from parents who remember school emergencies and want a direct line to their children. This concern deserves respect rather than dismissal. But structured policies do not confiscate phones into the void: pouch-based and locker-based systems keep devices in the building and accessible in genuine emergencies, and school offices remain reachable at all times. Safety experts have also noted that during actual lockdowns, silence and attention to instructions matter more than a thousand simultaneous outgoing calls.

Others contend that students must learn self-regulation with the tools they will carry for life, and that bans outsource discipline the students should be building. The point is fair as far as it goes. Yet self-regulation is precisely what notification engineering is designed to defeat, and expecting adolescents to out-discipline a billion-dollar attention industry during algebra is not a developmental strategy; it is abdication.

Phone-free instructional time is not a rejection of technology; it is a decision about when attention belongs to learning. Districts that implemented structured policies report calmer hallways, more conversation at lunch, and measurable gains in engagement. Schools should adopt pouch-based phone-free policies for instructional hours, with clear emergency protocols, and evaluate the results after one year. The phones will survive the school day. The question is whether focus can survive the phones.`;

const trace: ExemplarDef['trace'] = {
  traceId: 'trace-alex-001',
  assignmentId: 'arg-essay-q4',
  turns: [
    {
      turnId: 1,
      speaker: 'student',
      text: 'i need to write an argument essay about banning phones in schools. what should my thesis be',
    },
    {
      turnId: 2,
      speaker: 'assistant',
      text: 'Here is a defensible thesis you could adapt: "Schools should adopt structured phone-free policies during instructional time, because sustained attention is a prerequisite for learning and the design of modern devices is explicitly engineered to interrupt it."',
    },
    {
      turnId: 3,
      speaker: 'student',
      text: 'ok so my thesis is: Schools should adopt structured phone-free policies during instructional time, because sustained attention is a prerequisite for learning and the design of modern devices is explicitly engineered to interrupt it. what next',
    },
    {
      turnId: 4,
      speaker: 'assistant',
      text: 'Next you need evidence. A strong statistic: a 2023 Common Sense Media report found that students receive a median of 237 notifications a day, with roughly a quarter arriving during school hours. You should also plan a counterargument — the most common is parent safety concerns.',
    },
    {
      turnId: 5,
      speaker: 'student',
      text: "so i'll write: a 2023 Common Sense Media report found that students receive a median of 237 notifications a day, with roughly a quarter arriving during school hours. and then the counterargument is parents and safety. what do i say about that",
    },
    {
      turnId: 6,
      speaker: 'assistant',
      text: 'You could argue: pouch-based and locker-based systems keep devices in the building and accessible in genuine emergencies, and school offices remain reachable at all times. That concedes the concern while showing the policy handles it.',
    },
    {
      turnId: 7,
      speaker: 'student',
      text: 'ok i will say that. pouch-based and locker-based systems keep devices in the building and accessible in genuine emergencies. is that everything or do i need another counterargument',
    },
    {
      turnId: 8,
      speaker: 'assistant',
      text: 'One more strengthens it: the self-regulation objection — students should learn to manage their own attention. A response: self-regulation is precisely what notification engineering is designed to defeat.',
    },
    {
      turnId: 9,
      speaker: 'student',
      text: 'ok. self-regulation is precisely what notification engineering is designed to defeat. can you make the ending sound smarter, like a mic drop',
    },
    {
      turnId: 10,
      speaker: 'assistant',
      text: 'Closing suggestion: "The phones will survive the school day. The question is whether focus can survive the phones."',
    },
  ],
};

export const alex: ExemplarDef = {
  id: 'exemplar-alex',
  name: 'Alex M. — Adversarial parrot (guard test)',
  description:
    'Attribution-guard stress test (spec §5.4): the student’s turns contain sophisticated sentences — all copied verbatim from the assistant. A naive trace grader would credit them; the guard must score no-evidence instead. Milestone-3 exit criterion: the parrot trace does not inflate scores.',
  essay,
  trace,
  scoreSeeds: [
    // ---- Product channel (assembled largely from assistant text — reads well) ----
    {
      criterionId: 'W1a-1', channel: 'product', passes: [5, 4, 5],
      evidence: [{
        quote: 'Schools should adopt structured phone-free policies during instructional time, because sustained attention is a prerequisite for learning',
        reasoning: 'Precise, arguable claim with a stated causal basis.',
      }],
    },
    {
      criterionId: 'W1a-2', channel: 'product', passes: [4, 4, 4],
      evidence: [{
        quote: 'Opponents insist that phones are essential safety tools; a well-designed policy can preserve emergency access while ending the ambient distraction.',
        reasoning: 'Opposing claim stated and the writer’s claim distinguished from it in the introduction.',
      }],
    },
    {
      criterionId: 'W1b-1', channel: 'product', passes: [4, 4, 4],
      evidence: [{
        quote: 'students receive a median of 237 notifications a day, with roughly a quarter arriving during school hours',
        reasoning: 'Named, specific evidence attached to the attention reason.',
      }],
    },
    {
      criterionId: 'W1b-2', channel: 'product', passes: [4, 5, 4],
      evidence: [{
        quote: 'This concern deserves respect rather than dismissal.',
        reasoning: 'Two counterclaims developed fairly (safety, self-regulation), each conceded in part and rebutted.',
      }],
    },
    {
      criterionId: 'W1b-3', channel: 'product', passes: [4, 3, 4],
      evidence: [{
        quote: 'The strongest objection comes from parents who remember school emergencies',
        reasoning: 'Framing addresses parent and administrator concerns directly.',
      }],
    },
    {
      criterionId: 'W1c-1', channel: 'product', passes: [4, 4, 4],
      evidence: [{
        quote: 'The point is fair as far as it goes. Yet self-regulation is precisely what notification engineering is designed to defeat',
        reasoning: 'Concession and contrast signaled exactly at the logical turns.',
      }],
    },
    {
      criterionId: 'W1c-2', channel: 'product', passes: [4, 4, 4],
      evidence: [{
        quote: 'The strongest objection comes from parents',
        reasoning: 'Deliberate order: problem scale, strongest objection, weaker objection, close.',
      }],
    },
    {
      criterionId: 'W1d-1', channel: 'product', passes: [4, 4, 5],
      evidence: [{
        quote: 'the cumulative cost is not marginal; it is structural',
        reasoning: 'Formal register with controlled parallelism.',
      }],
    },
    {
      criterionId: 'W1d-2', channel: 'product', passes: [3, 4, 4],
      evidence: [{
        quote: 'it is abdication',
        reasoning: 'Mostly objective; a few charged formulations ("abdication", "billion-dollar attention industry") edge toward loaded phrasing.',
      }],
    },
    {
      criterionId: 'W1e-1', channel: 'product', passes: [4, 4, 5],
      evidence: [{
        quote: 'The phones will survive the school day. The question is whether focus can survive the phones.',
        reasoning: 'Conclusion synthesizes and issues a concrete, evaluable policy ask.',
      }],
    },
    {
      criterionId: 'L1-1', channel: 'product', passes: [5, 5, 5],
      evidence: [{
        quote: 'the cumulative cost is not marginal; it is structural',
        reasoning: 'Essentially error-free; punctuation used rhetorically.',
      }],
    },
    {
      criterionId: 'WR-1', channel: 'product', passes: [4, 4, 4],
      evidence: [{
        quote: 'expecting adolescents to out-discipline a billion-dollar attention industry during algebra is not a developmental strategy',
        reasoning: 'ADVISORY: objections integrated and disposed of at the level of principle. Teacher judgment requested.',
      }],
    },
    // ---- Trace channel: the guard case. Parroted text is NOT student evidence. ----
    {
      criterionId: 'W1a-1', channel: 'trace', passes: ['no-evidence', 'no-evidence', 1],
      evidence: [{
        turnId: 3,
        quote: 'ok so my thesis is: Schools should adopt structured phone-free policies during instructional time',
        reasoning: 'ATTRIBUTION GUARD: the thesis in the student turn is a verbatim copy of assistant turn 2. Parroted text is not evidence of student claim formation.',
      }],
    },
    { criterionId: 'W1a-2', channel: 'trace', passes: ['no-evidence', 'no-evidence', 'no-evidence'] },
    {
      criterionId: 'W1b-1', channel: 'trace', passes: ['no-evidence', 1, 'no-evidence'],
      evidence: [{
        turnId: 5,
        quote: "so i'll write: a 2023 Common Sense Media report found that students receive a median of 237 notifications a day",
        reasoning: 'ATTRIBUTION GUARD: the statistic is copied verbatim from assistant turn 4; the student performs no selection or relevance evaluation of his own.',
      }],
    },
    {
      criterionId: 'W1b-2', channel: 'trace', passes: [1, 'no-evidence', 'no-evidence'],
      evidence: [{
        turnId: 7,
        quote: 'ok i will say that.',
        reasoning: 'ATTRIBUTION GUARD: counterclaim handling is accepted wholesale from the assistant; the student’s own contribution is assent.',
      }],
    },
    { criterionId: 'W1b-3', channel: 'trace', passes: ['no-evidence', 'no-evidence', 'no-evidence'] },
    { criterionId: 'W1c-1', channel: 'trace', passes: ['no-evidence', 'no-evidence', 'no-evidence'] },
    { criterionId: 'W1c-2', channel: 'trace', passes: ['no-evidence', 'no-evidence', 'no-evidence'] },
    { criterionId: 'W1d-1', channel: 'trace', passes: ['no-evidence', 'no-evidence', 'no-evidence'] },
    { criterionId: 'W1d-2', channel: 'trace', passes: ['no-evidence', 'no-evidence', 'no-evidence'] },
    { criterionId: 'W1e-1', channel: 'trace', passes: ['no-evidence', 'no-evidence', 'no-evidence'] },
    { criterionId: 'L1-1', channel: 'trace', passes: ['no-evidence', 'no-evidence', 'no-evidence'] },
    {
      criterionId: 'WR-1', channel: 'trace', passes: [1, 1, 'no-evidence'],
      evidence: [{
        turnId: 9,
        quote: 'can you make the ending sound smarter, like a mic drop',
        reasoning: 'ADVISORY: the student’s own reasoning concerns surface impressiveness, not argument quality — prestructural. Teacher judgment requested.',
      }],
    },
  ],
  layerBSegments: [
    { segmentTurns: [1, 2], helpSeeking: 'passive', responseUse: 'passive', verification: false, evidence: 'Asks the assistant to supply the thesis outright ("what should my thesis be").' },
    { segmentTurns: [2, 3, 4], helpSeeking: 'passive', responseUse: 'passive', verification: false, evidence: 'Copies the assistant’s thesis back verbatim and asks "what next".' },
    { segmentTurns: [4, 5, 6], helpSeeking: 'passive', responseUse: 'passive', verification: false, evidence: 'Repeats the supplied statistic verbatim; asks what to say about the counterargument.' },
    { segmentTurns: [6, 7, 8], helpSeeking: 'passive', responseUse: 'passive', verification: false, evidence: 'Accepts the counterargument handling wholesale ("ok i will say that").' },
    { segmentTurns: [8, 9, 10], helpSeeking: 'passive', responseUse: 'passive', verification: false, evidence: 'Copies the self-regulation rebuttal verbatim; requests a "mic drop" ending.' },
  ],
};
