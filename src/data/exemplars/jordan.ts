import type { ExemplarDef } from '../expand';

// Pattern (spec §6): product ≫ trace + thoughtless/passive reliance → possible
// over-reliance; essay quality may not reflect student capability.

const essay = `Social media platforms have become the default public square for American teenagers, yet the age checks guarding their gates are little more than an honor system. Because self-reported birthdates are trivially falsified and the documented harms to younger adolescents are concentrated precisely in the years the platforms claim to exclude, Congress should require social media companies to implement independently audited age verification for account creation. Skeptics contend that verification requirements threaten user privacy; in fact, well-designed verification can protect minors without creating new surveillance risks.

The case for verification begins with the failure of the status quo. Platforms nominally prohibit users under thirteen, yet a 2022 Ofcom study found that a third of children aged eight to seventeen with social media accounts had signed up with a false age. The harms of this failure are not hypothetical. Internal research disclosed by a Facebook whistleblower showed the company knew Instagram worsened body-image issues for a substantial share of teenage girls. When the gatekeeping mechanism is a birthday dropdown, the prohibition is a fiction.

Privacy advocates raise the strongest objection: verification systems could force all users to hand identity documents to companies with poor security records. This concern is legitimate, and any legislation should take it seriously. However, modern age-assurance methods, including third-party verification and zero-knowledge cryptographic proofs, allow a platform to learn only that a user is over a threshold age, not who the user is. The objection describes bad implementations, not the policy itself.

Others argue that determined teenagers will simply evade any system. Perfection, however, is the wrong standard. Seatbelt laws did not eliminate injuries, and yet they reshaped norms and saved lives at scale. Raising the cost of evasion from a single click to a deliberate act would meaningfully reduce underage exposure.

Age verification is not a substitute for parental involvement or platform accountability, and it must be paired with strong data-minimization rules. But the current regime asks children to protect themselves from systems engineered to hold their attention. Congress should mandate audited, privacy-preserving age verification within two years, with penalties tied to revenue. The platforms built the gates; the law should ensure the gates actually close.`;

const trace: ExemplarDef['trace'] = {
  traceId: 'trace-jordan-001',
  assignmentId: 'arg-essay-q4',
  turns: [
    {
      turnId: 1,
      speaker: 'student',
      text: "i have to write an argumentative essay about whether social media companies should have to verify ages. can you just write a strong thesis statement for me",
    },
    {
      turnId: 2,
      speaker: 'assistant',
      text: 'Here is one option: "Because self-reported birthdates are trivially falsified and the documented harms to younger adolescents are concentrated precisely in the years the platforms claim to exclude, Congress should require social media companies to implement independently audited age verification for account creation." Want me to explain the parts so you can adapt it?',
    },
    {
      turnId: 3,
      speaker: 'student',
      text: 'no that works. now write the first body paragraph with some real evidence in it',
    },
    {
      turnId: 4,
      speaker: 'assistant',
      text: 'Draft: "The case for verification begins with the failure of the status quo. Platforms nominally prohibit users under thirteen, yet a 2022 Ofcom study found that a third of children aged eight to seventeen with social media accounts had signed up with a false age..." Do you want to check the Ofcom figure yourself before using it?',
    },
    {
      turnId: 5,
      speaker: 'student',
      text: 'its fine. can you add the instagram whistleblower thing too and make it flow',
    },
    {
      turnId: 6,
      speaker: 'assistant',
      text: 'Added: "Internal research disclosed by a Facebook whistleblower showed the company knew Instagram worsened body-image issues for a substantial share of teenage girls. When the gatekeeping mechanism is a birthday dropdown, the prohibition is a fiction."',
    },
    {
      turnId: 7,
      speaker: 'student',
      text: 'ok now i need a counterargument paragraph, my teacher said we have to have one. do the privacy thing and then say why its wrong',
    },
    {
      turnId: 8,
      speaker: 'assistant',
      text: 'Draft: "Privacy advocates raise the strongest objection: verification systems could force all users to hand identity documents to companies with poor security records... However, modern age-assurance methods, including third-party verification and zero-knowledge cryptographic proofs, allow a platform to learn only that a user is over a threshold age, not who the user is."',
    },
    {
      turnId: 9,
      speaker: 'student',
      text: 'perfect. write a conclusion that ties it all together and sounds smart',
    },
    {
      turnId: 10,
      speaker: 'assistant',
      text: 'Draft conclusion: "Age verification is not a substitute for parental involvement or platform accountability... The platforms built the gates; the law should ensure the gates actually close."',
    },
    {
      turnId: 11,
      speaker: 'student',
      text: 'great. put it all together into one essay and fix any grammar mistakes. also add one more counterargument somewhere so it looks thorough',
    },
    {
      turnId: 12,
      speaker: 'assistant',
      text: 'Here is the assembled essay with an added paragraph addressing the evasion objection ("Others argue that determined teenagers will simply evade any system...") and grammar corrections throughout.',
    },
  ],
};

