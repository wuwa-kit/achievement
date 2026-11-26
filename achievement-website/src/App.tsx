import { useEffect, useRef, useState } from 'react'
import { useViewerStore } from './stores/viewer'
import { ViewerLayout } from './components/ViewerLayout'
import { ViewerSidebar } from './components/ViewerSidebar'
import { ViewerHeader } from './components/ViewerHeader'
import { ViewerAchievements } from './components/ViewerAchievements'
import { ViewerImportDialogs } from './components/ViewerImportDialogs'
import { ExportToolDownloadDialog } from './components/ExportToolDownloadDialog'
import { HomeButterflies } from './components/HomeButterflies'
import { useViewerCatalog } from './components/useViewerCatalog'
import './App.css'

export default function App() {
  const connect = useViewerStore((state) => state.connect)
  const catalog = useViewerCatalog()
  const [navigationOpen, setNavigationOpen] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  useEffect(connect, [connect])

  return (
    <ViewerLayout>
      <ViewerSidebar
        catalog={catalog}
        open={navigationOpen}
        onClose={() => setNavigationOpen(false)}
      />
      <div className="workspace relative isolate ml-(--sidebar-width) flex h-dvh flex-col overflow-hidden sidebar-overlay:ml-0 sidebar-overlay:bg-none">
        <HomeButterflies />
        <ViewerHeader fileInput={fileInput} onOpenNavigation={() => setNavigationOpen(true)} />
        <ViewerAchievements catalog={catalog} onImport={() => fileInput.current?.click()} />
      </div>
      <ViewerImportDialogs />
      <ExportToolDownloadDialog />
    </ViewerLayout>
  )
}
