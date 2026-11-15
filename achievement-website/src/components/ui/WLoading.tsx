import { WSvg } from './WSvg'

export function WLoading() {
  return (
    <div className="w-loading grid min-h-20 place-items-center p-4 text-(--color-muted) motion-safe:w-transition-colors">
      <WSvg
        name="loader-circle"
        size={32}
        className="w-loading-icon motion-safe:animate-spin motion-safe:[animation-duration:900ms]"
      />
    </div>
  )
}
