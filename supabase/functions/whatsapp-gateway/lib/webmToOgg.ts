// Minimal WebM (EBML/Matroska) -> Ogg/Opus remuxer.
// Designed for MediaRecorder output: single Opus audio track.
// No re-encode — extracts raw Opus packets from SimpleBlocks and wraps in Ogg pages.

class Reader {
  pos = 0;
  constructor(public buf: Uint8Array) {}
  readVintLength(): number {
    const first = this.buf[this.pos];
    if (first === undefined) throw new Error('EOF');
    let len = 0;
    let mask = 0x80;
    while (mask && !(first & mask)) { len++; mask >>= 1; }
    return len + 1;
  }
  readVint(keepMarker = false): number {
    const len = this.readVintLength();
    let val = 0n;
    for (let i = 0; i < len; i++) {
      val = (val << 8n) | BigInt(this.buf[this.pos + i] ?? 0);
    }
    if (!keepMarker) {
      // clear leading 1-bit marker
      const totalBits = BigInt(len * 8);
      const markerBit = totalBits - BigInt(len);
      val = val & ((1n << markerBit) - 1n);
    }
    this.pos += len;
    return Number(val);
  }
  readId(): number {
    const len = this.readVintLength();
    let val = 0;
    for (let i = 0; i < len; i++) val = (val << 8) | (this.buf[this.pos + i] ?? 0);
    this.pos += len;
    return val;
  }
  readBytes(n: number): Uint8Array {
    const out = this.buf.subarray(this.pos, this.pos + n);
    this.pos += n;
    return out;
  }
  eof() { return this.pos >= this.buf.length; }
}

// CRC-32 for Ogg (poly 0x04c11db7, no reflection)
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let r = i << 24;
    for (let j = 0; j < 8; j++) r = (r & 0x80000000) ? ((r << 1) ^ 0x04c11db7) >>> 0 : (r << 1) >>> 0;
    t[i] = r >>> 0;
  }
  return t;
})();
function oggCrc(data: Uint8Array): number {
  let crc = 0;
  for (let i = 0; i < data.length; i++) crc = ((crc << 8) ^ CRC_TABLE[((crc >>> 24) ^ data[i]) & 0xff]) >>> 0;
  return crc;
}

function buildOggPage(packets: Uint8Array[], headerType: number, granulePos: bigint, serial: number, pageSeq: number): Uint8Array {
  // Build segment table
  const segTable: number[] = [];
  for (const p of packets) {
    let len = p.length;
    while (len >= 255) { segTable.push(255); len -= 255; }
    segTable.push(len);
  }
  if (segTable.length > 255) throw new Error('Too many segments in one page');
  const dataLen = packets.reduce((s, p) => s + p.length, 0);
  const headerLen = 27 + segTable.length;
  const page = new Uint8Array(headerLen + dataLen);
  const dv = new DataView(page.buffer);
  page.set([0x4f, 0x67, 0x67, 0x53]); // OggS
  page[4] = 0; // version
  page[5] = headerType;
  // granule position (64-bit LE)
  dv.setBigUint64(6, granulePos, true);
  dv.setUint32(14, serial, true);
  dv.setUint32(18, pageSeq, true);
  dv.setUint32(22, 0, true); // CRC placeholder
  page[26] = segTable.length;
  page.set(segTable, 27);
  let offset = headerLen;
  for (const p of packets) { page.set(p, offset); offset += p.length; }
  const crc = oggCrc(page);
  dv.setUint32(22, crc, true);
  return page;
}

function buildOpusHead(channels: number, sampleRate: number, preSkip: number): Uint8Array {
  const head = new Uint8Array(19);
  head.set([0x4f, 0x70, 0x75, 0x73, 0x48, 0x65, 0x61, 0x64]); // "OpusHead"
  head[8] = 1; // version
  head[9] = channels;
  const dv = new DataView(head.buffer);
  dv.setUint16(10, preSkip, true);
  dv.setUint32(12, sampleRate, true);
  dv.setInt16(16, 0, true); // output gain
  head[18] = 0; // mapping family
  return head;
}

function buildOpusTags(): Uint8Array {
  const vendor = new TextEncoder().encode('lordcred-remux');
  const buf = new Uint8Array(8 + 4 + vendor.length + 4);
  buf.set([0x4f, 0x70, 0x75, 0x73, 0x54, 0x61, 0x67, 0x73]); // "OpusTags"
  const dv = new DataView(buf.buffer);
  dv.setUint32(8, vendor.length, true);
  buf.set(vendor, 12);
  dv.setUint32(12 + vendor.length, 0, true); // user comment list length
  return buf;
}

interface OpusFrame { data: Uint8Array; samples: number; }

