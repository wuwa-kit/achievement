import { crc32, deflateSync } from 'node:zlib'
import { catalogTextHeader, pngSignature } from '../src/lib/catalog-png.ts'

function chunk(type: string, bytes: Uint8Array) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(bytes.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), bytes])
  const checksum = Buffer.alloc(4)
  checksum.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, checksum])
}

export function catalogPng(json: string) {
  const width = 1920
  const height = 1080
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header[8] = 1 // One bit per grayscale pixel.
  // Each row begins with filter type 0, followed by zero bits for black pixels.
  const pixels = Buffer.alloc(height * (1 + Math.ceil(width / 8)))

  return Buffer.concat([
    pngSignature,
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(pixels)),
    chunk('iTXt', Buffer.concat([catalogTextHeader, deflateSync(json, { level: 9 })])),
    chunk('IEND', Buffer.alloc(0)),
  ])
}
