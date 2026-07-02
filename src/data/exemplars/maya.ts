import type { ExemplarDef } from '../expand';

// Pattern (spec §6): convergence + constructive engagement → strongest validity.

const essay = `Every weekday morning, thousands of Maryland high school students board buses before sunrise and sit through first period in a fog. This is not a failure of discipline; it is a failure of scheduling. Because adolescent circadian rhythms shift sleep onset later during the teenage years, Maryland high schools should move their start times to 8:30 a.m. or later, even if doing so requires reorganizing bus routes and athletic schedules. Critics argue that later start times merely shift the whole day back without adding sleep; the evidence shows otherwise.

The biological case is well established. The American Academy of Pediatrics and the CDC both recommend that high schools start no earlier than 8:30 a.m., because melatonin release in adolescents begins roughly two hours later than in adults. When Seattle moved its high school start times nearly an hour later, researchers found that students gained a median of 34 minutes of sleep per night and that final grades rose by 4.5 percent. In other words, students did not simply stay up later; they slept more, and their performance improved.

Opponents of later start times raise a genuine concern: cost. Staggered bus routes are cheaper than parallel ones, and moving high schools later can force elementary schools earlier or require additional buses. This objection deserves to be taken seriously, because transportation is often the largest line item a district can actually adjust. However, an economic analysis by the RAND Corporation projected that statewide adoption of 8:30 a.m. start times would pay for itself within two years through improved graduation rates and reduced car accidents among teen drivers. A real cost, in short, is outweighed by a larger and better-documented benefit.

Some also worry that after-school athletics and jobs would suffer. Yet districts that made the change, including Seattle and entire counties in Kentucky and Minnesota, report that practices and work schedules adapted within a season. Convenience adjusted; biology did not.

Later start times will not solve every problem adolescents face, and districts with severe budget constraints may need phased implementation. But the direction of the evidence is consistent: when the school day aligns with adolescent sleep biology, attendance, grades, and safety improve. Maryland districts should commit to an 8:30 a.m. minimum start time within three years, beginning with pilot high schools this fall. The cost of the change is measured in bus routes; the cost of the status quo is measured in students.`;

const trace: ExemplarDef['trace'] = {
  traceId: 'trace-maya-001',
  assignmentId: 'arg-essay-q4',
  turns: [
    {
      turnId: 1,
      speaker: 'student',
      text: "I'm writing my argument essay on school start times. My working claim is: Maryland high schools should move their start times to 8:30 or later because teenagers need more sleep. Is that precise enough, or is 'need more sleep' too vague for a thesis?",
    },
    {
      turnId: 2,
      speaker: 'assistant',
      text: "Good instinct — 'teenagers need more sleep' is a bit vague because it doesn't say *why* schools are the right lever. You could ground it in the biology (circadian rhythm shift) and acknowledge the tradeoff you're asking districts to accept. Want to try a revision?",
    },
    {
      turnId: 3,
      speaker: 'student',
      text: "Ok, revised: Because adolescent circadian rhythms shift sleep onset later, Maryland high schools should start at 8:30 or later, even if it means reorganizing bus routes. I added the bus part on purpose so I'm not dodging the cost issue. What's the strongest objection someone could make to this claim?",
    },
    {
      turnId: 4,
      speaker: 'assistant',
      text: 'Strong revision. The three most common objections: (1) cost — bus fleets are staggered, so later high school starts ripple into elementary schedules; (2) displacement — kids will just stay up later and gain no sleep; (3) after-school logistics — athletics and jobs get squeezed.',
    },
    {
      turnId: 5,
      speaker: 'student',
      text: "I think the cost one is the strongest objection because it's the only one with a real budget number attached, so that's the counterclaim I'll develop fairly instead of strawmanning. The displacement one I can beat with the Seattle study since students actually gained sleep. Do you know what the Seattle study found exactly?",
    },
    {
      turnId: 6,
      speaker: 'assistant',
      text: 'The Seattle study (Dunster et al., Science Advances, 2018) found students gained a median of 34 minutes of sleep per night after the district moved start times later, and grades in the studied science courses rose about 4.5%.',
    },
    {
      turnId: 7,
      speaker: 'student',
      text: "Wait, that 4.5% — is that a rise in final grades or in test scores specifically? I don't want to cite it inaccurately, my teacher checks sources. Also was it all courses or just the science classes they studied?",
    },
    {
      turnId: 8,
      speaker: 'assistant',
      text: 'Good catch — it was final grades in the two biology courses the researchers had access to, not school-wide. Safest phrasing: "final grades rose by 4.5 percent" in the studied courses.',
    },
    {
      turnId: 9,
      speaker: 'student',
      text: "Then I'll keep my wording cautious. For structure: I'm going to put the concession about bus costs right before my strongest evidence, the RAND cost-benefit projection, so the rebuttal lands immediately after I've granted the objection. Concession, then rebuttal, weaker points after.",
    },
    {
      turnId: 10,
      speaker: 'assistant',
      text: "That's an effective sequence — granting the objection first makes the rebuttal read as earned rather than defensive. The RAND analysis you mentioned projected statewide 8:30 start times paying for themselves within about two years.",
    },
    {
      turnId: 11,
      speaker: 'student',
      text: "Here's my conclusion draft: 'Later start times will not solve every problem adolescents face, and districts with severe budget constraints may need phased implementation. But the direction of the evidence is consistent.' Then I want to end with a concrete ask — a three-year commitment with pilot schools. Does the hedge at the start weaken it?",
    },
    {
      turnId: 12,
      speaker: 'assistant',
      text: "No — the hedge is a strength here. It shows you're conceding scope honestly, which makes the concrete ask more credible. Ending on the pilot-school commitment gives the conclusion a call to action the body has earned.",
    },
  ],
};

