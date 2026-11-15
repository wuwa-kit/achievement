import { useCallback } from 'react'

const highlightName = 'achievement-search-match'

export function useAchievementHighlight(text: string, query: string) {
  return useCallback(
    (element: HTMLElement | null) => {
      const node = element?.firstChild
      if (!text || !query || !(node instanceof Text) || !CSS.highlights) return

      const normalized = text.toLocaleLowerCase()
      let start = normalized.indexOf(query)
      if (start === -1) return

      // Lowercasing can expand a character (for example, İ) into multiple code units.
      // Map matches back to the original text so the highlight still covers the right glyphs.
      const offsets: { start: number; end: number }[] = []
      if (normalized.length !== text.length) {
        let offset = 0
        for (const character of text) {
          const end = offset + character.length
          for (let index = 0; index < character.toLocaleLowerCase().length; index++) {
            offsets.push({ start: offset, end })
          }
          offset = end
        }
      }

      const highlight = CSS.highlights.get(highlightName) ?? new Highlight()
      const ranges: StaticRange[] = []
      while (start !== -1) {
        const end = start + query.length
        // Keep the range on its text node when the dialog moves into the top layer.
        const range = new StaticRange({
          startContainer: node,
          startOffset: offsets[start]?.start ?? start,
          endContainer: node,
          endOffset: offsets[end - 1]?.end ?? end,
        })
        ranges.push(range)
        highlight.add(range)
        start = normalized.indexOf(query, end)
      }
      CSS.highlights.set(highlightName, highlight)

      return () => {
        for (const range of ranges) highlight.delete(range)
        if (!highlight.size) CSS.highlights.delete(highlightName)
      }
    },
    [text, query],
  )
}
