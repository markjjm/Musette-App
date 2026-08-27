import { ok, strictEqual, deepStrictEqual } from 'node:assert';

/* GoldenCheetah & Jeukendrup Substrate Oxidation Model */
export function calculateSubstrateOxidation(stats, ftp = 250) {
  const durationSecs = Number(stats.secs) || Number(stats.total_timer_time) || 0;
  const avgWatts = Number(stats.avg_watts) || Number(stats.avg_power) || 0;
  const np = Number(stats.np) || Number(stats.normalized_power) || avgWatts;
  const totalKcal = Number(stats.kcal) || Number(stats.total_calories) || (avgWatts > 0 && durationSecs > 0 ? Math.round((avgWatts * durationSecs) / 1000) : 0);

  const effFtp = Math.max(100, Number(ftp) || 250);
  const intensity = np > 0 ? (np / effFtp) : (avgWatts > 0 ? avgWatts / effFtp : 0.65);

  // Substrate curve: CHO % increases non-linearly with % of FTP
  let choPct;
  if (intensity <= 0.40) {
    choPct = 0.20;
  } else if (intensity <= 1.00) {
    choPct = 0.20 + 0.75 * Math.pow((intensity - 0.40) / 0.60, 1.2);
  } else {
    choPct = Math.min(1.0, 0.95 + 0.05 * (intensity - 1.0));
  }
  choPct = Math.max(0.15, Math.min(1.0, choPct));

  const fatPct = 1 - choPct;
  const choKcal = totalKcal * choPct;
  const fatKcal = totalKcal * fatPct;

  const choGrams = Math.round(choKcal / 4.0);
  const fatGrams = Math.round(fatKcal / 9.0);

  const ifFactor = Math.round((np / effFtp) * 1000) / 1000;
  const tss = effFtp > 0 && durationSecs > 0
    ? Math.round(((durationSecs * np * ifFactor) / (effFtp * 3600)) * 100)
    : 0;

  return {
    totalKcal,
    np: Math.round(np),
    intensity: Math.round(intensity * 100) / 100,
    ifFactor,
    tss,
    choPct: Math.round(choPct * 100),
    fatPct: Math.round(fatPct * 100),
    choGrams,
    fatGrams,
  };
}

