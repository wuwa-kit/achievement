export const pngSignature = Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10)
export const catalogTextHeader = new TextEncoder().encode('AchievementCatalog\0\x01\0\0\0')

export async function readCatalogPng(buffer: ArrayBuffer): Promise<unknown> {
  const bytes = new Uint8Array(buffer)
  const view = new DataView(buffer)
  if (!pngSignature.every((byte, index) => bytes[index] === byte))
    throw new Error('Invalid catalog PNG signature')
  for (let offset = pngSignature.length; offset + 12 <= bytes.length;) {
    const size = view.getUint32(offset)
    const start = offset + 8
    const end = start + size
    if (end + 4 > bytes.length) throw new Error('Incomplete catalog PNG chunk')
    const type = view.getUint32(offset + 4)
    if (type === 0x49454e44) break // IEND
    if (
      type === 0x69545874 && // iTXt
      size >= catalogTextHeader.length &&
      catalogTextHeader.every((byte, index) => bytes[start + index] === byte)
    ) {
      const compressed = bytes.slice(start + catalogTextHeader.length, end)
      const json = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate'))
      return new Response(json).json()
    }
    offset = end + 4
  }
  throw new Error('Catalog PNG has no compressed catalog text')
}
