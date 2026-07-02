import type { Rubric, RubricCriterion, Trace } from '../../types';

// Evidence-before-score output contract (spec §5.2): the model must quote evidence
// and reason against the anchors BEFORE emitting a score. `no-evidence` is a valid
// outcome, never a guessed score.
export const GRADING_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    evidence: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          turnId: { type: ['integer', 'null'], description: 'Trace channel only: turnId the quote comes from. null for essay.' },
          quote: { type: 'string', description: 'VERBATIM quote of student text bearing on the criterion. Max ~40 words.' },
          reasoning: { type: 'string', description: 'How this evidence maps onto the anchored level descriptors.' },
        },
        required: ['quote', 'reasoning'],
        additionalProperties: false,
      },
    },
    anchorMatched: { type: 'string', description: 'The level descriptor text that best matches the evidence.' },
    score: {
      type: ['integer', 'string'],
      description: 'Integer 0-5, or the string "no-evidence" if the source contains no evidence bearing on this criterion.',
    },
    selfConfidence: { type: 'string', enum: ['low', 'med', 'high'] },
  },
  required: ['evidence', 'score', 'selfConfidence'],
  additionalProperties: false,
};

function anchorsBlock(c: RubricCriterion): string {
  return Object.entries(c.anchors)
    .map(([level, desc]) => `  ${level}: ${desc}`)
    .join('\n');
}

function guidanceBlock(c: RubricCriterion, rubric: Rubric): string {
  const parts: string[] = [];
  if (rubric.assignmentGuidance?.trim()) parts.push(`ASSIGNMENT GUIDANCE FROM THE TEACHER (apply it):\n${rubric.assignmentGuidance.trim()}`);
  if (c.teacherGuidance?.trim()) parts.push(`CRITERION GUIDANCE FROM THE TEACHER (apply it):\n${c.teacherGuidance.trim()}`);
  return parts.length ? '\n' + parts.join('\n\n') + '\n' : '';
}

const SHARED_RULES = `Rules (non-negotiable):
1. Score ONLY the single criterion given. Ignore all other qualities of the writing (halo prevention).
2. Evidence before score: first collect verbatim quotes that bear on the criterion, then reason against the anchors, then score.
3. Every quote must appear VERBATIM in the source. Keep each quote under ~40 words.
4. If the source contains no evidence bearing on this criterion, output "no-evidence" as the score. Never guess.
5. Length is not quality: do not reward verbosity.
6. Output only the JSON object.`;

export function buildProductSystem(): string {
  return `You are a careful assessment rater scoring ONE criterion of a high-school argumentative essay against Maryland College and Career Ready (MCCR) ELA standards. You produce evidence-cited, criterion-referenced preliminary scores for a teacher to review. The teacher is the authoritative evaluator.\n\n${SHARED_RULES}`;
}

export function buildProductPrompt(criterion: RubricCriterion, essay: string, rubric: Rubric): string {
  return `CRITERION ${criterion.criterionId} (${criterion.standard}): ${criterion.statement}

ANCHORED LEVELS (0-5):
${anchorsBlock(criterion)}
${guidanceBlock(criterion, rubric)}
STUDENT ESSAY:
<<<
${essay}
>>>

Collect evidence, reason against the anchors, then score this ONE criterion.`;
}

export function buildTraceSystem(): string {
  return `You are a careful assessment rater scoring ONE criterion of a student's writing proficiency using the student's dialogue with an AI assistant during a writing task. You produce evidence-cited, criterion-referenced preliminary scores for a teacher to review. The teacher is the authoritative evaluator.

STUDENT ATTRIBUTION CONSTRAINT (the most important rule):
Only text authored by the STUDENT counts as evidence of the student's mastery. Text authored by the ASSISTANT never counts, even if the student copies, accepts, or repeats it. If a student turn merely parrots, paraphrases, or accepts assistant-authored content ("yes, use that", "ok thanks", copy-pasting the assistant's sentence back), that turn is NOT evidence of student mastery of this criterion. Evidence of mastery is the student ORIGINATING ideas, evaluating, revising, or reasoning in their own words.

${SHARED_RULES}
7. Each evidence quote must come from a turn labeled speaker="student", and you must report that turnId.`;
}

export function buildTracePrompt(criterion: RubricCriterion, trace: Trace, rubric: Rubric): string {
  const dialogue = trace.turns
    .map((t) => `[turn ${t.turnId} | ${t.speaker.toUpperCase()}]\n${t.text}`)
    .join('\n\n');
  return `CRITERION ${criterion.criterionId} (${criterion.standard}): ${criterion.statement}

ANCHORED LEVELS (0-5):
${anchorsBlock(criterion)}
${guidanceBlock(criterion, rubric)}
DIALOGUE TRACE (student ↔ AI assistant during the writing task):
<<<
${dialogue}
>>>

Using ONLY student-authored turns as evidence, assess what this dialogue reveals about the student's OWN mastery of this criterion. Later turns supersede earlier ones (growth within the task is signal). If the dialogue never touches this criterion, score "no-evidence".`;
}

// ---- Layer B: RelianceScope 3×3 coding ----

export const SEGMENT_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    helpSeeking: {
      type: 'string',
      enum: ['passive', 'active', 'constructive'],
      description: 'How the student sought help in this segment.',
    },
    responseUse: {
      type: 'string',
      enum: ['passive', 'active', 'constructive'],
      description: 'How the student used the AI response in this segment.',
    },
    verification: {
      type: 'boolean',
      description: 'Did the student challenge, check, correct, or substantively revise AI output in this segment?',
    },
    evidence: { type: 'string', description: 'Brief quote/paraphrase justifying the coding.' },
  },
  required: ['helpSeeking', 'responseUse', 'verification', 'evidence'],
  additionalProperties: false,
};

export function buildSegmentSystem(): string {
  return `You code segments of a student-AI writing dialogue on the RelianceScope 3×3 grid (Jin et al., L@S '26). This coding describes HOW the student worked with the AI. It is NOT a writing-quality score and must never be influenced by how good the writing is.

HELP-SEEKING mode (what the student asks for):
- passive: asks the AI to produce the work product itself ("write my thesis", "do the paragraph").
- active: asks targeted questions or requests specific assistance on work the student is doing ("is this evidence relevant?", "how do I cite this?").
- constructive: brings the student's own draft/thinking and asks for critique, verification, or alternatives to weigh ("here's my claim — what's the strongest objection to it?").

RESPONSE-USE mode (what the student does with the answer):
- passive: accepts/copies AI output without engagement.
- active: applies or adapts AI output with some modification or selection.
- constructive: evaluates, challenges, verifies, or substantially transforms AI output; integrates it with the student's own reasoning.

Also flag verification behavior: the student challenging, fact-checking, or correcting the AI (Lee et al., CHI 2025).
Output only the JSON object.`;
}

export function buildSegmentPrompt(segmentText: string): string {
  return `DIALOGUE SEGMENT (one student request and the surrounding exchange):
<<<
${segmentText}
>>>

Code this segment: helpSeeking mode, responseUse mode, verification flag, brief evidence.`;
}
