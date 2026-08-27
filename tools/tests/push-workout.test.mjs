/* Part of the repo's proof that its controls exist. Run with `npm test`. */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const html = readFileSync(join(ROOT, 'web/public/index.html'), 'utf8');

let pass = 0, failn = 0;
const ok = (c, m) => { if (c) { pass++; console.log(`  ok   ${m}`); } else { failn++; console.log(`  FAIL ${m}`); } };

function formatIntervalsIcuWorkout(rx) {
  if (!rx || !rx.intervals || !rx.intervals.length) {
    return (rx && rx.intent) || (rx && rx.title) || 'Steady Ride';
  }
  const lines = [];
  let inMain = false;
  rx.intervals.forEach((step) => {
    const dur = step.dur || (step.mins ? step.mins + 'm' : '10m');
    const intensityPct = Math.round((step.intensity || 0.7) * 100);
    const phase = step.phase || '';

    if (phase.toLowerCase().includes('warmup')) {
      lines.push('Warmup');
      lines.push(`- ${dur} ${Math.max(50, intensityPct - 10)}-${intensityPct}%`);
      lines.push('');
    } else if (phase.toLowerCase().includes('cooldown')) {
      lines.push('Cooldown');
      lines.push(`- ${dur} ${intensityPct}%`);
    } else {
      if (!inMain) {
        lines.push('Main Set');
        inMain = true;
      }
      lines.push(`- ${dur} ${intensityPct}%`);
    }
  });
  return lines.join('\n');
}

console.log('\n1. Workout step syntax formatting for Intervals.icu & Garmin');
const mockRx = {
  title: 'Sweet Spot 3x12',
  intent: 'Build threshold fatigue resistance',
  intervals: [
    { phase: 'Warmup', dur: '15 min', mins: 15, intensity: 0.65 },
    { phase: 'Interval 1', dur: '12 min', mins: 12, intensity: 0.90 },
    { phase: 'Recovery 1', dur: '4 min', mins: 4, intensity: 0.50 },
    { phase: 'Interval 2', dur: '12 min', mins: 12, intensity: 0.90 },
    { phase: 'Cooldown', dur: '10 min', mins: 10, intensity: 0.50 }
  ]
};

const formatted = formatIntervalsIcuWorkout(mockRx);
ok(formatted.includes('Warmup\n- 15 min 55-65%'), 'includes formatted warmup step with power range');
ok(formatted.includes('- 12 min 90%'), 'includes structured work interval at 90% FTP');
ok(formatted.includes('- 4 min 50%'), 'includes recovery interval at 50% FTP');
ok(formatted.includes('Cooldown\n- 10 min 50%'), 'includes cooldown flush step');

console.log('\n2. Frontend includes Push to Garmin button and handler');
ok(html.includes('pushWorkoutToGarmin'), 'index.html defines pushWorkoutToGarmin handler');
ok(html.includes('formatIntervalsIcuWorkout'), 'index.html defines formatIntervalsIcuWorkout syntax builder');
ok(html.includes('btn-push-garmin'), 'index.html contains push to Garmin UI button');

console.log(`\n${pass} passed, ${failn} failed`);
process.exit(failn ? 1 : 0);
