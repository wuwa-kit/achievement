import { usePreferencesStore } from './stores/preferences'
import { WMessage } from './components/ui/WMessage'
import { WScrollArea } from './components/ui/WScrollArea'
import { StrictMode, lazy, Suspense, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { useTranslation } from 'react-i18next'
import { BrowserRouter, Route, Routes } from 'react-router'
import './styles.css'
import './theme.css'
if (window.chrome?.webview) {
  document.documentElement.classList.replace('font-sans', 'font-desktop')
}
const Viewer = lazy(() => import('./App.tsx'))
const Desktop = lazy(() => import('./desktop/DesktopApp.tsx'))
const NotFound = lazy(() => import('./NotFound.tsx'))

function Page({
  component: Component,
  title,
}: {
  component: typeof Viewer
  title: 'ui.appTitle' | 'common.desktopTitle' | 'notFound.title'
}) {
  const { t } = useTranslation()
  const pageTitle = t(title)
  useEffect(() => {
    document.title = pageTitle
  }, [pageTitle])
  return <Component />
}

const root = createRoot(document.getElementById('root')!)
void usePreferencesStore.getState().initialize()
root.render(
  <StrictMode>
    <WScrollArea page />
    <WMessage />
    <BrowserRouter>
      <Suspense fallback={null}>
        <Routes>
          <Route path="/" element={<Page component={Viewer} title="ui.appTitle" />} />
          <Route path="/index.html" element={<Page component={Viewer} title="ui.appTitle" />} />
          <Route path="/desktop" element={<Page component={Desktop} title="common.desktopTitle" />} />
          <Route
            path="/desktop/index.html"
            element={<Page component={Desktop} title="common.desktopTitle" />}
          />
          <Route path="/404" element={<Page component={NotFound} title="notFound.title" />} />
          <Route path="*" element={<Page component={NotFound} title="notFound.title" />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  </StrictMode>,
)
