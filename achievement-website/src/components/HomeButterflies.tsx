import type { CSSProperties } from 'react'
import butterflyB1 from '../assets/home-butterflies/butterfly-b1.png?no-inline'
import butterflyC1 from '../assets/home-butterflies/butterfly-c1.png?no-inline'
import butterflyBig from '../assets/home-butterflies/butterfly-big.png?no-inline'

// Original game textures: github.com/555me/Wuthering-Waves-GameAssets, Heihaian UI folders.
const butterflies = [
  {
    src: butterflyC1,
    className:
      'right-24 bottom-3 w-[26px] -rotate-10 opacity-70 narrow:right-[54px] narrow:bottom-2 narrow:w-5',
  },
  {
    src: butterflyBig,
    className:
      'right-2 bottom-3 w-[52px] -rotate-12 -scale-x-100 opacity-85 narrow:right-0 narrow:bottom-1.5 narrow:w-7',
  },
  {
    src: butterflyB1,
    className:
      'right-2 bottom-[84px] w-6 rotate-12 -scale-x-100 opacity-60 narrow:right-0 narrow:bottom-16 narrow:w-4',
  },
]

type ButterflyMotion = {
  duration: number
  delay: number
  drift: number
  lift: number
  sway: number
}

const butterflyMotion: Partial<Record<string, ButterflyMotion>> = {
  [butterflyC1]: { duration: 10.8, delay: -4.5, drift: 0.45, lift: 1.5, sway: -1.2 },
  [butterflyBig]: { duration: 9.6, delay: -2.3, drift: 1.1, lift: 2.4, sway: 1.4 },
  [butterflyB1]: { duration: 10.3, delay: -6.4, drift: -0.6, lift: 1.7, sway: -1.1 },
}

export function HomeButterflies() {
  return (
    <div
      className="home-butterflies pointer-events-none absolute inset-0 z-20 overflow-hidden select-none narrow:[--butterfly-motion-scale:0.6]"
      data-placement="corner"
    >
      {butterflies.map(({ src, className }) => {
        const motion = butterflyMotion[src]
        return (
          <img
            key={src}
            src={src}
            alt=""
            draggable={false}
            data-floating={!!motion}
            className={`home-butterfly absolute h-auto max-w-none ${className}`}
            style={
              motion
                ? ({
                    '--butterfly-duration': `${motion.duration}s`,
                    '--butterfly-delay': `${motion.delay}s`,
                    '--butterfly-drift': `${motion.drift}px`,
                    '--butterfly-lift': `${motion.lift}px`,
                    '--butterfly-sway': `${motion.sway}deg`,
                  } as CSSProperties)
                : undefined
            }
          />
        )
      })}
    </div>
  )
}
