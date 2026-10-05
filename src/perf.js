// Automatic quality: watch the frame rate and lower the render resolution when it falls behind,
// then creep back up once there's headroom again.
import { settings, quality, applyPixelRatio } from './settings.js';

const LEVELS = [1, .85, .72, .6, .5, .4];
let level = 0, time = 0, frames = 0, good = 0, cooldown = 0;
export const stats = { fps: 0 };

export function perfTick(dt){
  if (dt > 1) return;                 // a hidden tab or a long hitch, not a slow GPU
  time += dt; frames++;
  cooldown = Math.max(0, cooldown-dt);
  if (time < 2) return;
  stats.fps = frames/time;
  time = frames = 0;
  if (settings.quality!=='auto'){ level = 0; return; }
  const target = settings.fps > 0 ? Math.min(settings.fps, 60) : 60;
  if (stats.fps < target*.8 && level < LEVELS.length-1){
    level++; good = 0; cooldown = 10;   // don't try going back up straight away
  } else if (stats.fps > target*.95 && level > 0 && cooldown === 0){
    if (++good >= 3){ level--; good = 0; }   // six smooth seconds before stepping up
  } else good = 0;
  if (quality.auto !== LEVELS[level]){ quality.auto = LEVELS[level]; applyPixelRatio(); }
}
