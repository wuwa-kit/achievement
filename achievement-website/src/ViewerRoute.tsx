import { lazy, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { useExportToolStore } from './stores/export-tool'

const Viewer = lazy(() => import('./App.tsx'))

export default function ViewerRoute() {
  const location = useLocation()
  const navigate = useNavigate()
  const downloadRequested = new URLSearchParams(location.search).get('download') === '1'

  useEffect(() => {
    if (!downloadRequested) return
    const params = new URLSearchParams(location.search)
    params.delete('download')
    const search = params.toString()
    navigate(
      { pathname: location.pathname, search: search ? `?${search}` : '', hash: location.hash },
      { replace: true },
    )
    useExportToolStore.getState().openDownload(true)
  }, [downloadRequested, location, navigate])

  return downloadRequested ? null : <Viewer />
}
