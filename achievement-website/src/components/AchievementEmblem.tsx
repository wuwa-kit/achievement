import emblemBackground from '../assets/achievement-icons/achievement-emblem-background.png?no-inline'
import litStar from '../assets/achievement-icons/achievement-star-lit.png?no-inline'
import unlitStar from '../assets/achievement-icons/achievement-star-unlit.png?no-inline'

// Star centers and sizes from UiItem_AchvStarA/B/C. The first slot is lit first.
const layouts = [
  [{ x: 2, y: 0, size: 70 }],
  [
    { x: -21, y: 0, size: 60 },
    { x: 23, y: 0, size: 60 },
  ],
  [
    { x: 1, y: -20, size: 60 },
    { x: -20, y: 11, size: 60 },
    { x: 24, y: 11, size: 60 },
  ],
]
// PnlAchvList places the star panel 35.5 units left of the background center.
const backgroundWidth = 284
const backgroundHeight = 232
const starPanelOffsetX = -35.5

export function AchievementEmblem({ slots, lit }: { slots: number; lit: number }) {
  return (
    <span
      className="achievement-emblem relative block w-full"
      data-slots={slots}
      data-lit={lit}
    >
      <img
        className="achievement-emblem-background block h-auto w-full"
        src={emblemBackground}
        width={backgroundWidth}
        height={backgroundHeight}
        alt=""
      />
      {layouts[slots - 1].map(({ x, y, size }, index) => (
        <img
          key={x}
          className="absolute aspect-square max-w-none -translate-1/2 data-[lit=false]:brightness-65"
          data-lit={index < lit}
          src={index < lit ? litStar : unlitStar}
          style={{
            left: `${50 + ((starPanelOffsetX + x) / backgroundWidth) * 100}%`,
            top: `${50 + (y / backgroundHeight) * 100}%`,
            width: `${(size / backgroundWidth) * 100}%`,
          }}
          alt=""
        />
      ))}
    </span>
  )
}
