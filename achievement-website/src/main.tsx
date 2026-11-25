import { usePreferencesStore } from './stores/preferences'
import { WMessage } from './components/ui/WMessage'
import { WDialogHost } from './components/ui/WDialogHost'
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
const desktopBuild = import.meta.env.VITE_DESKTOP_BUILD
const loadDesktop = () => import('./desktop/DesktopApp.tsx')
const Desktop = desktopBuild ? (await loadDesktop()).default : lazy(loadDesktop)
const websitePages = desktopBuild
  ? null
  : {
      Viewer: lazy(() => import('./App.tsx')),
      NotFound: lazy(() => import('./NotFound.tsx')),
    }

function Page({
  component: Component,
  title,
}: {
  component: typeof Desktop
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
const desktopPage = <Page component={Desktop} title="common.desktopTitle" />
void usePreferencesStore.getState().initialize()
root.render(
  <StrictMode>
    <WScrollArea page />
    <WMessage />
    <WDialogHost />
    <Suspense fallback={null}>
      {websitePages ? (
        <BrowserRouter>
          <Routes>
            <Route
              path="/"
              element={<Page component={websitePages.Viewer} title="ui.appTitle" />}
            />
            <Route
              path="/index.html"
              element={<Page component={websitePages.Viewer} title="ui.appTitle" />}
            />
            <Route path="/desktop" element={desktopPage} />
            <Route path="/desktop/index.html" element={desktopPage} />
            <Route
              path="*"
              element={<Page component={websitePages.NotFound} title="notFound.title" />}
            />
          </Routes>
        </BrowserRouter>
      ) : (
        desktopPage
      )}
    </Suspense>
  </StrictMode>,
)
