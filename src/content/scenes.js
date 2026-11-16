// All choice scenes (see scenes-core.js for the format). Beats drawn at random by engine/scenes.js.
import { SCENES_A } from './scenes-a.js';
import { SCENES_B } from './scenes-b.js';
import { SCENES_C } from './scenes-c.js';
import { SCENES_D } from './scenes-d.js';
import { SCENES_E } from './scenes-e.js';
import { SCENES_F } from './scenes-f.js';

export const SCENES = [...SCENES_A, ...SCENES_B, ...SCENES_C, ...SCENES_D, ...SCENES_E, ...SCENES_F];
export const SCENE_BY_ID = Object.fromEntries(SCENES.map((s) => [s.id, s]));