/* Binary FIT Protocol Parser (Zero-dependency JavaScript decoder) */
export function parseFitBinary(buffer) {
  const bytes = new Uint8Array(buffer instanceof ArrayBuffer ? buffer : buffer.buffer || buffer);
  if (bytes.length < 14) throw new Error('File too small to be a FIT file');

  const headerSize = bytes[0];
  if (headerSize !== 14 && headerSize !== 12) throw new Error('Invalid FIT header size: ' + headerSize);

  const tag = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
  if (tag !== '.FIT') throw new Error('Missing .FIT signature tag');

  const dataSize = bytes[4] | (bytes[5] << 8) | (bytes[6] << 16) | (bytes[7] << 24);
  const endOffset = Math.min(bytes.length, headerSize + dataSize);

  let offset = headerSize;
  const localDefs = {};
  const records = [];
  let session = null;
  const laps = [];

  const FIT_EPOCH_DIFF = 631065600; // 1989-12-31 to 1970-01-01 in seconds

  function readVal(type, len, arch) {
    if (offset + len > endOffset) return null;
    let v = 0;
    if (len === 1) {
      v = bytes[offset];
      offset += 1;
      return v === 0xFF ? null : v;
    }
    if (len === 2) {
      v = arch === 0 ? (bytes[offset] | (bytes[offset + 1] << 8)) : ((bytes[offset] << 8) | bytes[offset + 1]);
      offset += 2;
      return v === 0xFFFF ? null : v;
    }
    if (len === 4) {
      v = arch === 0
        ? (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24))
        : ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]);
      offset += 4;
      return v === 0xFFFFFFFF || v === -1 ? null : v;
    }
    offset += len;
    return null;
  }

  while (offset < endOffset) {
    const recordHeader = bytes[offset++];
    const isCompressed = (recordHeader & 0x80) !== 0;

    if (isCompressed) {
      // Compressed timestamp record
      const localType = (recordHeader >> 5) & 0x03;
      const def = localDefs[localType];
      if (def) {
        // Skip data fields for compressed header
        offset += def.totalSize;
      }
      continue;
    }

    const isDefinition = (recordHeader & 0x40) !== 0;
    const hasDevData = (recordHeader & 0x20) !== 0;
    const localType = recordHeader & 0x0F;

    if (isDefinition) {
      if (offset + 5 > endOffset) break;
      const reserved = bytes[offset++];
      const arch = bytes[offset++]; // 0 = LE, 1 = BE
      const globalMsgNum = arch === 0 ? (bytes[offset] | (bytes[offset + 1] << 8)) : ((bytes[offset] << 8) | bytes[offset + 1]);
      offset += 2;
      const numFields = bytes[offset++];

      const fields = [];
      let totalSize = 0;
      for (let i = 0; i < numFields; i++) {
        if (offset + 3 > endOffset) break;
        const fieldDefNum = bytes[offset++];
        const size = bytes[offset++];
        const baseType = bytes[offset++];
        fields.push({ fieldDefNum, size, baseType });
        totalSize += size;
      }

      if (hasDevData) {
        const numDevFields = bytes[offset++] || 0;
        for (let d = 0; d < numDevFields; d++) {
          if (offset + 3 > endOffset) break;
          const num = bytes[offset++];
          const size = bytes[offset++];
          const idx = bytes[offset++];
          totalSize += size;
        }
      }

      localDefs[localType] = { globalMsgNum, arch, fields, totalSize };
    } else {
      // Data Message
      const def = localDefs[localType];
      if (!def) {
        break; // Unknown record without definition
      }

      const msg = {};
      const startOfData = offset;
      for (const f of def.fields) {
        const val = readVal(f.baseType, f.size, def.arch);
        if (val !== null) msg[f.fieldDefNum] = val;
      }

      if (def.globalMsgNum === 20) {
        // Record message
        const ts = msg[253] ? new Date((msg[253] + FIT_EPOCH_DIFF) * 1000).toISOString() : null;
        records.push({
          timestamp: ts,
          lat: msg[0] != null ? msg[0] * (180 / 2147483648) : null,
          lng: msg[1] != null ? msg[1] * (180 / 2147483648) : null,
          altitude: msg[2] != null ? (msg[2] / 5) - 500 : null,
          hr: msg[3] || null,
          cadence: msg[4] || null,
          distance: msg[5] != null ? (msg[5] / 100) : null, // meters
          speed: msg[6] != null ? (msg[6] / 1000) * 2.23694 : null, // mph
          power: msg[7] || null,
        });
      } else if (def.globalMsgNum === 18) {
        // Session message
        const sportCode = msg[5] || 0;
        const sports = { 1: 'Run', 2: 'Ride', 5: 'Swim', 11: 'Workout', 15: 'Walk' };
        session = {
          sport: sports[sportCode] || 'Ride',
          startTime: msg[2] ? new Date((msg[2] + FIT_EPOCH_DIFF) * 1000).toISOString() : null,
          totalSecs: msg[8] != null ? Math.round(msg[8] / 1000) : (msg[7] != null ? Math.round(msg[7] / 1000) : 0),
          totalMiles: msg[9] != null ? Math.round((msg[9] / 100) * 0.000621371 * 10) / 10 : 0,
          totalCalories: msg[11] || 0,
          avgSpeedMph: msg[14] != null ? Math.round((msg[14] / 1000) * 2.23694 * 10) / 10 : 0,
          maxSpeedMph: msg[15] != null ? Math.round((msg[15] / 1000) * 2.23694 * 10) / 10 : 0,
          avgHr: msg[16] || 0,
          maxHr: msg[17] || 0,
          avgCadence: msg[18] || 0,
          avgPower: msg[20] || 0,
          maxPower: msg[21] || 0,
          elevationGainFt: msg[22] != null ? Math.round(msg[22] * 3.28084) : 0,
          normalizedPower: msg[34] || 0,
          tss: msg[35] != null ? Math.round(msg[35] / 10) : 0,
          intensityFactor: msg[36] != null ? Math.round((msg[36] / 1000) * 100) / 100 : 0,
          workKj: msg[48] != null ? Math.round(msg[48] / 1000) : 0,
        };
      } else if (def.globalMsgNum === 19) {
        // Lap message
        laps.push({
          secs: msg[8] != null ? Math.round(msg[8] / 1000) : 0,
          miles: msg[9] != null ? Math.round((msg[9] / 100) * 0.000621371 * 10) / 10 : 0,
          watts: msg[20] || 0,
          hr: msg[16] || 0,
        });
      }
    }
  }

  // Fallbacks if session message was absent
  const durationSecs = session?.totalSecs || records.length || 0;
  const powers = records.map(r => r.power).filter(p => typeof p === 'number' && p > 0);
  const avgWatts = session?.avgPower || (powers.length ? Math.round(powers.reduce((a, b) => a + b, 0) / powers.length) : 0);
  const hrs = records.map(r => r.hr).filter(h => typeof h === 'number' && h > 0);
  const avgHr = session?.avgHr || (hrs.length ? Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length) : 0);

  return {
    session: session || {
      sport: 'Ride',
      totalSecs: durationSecs,
      totalMiles: 0,
      totalCalories: avgWatts > 0 ? Math.round((avgWatts * durationSecs) / 1000) : 0,
      avgPower: avgWatts,
      avgHr,
    },
    records,
    laps,
  };
}