export const maya: ExemplarDef = {
  id: 'exemplar-maya',
  name: 'Maya R. — Convergent / Collaborative',
  description:
    'Pattern: trace and product scores converge, with constructive AI engagement. The student originates the claim, stress-tests it, verifies a statistic, and plans structure herself. Strongest-validity case (spec §6).',
  essay,
  trace,
  scoreSeeds: [
    // ---- Product channel ----
    {
      criterionId: 'W1a-1', channel: 'product', passes: [5, 5, 4],
      evidence: [{
        quote: 'Maryland high schools should move their start times to 8:30 a.m. or later, even if doing so requires reorganizing bus routes and athletic schedules',
        reasoning: 'Precise, arguable claim with an explicit scope condition (accepting the logistics tradeoff) that anticipates the complexity of the issue — matches the level-5 anchor.',
      }],
      anchorMatched: 'A precise, knowledgeable claim is stated with well-chosen qualifiers or scope conditions that anticipate the complexity of the issue.',
    },
    {
      criterionId: 'W1a-2', channel: 'product', passes: [4, 4, 5],
      evidence: [{
        quote: 'Critics argue that later start times merely shift the whole day back without adding sleep; the evidence shows otherwise.',
        reasoning: 'The opposing claim is stated fairly in the introduction and the writer’s claim is explicitly set against it; the boundary is maintained through the counterclaim paragraphs.',
      }],
      anchorMatched: 'Opposing claim(s) are stated fairly and the writer’s claim is clearly and consistently distinguished from them.',
    },
    {
      criterionId: 'W1b-1', channel: 'product', passes: [4, 4, 4],
      evidence: [{
        quote: 'students gained a median of 34 minutes of sleep per night and that final grades rose by 4.5 percent',
        reasoning: 'Each reason is supported with named, specific evidence (AAP/CDC recommendation, Seattle study, RAND projection).',
      }],
      anchorMatched: 'Each reason is supported with relevant, specific evidence (named sources, data, or concrete cases).',
    },
    {
      criterionId: 'W1b-2', channel: 'product', passes: [4, 5, 4],
      evidence: [{
        quote: 'This objection deserves to be taken seriously, because transportation is often the largest line item a district can actually adjust.',
        reasoning: 'The cost counterclaim is developed in a strong form, its validity is conceded, and the rebuttal (RAND projection) argues its limitation with evidence.',
      }],
      anchorMatched: 'A counterclaim is developed fairly: its strengths are acknowledged and its limitations are argued with evidence.',
    },
    {
      criterionId: 'W1b-3', channel: 'product', passes: [4, 3, 4],
      evidence: [{
        quote: 'because transportation is often the largest line item a district can actually adjust',
        reasoning: 'Framing consistently addresses what a district-level audience (boards, administrators) values: budgets, logistics, phased implementation.',
      }],
      anchorMatched: 'Explanations, framing, and concessions are consistently pitched to a defined audience’s knowledge and values.',
    },
    {
      criterionId: 'W1c-1', channel: 'product', passes: [4, 4, 4],
      evidence: [{
        quote: 'However, an economic analysis by the RAND Corporation projected',
        reasoning: 'Concession and contrast are signaled precisely where the logic turns (However, Yet, In other words); relationships between claims, reasons, evidence are consistently clarified.',
      }],
      anchorMatched: 'Varied syntax and linking language consistently clarify claim-reason-evidence relationships within and across paragraphs.',
    },
    {
      criterionId: 'W1c-2', channel: 'product', passes: [4, 4, 5],
      evidence: [{
        quote: 'Opponents of later start times raise a genuine concern: cost.',
        reasoning: 'Deliberate sequencing: biology first, then the strongest objection conceded before the RAND rebuttal, then the weaker athletics objection — the argument builds.',
      }],
      anchorMatched: 'Reasons and evidence are deliberately sequenced (e.g., concession before rebuttal, weaker to stronger) and the argument builds.',
    },
    {
      criterionId: 'W1d-1', channel: 'product', passes: [4, 4, 4],
      evidence: [{
        quote: 'Convenience adjusted; biology did not.',
        reasoning: 'Formal academic register throughout; rhetorical compression is deliberate rather than casual.',
      }],
      anchorMatched: 'Formal style maintained throughout; diction is appropriate to academic argument.',
    },
    {
      criterionId: 'W1d-2', channel: 'product', passes: [4, 4, 4],
      evidence: [{
        quote: 'Opponents of later start times raise a genuine concern: cost.',
        reasoning: 'Objective tone; the opposing position is characterized in terms its proponents would accept ("a genuine concern").',
      }],
      anchorMatched: 'Objective tone throughout; emotional resonance, where present, is grounded in evidence.',
    },
    {
      criterionId: 'W1e-1', channel: 'product', passes: [5, 4, 4],
      evidence: [{
        quote: 'The cost of the change is measured in bus routes; the cost of the status quo is measured in students.',
        reasoning: 'Conclusion synthesizes the argument including the counterclaim’s disposition and ends with a concrete, earned call to action (pilot schools, three-year commitment).',
      }],
      anchorMatched: 'The conclusion synthesizes the argument (including the counterclaim’s disposition) and articulates implications or a call to action that the body has earned.',
    },
    {
      criterionId: 'L1-1', channel: 'product', passes: [5, 5, 4],
      evidence: [{
        quote: 'This is not a failure of discipline; it is a failure of scheduling.',
        reasoning: 'Essentially error-free; semicolons and parallelism used rhetorically.',
      }],
      anchorMatched: 'Essentially error-free, with conventions used rhetorically (deliberate fragments, punctuation for emphasis) where appropriate.',
    },
    {
      criterionId: 'WR-1', channel: 'product', passes: [4, 4, 3],
      evidence: [{
        quote: 'A real cost, in short, is outweighed by a larger and better-documented benefit.',
        reasoning: 'ADVISORY: reasons are integrated and weighed against the counterclaim (relational, SOLO level 4). Teacher judgment requested.',
      }],
    },
    // ---- Trace channel ----
    {
      criterionId: 'W1a-1', channel: 'trace', passes: [4, 5, 4],
      evidence: [{
        turnId: 3,
        quote: 'Because adolescent circadian rhythms shift sleep onset later, Maryland high schools should start at 8:30 or later, even if it means reorganizing bus routes.',
        reasoning: 'The student authored and revised the claim herself, adding the qualifier deliberately ("I added the bus part on purpose"). Student-originated precision.',
      }],
    },
    {
      criterionId: 'W1a-2', channel: 'trace', passes: [4, 4, 4],
      evidence: [{
        turnId: 5,
        quote: "that's the counterclaim I'll develop fairly instead of strawmanning",
        reasoning: 'The student distinguishes her position from specific opposing claims and selects which to engage — student-authored differentiation.',
      }],
    },
    {
      criterionId: 'W1b-1', channel: 'trace', passes: [4, 4, 3],
      evidence: [{
        turnId: 7,
        quote: "is that a rise in final grades or in test scores specifically? I don't want to cite it inaccurately",
        reasoning: 'The student interrogates the relevance and accuracy of evidence before using it — evidence-selection behavior originating with the student.',
      }],
    },
    {
      criterionId: 'W1b-2', channel: 'trace', passes: [4, 4, 4],
      evidence: [{
        turnId: 5,
        quote: "I think the cost one is the strongest objection because it's the only one with a real budget number attached",
        reasoning: 'The student evaluates competing objections and commits to developing the strongest fairly — counterclaim reasoning in her own words.',
      }],
    },
    { criterionId: 'W1b-3', channel: 'trace', passes: [3, 3, 4],
      evidence: [{
        turnId: 7,
        quote: 'my teacher checks sources',
        reasoning: 'ADVISORY: some audience awareness (accuracy for a source-checking reader), but audience reasoning is thin in the dialogue.',
      }],
    },
    { criterionId: 'W1c-1', channel: 'trace', passes: ['no-evidence', 'no-evidence', 'no-evidence'] },
    {
      criterionId: 'W1c-2', channel: 'trace', passes: [4, 4, 5],
      evidence: [{
        turnId: 9,
        quote: "I'm going to put the concession about bus costs right before my strongest evidence, the RAND cost-benefit projection, so the rebuttal lands immediately",
        reasoning: 'The student articulates a deliberate persuasive sequence (concession before rebuttal) — sequencing reasoning originated by the student.',
      }],
    },
    { criterionId: 'W1d-1', channel: 'trace', passes: ['no-evidence', 'no-evidence', 'no-evidence'] },
    { criterionId: 'W1d-2', channel: 'trace', passes: ['no-evidence', 'no-evidence', 'no-evidence'] },
    {
      criterionId: 'W1e-1', channel: 'trace', passes: [4, 4, 4],
      evidence: [{
        turnId: 11,
        quote: 'Then I want to end with a concrete ask — a three-year commitment with pilot schools. Does the hedge at the start weaken it?',
        reasoning: 'The student drafted her own conclusion, chose the hedge and the call to action herself, and sought critique rather than text.',
      }],
    },
    { criterionId: 'L1-1', channel: 'trace', passes: ['no-evidence', 'no-evidence', 'no-evidence'] },
    {
      criterionId: 'WR-1', channel: 'trace', passes: [4, 4, 4],
      evidence: [{
        turnId: 5,
        quote: 'The displacement one I can beat with the Seattle study since students actually gained sleep.',
        reasoning: 'ADVISORY: the student maps specific evidence onto specific objections — relational reasoning in her own words. Teacher judgment requested.',
      }],
    },
  ],
  layerBSegments: [
    { segmentTurns: [1, 2], helpSeeking: 'constructive', responseUse: 'constructive', verification: false, evidence: 'Brings her own working claim and asks a targeted critique question about precision.' },
    { segmentTurns: [2, 3, 4], helpSeeking: 'constructive', responseUse: 'constructive', verification: false, evidence: 'Revises the claim herself, explains the revision, and asks for the strongest objection to stress-test it.' },
    { segmentTurns: [4, 5, 6], helpSeeking: 'active', responseUse: 'constructive', verification: false, evidence: 'Evaluates which objection is strongest and assigns evidence to objections before requesting a specific fact.' },
    { segmentTurns: [6, 7, 8], helpSeeking: 'active', responseUse: 'constructive', verification: true, evidence: 'Challenges the 4.5% statistic and pins down its exact scope before citing it.' },
    { segmentTurns: [8, 9, 10], helpSeeking: 'constructive', responseUse: 'constructive', verification: false, evidence: 'Announces her own structural plan (concession before rebuttal); uses the assistant as a sounding board.' },
    { segmentTurns: [10, 11, 12], helpSeeking: 'constructive', responseUse: 'constructive', verification: false, evidence: 'Drafts her own conclusion and asks whether a specific rhetorical choice weakens it.' },
  ],
};
