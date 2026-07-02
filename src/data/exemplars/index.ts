import type { Rubric, Session } from '../../types';
import { expandExemplar } from '../expand';
import { maya } from './maya';
import { jordan } from './jordan';
import { sam } from './sam';
import { alex } from './alex';

export const EXEMPLAR_DEFS = [maya, jordan, sam, alex];

export function buildExemplarSessions(rubric: Rubric): Session[] {
  return EXEMPLAR_DEFS.map((d) => expandExemplar(d, rubric));
}
