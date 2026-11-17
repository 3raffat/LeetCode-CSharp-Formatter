/**
 * Pure JavaScript PNG Generator using Node.js zlib
 * Generates crisp C# icons for Chrome Extension in 16, 32, 48, 128 px
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function createPNG(width, height, getPixel) {
  // RGB + Alpha (4 bytes per pixel)
  // Scanline has 1 filter byte (0) + width * 4 bytes
  const scanlineLength = 1 + width * 4;
  const rawData = Buffer.alloc(scanlineLength * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * scanlineLength;
    rawData[rowOffset] = 0; // Filter type 0 (None)

    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = getPixel(x, y, width, height);
      const pixelOffset = rowOffset + 1 + x * 4;
      rawData[pixelOffset + 0] = r;
      rawData[pixelOffset + 1] = g;
      rawData[pixelOffset + 2] = b;
      rawData[pixelOffset + 3] = a;
    }
  }

  const compressed = zlib.deflateSync(rawData);

  // PNG Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR Chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0; // compression method
  ihdr[11] = 0; // filter method
  ihdr[12] = 0; // interlace method

  const ihdrChunk = createChunk('IHDR', ihdr);
  const idatChunk = createChunk('IDAT', compressed);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = data.length;
  const chunk = Buffer.alloc(12 + len);

  chunk.writeUInt32BE(len, 0);
  typeBuf.copy(chunk, 4);
  data.copy(chunk, 8);

  const crcData = Buffer.concat([typeBuf, data]);
  const crc = calculateCRC32(crcData);
  chunk.writeUInt32BE(crc, 8 + len);

  return chunk;
}

// Standard CRC32 table
const crcTable = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    if (c & 1) c = 0xedb88320 ^ (c >>> 1);
    else c = c >>> 1;
  }
  crcTable[n] = c >>> 0;
}

function calculateCRC32(buf) {
  let crc = 0 ^ (-1);
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ (-1)) >>> 0;
}

// Icon generator with C# theme (Purple / Indigo gradient with C# brackets)
function renderCSharpIcon(x, y, w, h) {
  const nx = x / w;
  const ny = y / h;
  const cx = 0.5;
  const cy = 0.5;
  const dist = Math.sqrt((nx - cx) ** 2 + (ny - cy) ** 2);

  // Rounded rectangle background (radius ~ 0.22)
  const cornerRadius = 0.22;
  const dx = Math.max(0, Math.abs(nx - 0.5) - (0.5 - cornerRadius));
  const dy = Math.max(0, Math.abs(ny - 0.5) - (0.5 - cornerRadius));
  const cornerDist = Math.sqrt(dx * dx + dy * dy);

  if (cornerDist > cornerRadius) {
    return [0, 0, 0, 0]; // Transparent outside rounded corner
  }

  // Base background: Elegant deep purple / indigo (C# brand colors)
  // #68217A to #178600 / LeetCode dark #262626
  let r = Math.round(104 + (nx + ny) * 20); // ~110-140
  let g = Math.round(33 + ny * 20);         // ~35-55
  let b = Math.round(122 + (1 - nx) * 30);  // ~120-150
  let a = 255;

  // Add subtle border
  if (cornerDist > cornerRadius - 0.04 || nx < 0.04 || nx > 0.96 || ny < 0.04 || ny > 0.96) {
    r = Math.min(255, r + 40);
    g = Math.min(255, g + 40);
    b = Math.min(255, b + 40);
  }

  // Render stylized 'C#' in white/gold
  // 'C' letter arc on left half (nx: 0.22 to 0.48, ny: 0.28 to 0.72)
  const cDist = Math.sqrt((nx - 0.38) ** 2 + (ny - 0.5) ** 2);
  const isC = cDist > 0.12 && cDist < 0.22 && (nx < 0.38 || Math.abs(ny - 0.5) > 0.09);

  // '#' grid on right half (nx: 0.52 to 0.78, ny: 0.28 to 0.72)
  const isHashVert1 = nx > 0.56 && nx < 0.61 && ny > 0.28 && ny < 0.72;
  const isHashVert2 = nx > 0.69 && nx < 0.74 && ny > 0.28 && ny < 0.72;
  const isHashHoriz1 = ny > 0.38 && ny < 0.43 && nx > 0.50 && nx < 0.80;
  const isHashHoriz2 = ny > 0.57 && ny < 0.62 && nx > 0.50 && nx < 0.80;
  const isHash = isHashVert1 || isHashVert2 || isHashHoriz1 || isHashHoriz2;

  if (isC || isHash) {
    return [255, 255, 255, 255]; // Crisp white
  }

  // Small format sparkles or accent dot
  if (nx > 0.78 && nx < 0.88 && ny > 0.18 && ny < 0.28) {
    const starDist = Math.abs(nx - 0.83) + Math.abs(ny - 0.23);
    if (starDist < 0.05) {
      return [255, 184, 0, 255]; // Gold sparkle (LeetCode gold)
    }
  }

  return [r, g, b, a];
}

const iconsDir = path.join(__dirname, '..', 'icons');
[16, 32, 48, 128].forEach(size => {
  const pngBuffer = createPNG(size, size, renderCSharpIcon);
  fs.writeFileSync(path.join(iconsDir, `icon${size}.png`), pngBuffer);
  console.log(`Generated icon${size}.png (${pngBuffer.length} bytes)`);
});

// Also create an SVG version
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#7B2CBF"/>
      <stop offset="100%" stop-color="#4A148C"/>
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.3"/>
    </filter>
  </defs>
  <rect width="128" height="128" rx="28" fill="url(#bgGrad)"/>
  <rect width="124" height="124" x="2" y="2" rx="26" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="2"/>
  <!-- C -->
  <path d="M 52 38 C 30 38 24 50 24 64 C 24 78 30 90 52 90 C 58 90 62 86 64 82" 
        fill="none" stroke="#FFFFFF" stroke-width="11" stroke-linecap="round"/>
  <!-- # -->
  <path d="M 76 34 L 72 94 M 94 34 L 90 94 M 64 50 L 104 46 M 62 76 L 102 72" 
        fill="none" stroke="#FFA116" stroke-width="7" stroke-linecap="round"/>
</svg>`;

fs.writeFileSync(path.join(iconsDir, 'icon.svg'), svgContent, 'utf8');
console.log('Generated icon.svg');
