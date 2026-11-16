// All choice scenes (see scenes-core.js for the format). Beats drawn at random by engine/scenes.js.
import { SCENES_A } from './scenes-a.js';
import { SCENES_B } from './scenes-b.js';

export const SCENES = [...SCENES_A, ...SCENES_B];
export const SCENE_BY_ID = Object.fromEntries(SCENES.map((s) => [s.id, s]));