/* --- Tests --- */
console.log('1. Substrate oxidation calculations (GoldenCheetah / Jeukendrup)');
const z2Ride = calculateSubstrateOxidation({ secs: 5400, avg_watts: 175, np: 180 }, 250);
ok(z2Ride.totalKcal > 900, 'Z2 90min ride burns significant energy (~900-1000 kcal)');
ok(z2Ride.choPct >= 40 && z2Ride.choPct <= 60, 'Z2 ride (~72% FTP) uses ~40-60% carbohydrate oxidation');
ok(z2Ride.choGrams > 90, 'Z2 ride estimates accurate grams of muscle glycogen burned');
ok(z2Ride.fatGrams > 30, 'Z2 ride estimates substantial fat oxidation');

const sweetspot = calculateSubstrateOxidation({ secs: 3600, avg_watts: 225, np: 230 }, 250);
ok(sweetspot.choPct > 70, 'Sweetspot (~92% FTP) is heavily carbohydrate reliant (>70% CHO)');
ok(sweetspot.choGrams > 140, 'Sweetspot drains ~140-180g of muscle glycogen in 60 mins');

const recovery = calculateSubstrateOxidation({ secs: 3600, avg_watts: 100, np: 100 }, 250);
ok(recovery.choPct <= 25, 'Zone 1 recovery (40% FTP) burns primarily fat (>=75% fat, <=25% CHO)');

console.log('\n2. FIT Binary Header Validation');
const sampleHeader = new Uint8Array([
  14, // header size
  0x10, // protocol version
  0x10, 0x08, // profile version
  0x00, 0x00, 0x00, 0x00, // data size = 0
  0x2E, 0x46, 0x49, 0x54, // .FIT
  0x00, 0x00 // CRC
]);
const parsed = parseFitBinary(sampleHeader);
strictEqual(parsed.records.length, 0, 'Empty valid FIT file decodes cleanly');
strictEqual(parsed.session.sport, 'Ride', 'Default sport is Ride');

console.log('\nAll FIT parser and substrate tests passed.');
