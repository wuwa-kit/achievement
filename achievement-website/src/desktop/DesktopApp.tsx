import { useEffect, useState } from 'react'
import { useDesktopStore } from '../stores/desktop'
import { HomeButterflies } from '../components/HomeButterflies'
import { DesktopSettings } from './DesktopSettings'
import { DesktopCapture } from './DesktopCapture'
import { DesktopHistory } from './DesktopHistory'
import { DesktopTransferDialog } from './DesktopTransferDialog'
import { DesktopCaptureNotice } from './DesktopCaptureNotice'

export default function DesktopApp() {
  const connect = useDesktopStore((state) => state.connect)
  const [promptQuality, setPromptQuality] = useState(false)
  useEffect(connect, [connect])

  return (
    <div className="desktop-page m-auto max-w-[760px] p-7 text-(--color-text) desktop-narrow:p-5">
      <HomeButterflies fixed />
      <DesktopSettings promptQuality={promptQuality} onQualityPromptChange={setPromptQuality} />
      <DesktopCapture onQualityRequired={() => setPromptQuality(true)} />
      <DesktopHistory />
      <DesktopTransferDialog />
      <DesktopCaptureNotice />
    </div>
  )
}
