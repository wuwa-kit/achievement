import { createContext } from 'react'
export interface WSelectContextValue {
  value: string
  activeValue?: string
  optionId: (value: string) => string
  selectValue: (value: string) => void
  activateValue: (value: string) => void
}
export const WSelectContext = createContext<WSelectContextValue | null>(null)
