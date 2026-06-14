/**
 * Extract embedded MIDI data from an Apple Loops .aif file.
 *
 * GarageBand saves software instrument loops as AIFF files with a full
 * standard MIDI file embedded inside as a binary blob. We locate the MIDI
 * by searching for the "MThd" header, then walk all subsequent MTrk chunks
 * to compute the exact byte range to slice out.
 */
export function extractMidi(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  const view = new DataView(arrayBuffer);

  // Locate "MThd" (4D 54 68 64)
  let start = -1;
  for (let i = 0; i <= bytes.length - 8; i++) {
    if (
      bytes[i]     === 0x4d &&
      bytes[i + 1] === 0x54 &&
      bytes[i + 2] === 0x68 &&
      bytes[i + 3] === 0x64
    ) {
      start = i;
      break;
    }
  }

  if (start === -1) return null;

  // MThd layout: ID(4) + size(4, big-endian) + format(2) + numTracks(2) + division(2)
  if (start + 14 > bytes.length) return null;

  const mthdSize  = view.getUint32(start + 4, false);
  const numTracks = view.getUint16(start + 10, false);

  let pos = start + 8 + mthdSize;

  // Walk each MTrk chunk: ID(4) + size(4, big-endian) + data(size)
  for (let t = 0; t < numTracks; t++) {
    if (pos + 8 > bytes.length) break;

    const isMtrk =
      bytes[pos]     === 0x4d &&
      bytes[pos + 1] === 0x54 &&
      bytes[pos + 2] === 0x72 &&
      bytes[pos + 3] === 0x6b;

    if (!isMtrk) break;

    const trkSize = view.getUint32(pos + 4, false);
    pos += 8 + trkSize;
  }

  if (pos <= start) return null;

  return bytes.slice(start, pos);
}