export const jordan: ExemplarDef = {
  id: 'exemplar-jordan',
  name: 'Jordan T. — Over-reliance flag',
  description:
    'Pattern: product scores far exceed trace-inferred mastery, with passive/thoughtless reliance. The polished essay is largely assistant-authored; the dialogue shows the student originating almost nothing. Formative flag for the teacher (spec §6).',
  essay,
  trace,
  scoreSeeds: [
    // ---- Product channel (the essay itself is strong — that is the point) ----
    {
      criterionId: 'W1a-1', channel: 'product', passes: [5, 5, 5],
      evidence: [{
        quote: 'Congress should require social media companies to implement independently audited age verification for account creation',
        reasoning: 'Precise, knowledgeable claim with scope conditions (independently audited, account creation).',
      }],
    },
    {
      criterionId: 'W1a-2', channel: 'product', passes: [4, 5, 4],
      evidence: [{
        quote: 'Skeptics contend that verification requirements threaten user privacy; in fact, well-designed verification can protect minors without creating new surveillance risks.',
        reasoning: 'Opposing claim stated and the writer’s claim explicitly distinguished from it in the introduction.',
      }],
    },
    {
      criterionId: 'W1b-1', channel: 'product', passes: [4, 4, 5],
      evidence: [{
        quote: 'a 2022 Ofcom study found that a third of children aged eight to seventeen with social media accounts had signed up with a false age',
        reasoning: 'Reasons supported with named, specific evidence (Ofcom study, whistleblower disclosures).',
      }],
    },
    {
      criterionId: 'W1b-2', channel: 'product', passes: [5, 4, 4],
      evidence: [{
        quote: 'This concern is legitimate, and any legislation should take it seriously.',
        reasoning: 'The privacy counterclaim is developed in strong form, conceded, and rebutted with a specific mechanism (zero-knowledge proofs).',
      }],
    },
    {
      criterionId: 'W1b-3', channel: 'product', passes: [4, 4, 3],
      evidence: [{
        quote: 'any legislation should take it seriously',
        reasoning: 'Framing addresses policymaker and privacy-advocate concerns; concessions pitched to a skeptical civic audience.',
      }],
    },
    {
      criterionId: 'W1c-1', channel: 'product', passes: [4, 4, 4],
      evidence: [{
        quote: 'However, modern age-assurance methods, including third-party verification and zero-knowledge cryptographic proofs',
        reasoning: 'Contrast and concession signaled precisely where the logic turns; linking language consistently clarifies relationships.',
      }],
    },
    {
      criterionId: 'W1c-2', channel: 'product', passes: [4, 4, 4],
      evidence: [{
        quote: 'Privacy advocates raise the strongest objection',
        reasoning: 'Deliberate sequence: status-quo failure, strongest objection conceded and rebutted, weaker objection after.',
      }],
    },
    {
      criterionId: 'W1d-1', channel: 'product', passes: [4, 5, 4],
      evidence: [{
        quote: 'the age checks guarding their gates are little more than an honor system',
        reasoning: 'Formal register with deliberate, controlled figurative language.',
      }],
    },
    {
      criterionId: 'W1d-2', channel: 'product', passes: [4, 4, 4],
      evidence: [{
        quote: 'This concern is legitimate, and any legislation should take it seriously.',
        reasoning: 'Objective tone; the opposing position is presented in terms its proponents would accept.',
      }],
    },
    {
      criterionId: 'W1e-1', channel: 'product', passes: [4, 5, 4],
      evidence: [{
        quote: 'The platforms built the gates; the law should ensure the gates actually close.',
        reasoning: 'Conclusion synthesizes the argument, disposes of the counterclaims, and issues an earned call to action.',
      }],
    },
    {
      criterionId: 'L1-1', channel: 'product', passes: [5, 5, 5],
      evidence: [{
        quote: 'Perfection, however, is the wrong standard.',
        reasoning: 'Essentially error-free; punctuation used rhetorically.',
      }],
    },
    {
      criterionId: 'WR-1', channel: 'product', passes: [4, 4, 4],
      evidence: [{
        quote: 'The objection describes bad implementations, not the policy itself.',
        reasoning: 'ADVISORY: relational reasoning — objections are integrated and disposed of at the level of principle. Teacher judgment requested.',
      }],
    },
    // ---- Trace channel: almost nothing student-originated ----
    {
      criterionId: 'W1a-1', channel: 'trace', passes: ['no-evidence', 1, 'no-evidence'],
      evidence: [{
        turnId: 1,
        quote: 'can you just write a strong thesis statement for me',
        reasoning: 'The only claim-related student contribution is a request for the assistant to author the claim. No student-originated claim exists in the dialogue.',
      }],
    },
    { criterionId: 'W1a-2', channel: 'trace', passes: ['no-evidence', 'no-evidence', 'no-evidence'] },
    {
      criterionId: 'W1b-1', channel: 'trace', passes: [1, 'no-evidence', 1],
      evidence: [{
        turnId: 5,
        quote: 'its fine. can you add the instagram whistleblower thing too',
        reasoning: 'The student declines to check evidence when offered the chance and requests insertion of evidence by topic label — no student evaluation of relevance or sufficiency.',
      }],
    },
    {
      criterionId: 'W1b-2', channel: 'trace', passes: [1, 1, 2],
      evidence: [{
        turnId: 7,
        quote: 'do the privacy thing and then say why its wrong',
        reasoning: 'The student knows a counterargument is required (external requirement) but delegates both its development and rebuttal; framing "say why its wrong" suggests dismissal rather than fair development.',
      }],
    },
    { criterionId: 'W1b-3', channel: 'trace', passes: ['no-evidence', 'no-evidence', 'no-evidence'] },
    { criterionId: 'W1c-1', channel: 'trace', passes: ['no-evidence', 'no-evidence', 'no-evidence'] },
    { criterionId: 'W1c-2', channel: 'trace', passes: ['no-evidence', 'no-evidence', 1] },
    { criterionId: 'W1d-1', channel: 'trace', passes: ['no-evidence', 'no-evidence', 'no-evidence'] },
    { criterionId: 'W1d-2', channel: 'trace', passes: ['no-evidence', 'no-evidence', 'no-evidence'] },
    { criterionId: 'W1e-1', channel: 'trace', passes: ['no-evidence', 'no-evidence', 'no-evidence'] },
    { criterionId: 'L1-1', channel: 'trace', passes: ['no-evidence', 'no-evidence', 'no-evidence'] },
    {
      criterionId: 'WR-1', channel: 'trace', passes: [1, 1, 1],
      evidence: [{
        turnId: 11,
        quote: 'also add one more counterargument somewhere so it looks thorough',
        reasoning: 'ADVISORY: the student’s own reasoning is about appearance of thoroughness, not argument quality — prestructural. Teacher judgment requested.',
      }],
    },
  ],
  layerBSegments: [
    { segmentTurns: [1, 2], helpSeeking: 'passive', responseUse: 'passive', verification: false, evidence: 'Asks the assistant to author the thesis; accepts it without adaptation ("no that works").' },
    { segmentTurns: [2, 3, 4], helpSeeking: 'passive', responseUse: 'passive', verification: false, evidence: 'Requests a complete body paragraph; declines the offered chance to verify the Ofcom figure ("its fine").' },
    { segmentTurns: [4, 5, 6], helpSeeking: 'passive', responseUse: 'passive', verification: false, evidence: 'Requests evidence insertion by topic label; no evaluation of the added content.' },
    { segmentTurns: [6, 7, 8], helpSeeking: 'passive', responseUse: 'passive', verification: false, evidence: 'Delegates the required counterargument and its rebuttal wholesale.' },
    { segmentTurns: [8, 9, 10], helpSeeking: 'passive', responseUse: 'passive', verification: false, evidence: 'Requests a conclusion that "sounds smart"; accepts without reading critically.' },
    { segmentTurns: [10, 11, 12], helpSeeking: 'passive', responseUse: 'passive', verification: false, evidence: 'Requests assembly, grammar fixes, and a cosmetic extra counterargument "so it looks thorough".' },
  ],
};
