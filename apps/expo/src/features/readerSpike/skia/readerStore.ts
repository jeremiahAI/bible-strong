// SPIKE: throwaway. Tiny external store so a selection drag or a setDecorations command re-renders
// only the rows of the blocks it touches, never the whole list.
import type { Decoration } from '../contract'
import type { BlockSelection } from './paint'
import type { DocumentLayout } from './layout'

export type BlockState = {
  decorations: Decoration[] | undefined
  selection: BlockSelection | null
  /** Bumps whenever the block's decorations were replaced by a command. */
  decoVersion: number
}

const EMPTY: BlockState = { decorations: undefined, selection: null, decoVersion: 0 }

const sameSelection = (a: BlockSelection | null, b: BlockSelection | null) => {
  if (a === b) return true
  if (!a || !b) return false
  if (a.ranges.length !== b.ranges.length) return false
  for (let i = 0; i < a.ranges.length; i++) {
    const x = a.ranges[i]
    const y = b.ranges[i]
    if ((x === null) !== (y === null)) return false
    if (x && y && (x.start !== y.start || x.end !== y.end)) return false
  }
  return (
    a.startHandle?.offset === b.startHandle?.offset &&
    a.endHandle?.offset === b.endHandle?.offset &&
    a.startHandle?.unitIdx === b.startHandle?.unitIdx &&
    a.endHandle?.unitIdx === b.endHandle?.unitIdx
  )
}

export class ReaderStore {
  private listeners = new Set<() => void>()
  private states = new Map<number, BlockState>()
  selection: { anchor: number; focus: number } | null = null

  subscribe = (l: () => void) => {
    this.listeners.add(l)
    return () => {
      this.listeners.delete(l)
    }
  }

  blockState(idx: number): BlockState {
    return this.states.get(idx) ?? EMPTY
  }

  private emit() {
    this.listeners.forEach(l => l())
  }

  setDecorations(idx: number, decorations: Decoration[]) {
    const cur = this.blockState(idx)
    this.states.set(idx, { ...cur, decorations, decoVersion: cur.decoVersion + 1 })
    this.emit()
  }

  /** `sel` is a [lo, hi] global word range, or null to clear. Returns the changed block set. */
  setSelection(layout: DocumentLayout | null, range: { lo: number; hi: number } | null) {
    const touched = new Set<number>()
    for (const [idx, st] of this.states) if (st.selection) touched.add(idx)
    const next = new Map<number, BlockSelection>()
    if (layout && range) {
      layout.blocks.forEach((b, idx) => {
        const wr = layout.blockWordRange[idx]
        if (!wr || wr[1] < range.lo || wr[0] > range.hi) return
        touched.add(idx)
        const ranges = b.units.map(u => {
          if (!u.selectable) return null
          const inRange = u.words.filter(w => w.g >= range.lo && w.g <= range.hi)
          if (!inRange.length) return null
          return { start: inRange[0].start, end: inRange[inRange.length - 1].end }
        })
        const sel: BlockSelection = { ranges }
        b.units.forEach((u, ui) => {
          const r = ranges[ui]
          if (!r) return
          if (u.words.some(w => w.g === range.lo)) sel.startHandle = { unitIdx: ui, offset: r.start }
          if (u.words.some(w => w.g === range.hi)) {
            const last = u.words.find(w => w.g === range.hi)
            if (last) sel.endHandle = { unitIdx: ui, offset: last.end - 1 }
          }
        })
        next.set(idx, sel)
      })
    }
    let changed = false
    touched.forEach(idx => {
      const cur = this.blockState(idx)
      const sel = next.get(idx) ?? null
      if (sameSelection(cur.selection, sel)) return
      changed = true
      this.states.set(idx, { ...cur, selection: sel })
    })
    if (changed) this.emit()
  }
}
