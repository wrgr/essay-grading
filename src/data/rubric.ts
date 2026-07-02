import rubricJson from '../../rubrics/mccr-w11-12-arg-v1.json';
import type { Rubric } from '../types';

export const BASE_RUBRIC: Rubric = {
  rubricId: rubricJson.rubricId,
  version: rubricJson.version,
  genre: rubricJson.genre,
  assignmentGuidance: rubricJson.assignmentGuidance,
  criteria: rubricJson.criteria as Rubric['criteria'],
};
