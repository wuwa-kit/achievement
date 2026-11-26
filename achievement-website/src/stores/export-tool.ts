import { create } from 'zustand'

interface ExportToolStore {
  downloadSources: 'default' | 'all' | null
  openDownload(showAllSources?: boolean): void
  closeDownload(): void
}

export const useExportToolStore = create<ExportToolStore>((set) => ({
  downloadSources: null,
  openDownload: (showAllSources = false) =>
    set({ downloadSources: showAllSources ? 'all' : 'default' }),
  closeDownload: () => set({ downloadSources: null }),
}))