// Decode Opus TOC to get number of samples in this packet (assuming 48kHz)
function opusFrameSamples(packet: Uint8Array): number {
  if (packet.length < 1) return 0;
  const toc = packet[0];
  const config = toc >> 3;
  const c = toc & 0x03;
  // frame size in microseconds per config index
  const frameUs = [
    10000, 20000, 40000, 60000, // SILK NB
    10000, 20000, 40000, 60000, // SILK MB
    10000, 20000, 40000, 60000, // SILK WB
    10000, 20000,               // Hybrid SWB
    10000, 20000,               // Hybrid FB
    2500, 5000, 10000, 20000,   // CELT NB
    2500, 5000, 10000, 20000,   // CELT WB
    2500, 5000, 10000, 20000,   // CELT SWB
    2500, 5000, 10000, 20000,   // CELT FB
  ][config] || 20000;
  let frames = 1;
  if (c === 1 || c === 2) frames = 2;
  else if (c === 3 && packet.length >= 2) frames = packet[1] & 0x3f;
  return Math.round((frameUs * frames * 48) / 1000);
}

export function webmOpusToOgg(webm: Uint8Array): Uint8Array {
  const r = new Reader(webm);
  let opusPrivate: Uint8Array | null = null;
  let channels = 1;
  let sampleRate = 48000;
  let preSkip = 3840;
  let opusTrackNumber = -1;
  const packets: Uint8Array[] = [];
  const sampleCounts: number[] = [];

  function parseElement(end: number) {
    while (r.pos < end && !r.eof()) {
      const id = r.readId();
      const size = r.readVint();
      const elEnd = r.pos + size;
      // Master elements we descend into
      if (id === 0x1a45dfa3 /* EBML */ ||
          id === 0x18538067 /* Segment */ ||
          id === 0x1654ae6b /* Tracks */ ||
          id === 0xae /* TrackEntry */ ||
          id === 0x1f43b675 /* Cluster */) {
        parseElement(elEnd);
      } else if (id === 0xd7 /* TrackNumber */ && opusPrivate === null) {
        // pending: collect TrackNumber within current TrackEntry — use lookahead approach
        const tn = readUint(r.readBytes(size));
        // store last seen track number candidate
        (parseElement as any)._lastTn = tn;
      } else if (id === 0x86 /* CodecID */) {
        const codec = new TextDecoder().decode(r.readBytes(size));
        if (codec === 'A_OPUS') {
          opusTrackNumber = (parseElement as any)._lastTn ?? -1;
        }
      } else if (id === 0x63a2 /* CodecPrivate */) {
        const data = r.readBytes(size);
        if ((parseElement as any)._lastTn === opusTrackNumber || opusTrackNumber === -1) {
          opusPrivate = new Uint8Array(data);
        }
      } else if (id === 0x9f /* Channels */) {
        channels = readUint(r.readBytes(size));
      } else if (id === 0xb5 /* SamplingFrequency (float) */) {
        const bytes = r.readBytes(size);
        const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        sampleRate = size === 4 ? dv.getFloat32(0) : dv.getFloat64(0);
      } else if (id === 0x56bb /* SeekPreRoll */ || id === 0x56aa /* CodecDelay */) {
        // not strictly needed
        r.readBytes(size);
      } else if (id === 0xa3 /* SimpleBlock */) {
        const block = r.readBytes(size);
        const br = new Reader(block);
        const trackNum = br.readVint();
        if (trackNum === opusTrackNumber) {
          br.readBytes(2); // timecode (int16)
          br.readBytes(1); // flags
          const payload = block.subarray(br.pos);
          packets.push(new Uint8Array(payload));
          sampleCounts.push(opusFrameSamples(payload));
        }
      } else {
        r.readBytes(size);
      }
    }
  }
  function readUint(b: Uint8Array): number {
    let v = 0; for (const x of b) v = (v << 8) | x; return v;
  }

  parseElement(webm.length);

  if (packets.length === 0) throw new Error('No Opus packets found in WebM');

  // Parse OpusHead from CodecPrivate if present (otherwise build defaults)
  let head: Uint8Array;
  if (opusPrivate && opusPrivate.length >= 19 && opusPrivate[0] === 0x4f) {
    head = opusPrivate;
  } else {
    head = buildOpusHead(channels || 1, sampleRate || 48000, preSkip);
  }

  const serial = (Math.random() * 0xffffffff) >>> 0;
  const out: Uint8Array[] = [];
  let seq = 0;
  // Page 1: OpusHead (BOS)
  out.push(buildOggPage([head], 0x02, 0n, serial, seq++));
  // Page 2: OpusTags
  out.push(buildOggPage([buildOpusTags()], 0x00, 0n, serial, seq++));
  // Audio pages: pack ~50 packets per page max, granule = cumulative samples
  let granule = 0n;
  let i = 0;
  while (i < packets.length) {
    const batch: Uint8Array[] = [];
    let segCount = 0;
    while (i < packets.length && batch.length < 50) {
      const segs = Math.ceil((packets[i].length + 1) / 255);
      if (segCount + segs > 255) break;
      batch.push(packets[i]);
      granule += BigInt(sampleCounts[i]);
      segCount += segs;
      i++;
    }
    const isLast = i >= packets.length;
    const headerType = isLast ? 0x04 : 0x00;
    out.push(buildOggPage(batch, headerType, granule, serial, seq++));
  }

  const totalLen = out.reduce((s, p) => s + p.length, 0);
  const merged = new Uint8Array(totalLen);
  let off = 0;
  for (const p of out) { merged.set(p, off); off += p.length; }
  return merged;
}
