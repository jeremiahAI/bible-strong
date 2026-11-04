// SPIKE: throwaway. Recording of the pictures each row shows. A row's picture is
//   background -> fills (highlights, selection) -> block text picture -> strokes (underline, circle, handles).
// The text picture is recorded once per block layout; the rest is cheap and re-recorded when
// decorations or selection change.
import {
  ClipOp,
  PaintStyle,
  Skia,
  type SkPicture,
  type SkRect,
} from '@shopify/react-native-skia'

import type { Decoration, ReaderTheme } from '../contract'
import type { BlockLayout, RowPlan, Unit } from './layout'

export type BlockSelection = {
  /** Per unit: selected char range, or null. */
  ranges: ({ start: number; end: number } | null)[]
  startHandle?: { unitIdx: number; offset: number }
  endHandle?: { unitIdx: number; offset: number }
}

const textPictures = new WeakMap<BlockLayout, SkPicture>()
const decorationRects = new WeakMap<Decoration, SkRect[]>()

export const paintStats = { textPictureMs: [] as number[], rowPictureMs: [] as number[] }

const mergeLineRects = (rects: SkRect[]): SkRect[] => {
  // Rects are JSI host objects: spreading them yields nothing, so read the fields explicitly.
  const sorted = [...rects].sort((a, b) => a.y - b.y || a.x - b.x)
  const out: SkRect[] = []
  for (const r of sorted) {
    const last = out[out.length - 1]
    if (last && Math.abs(last.y - r.y) < 2 && Math.abs(last.height - r.height) < 3 && r.x <= last.x + last.width + 1.5) {
      const right = Math.max(last.x + last.width, r.x + r.width)
      out[out.length - 1] = { x: last.x, y: Math.min(last.y, r.y), width: right - last.x, height: Math.max(last.height, r.height) }
    } else {
      out.push({ x: r.x, y: r.y, width: r.width, height: r.height })
    }
  }
  return out
}

const rectsFor = (u: Unit, start: number, end: number): SkRect[] =>
  mergeLineRects(u.para.getRectsForRange(start, end)).map(r => ({
    x: r.x + u.x,
    y: r.y + u.y,
    width: r.width,
    height: r.height,
  }))

const decoRectsFor = (u: Unit, d: Decoration): SkRect[] => {
  let hit = decorationRects.get(d)
  if (!hit) {
    hit = rectsFor(u, d.start, d.end)
    decorationRects.set(d, hit)
  }
  return hit
}

export const getTextPicture = (b: BlockLayout, width: number): SkPicture => {
  const cached = textPictures.get(b)
  if (cached) return cached
  const t0 = performance.now()
  const rec = Skia.PictureRecorder()
  const canvas = rec.beginRecording(Skia.XYWHRect(0, 0, width, b.height))
  for (const u of b.units) u.para.paint(canvas, u.x, u.y)
  for (const c of b.cells) for (const p of c.paras) p.para.paint(canvas, c.x, c.y + p.y)
  const pic = rec.finishRecordingAsPicture()
  paintStats.textPictureMs.push(performance.now() - t0)
  textPictures.set(b, pic)
  return pic
}

const fillPaint = (hex: string, opacity?: number) => {
  const p = Skia.Paint()
  p.setAntiAlias(true)
  p.setColor(Skia.Color(hex))
  if (opacity !== undefined) p.setAlphaf(opacity)
  return p
}

const strokePaint = (hex: string, width: number) => {
  const p = fillPaint(hex)
  p.setStyle(PaintStyle.Stroke)
  p.setStrokeWidth(width)
  return p
}

const intersects = (r: SkRect, y0: number, y1: number) => r.y + r.height >= y0 - 8 && r.y <= y1 + 8

export const recordRowPicture = (
  row: RowPlan,
  b: BlockLayout,
  width: number,
  theme: ReaderTheme,
  decorations: Decoration[][],
  selection: BlockSelection | null
): SkPicture => {
  const t0 = performance.now()
  const rec = Skia.PictureRecorder()
  const canvas = rec.beginRecording(Skia.XYWHRect(0, 0, width, row.height))
  canvas.drawRect(Skia.XYWHRect(0, 0, width, row.height), fillPaint(theme.background))
  canvas.save()
  canvas.clipRect(Skia.XYWHRect(0, 0, width, row.height), ClipOp.Intersect, false)
  canvas.translate(0, -row.blockY0)
  const y0 = row.blockY0
  const y1 = row.blockY0 + row.height

  // Fills behind the text.
  b.units.forEach((u, ui) => {
    for (const d of decorations[ui] ?? u.decorations) {
      if (d.kind !== 'verseHighlight' && d.kind !== 'background') continue
      const paint = fillPaint(d.color, d.opacity)
      for (const r of decoRectsFor(u, d)) {
        if (!intersects(r, y0, y1)) continue
        canvas.drawRRect(
          Skia.RRectXY(Skia.XYWHRect(r.x - 1, r.y - 1, r.width + 2, r.height + 2), 4, 4),
          paint
        )
      }
    }
    const sel = selection?.ranges[ui]
    if (sel) {
      const paint = fillPaint(theme.selection)
      for (const r of rectsFor(u, sel.start, sel.end)) {
        if (!intersects(r, y0, y1)) continue
        canvas.drawRRect(Skia.RRectXY(Skia.XYWHRect(r.x - 1, r.y, r.width + 2, r.height), 3, 3), paint)
      }
    }
  })

  canvas.drawPicture(getTextPicture(b, width))

  // Strokes above the text.
  b.units.forEach((u, ui) => {
    for (const d of decorations[ui] ?? u.decorations) {
      if (d.kind === 'underline') {
        const paint = strokePaint(d.color, 2)
        for (const r of decoRectsFor(u, d)) {
          if (!intersects(r, y0, y1)) continue
          const y = r.y + r.height + 1
          canvas.drawLine(r.x, y, r.x + r.width, y, paint)
        }
      } else if (d.kind === 'circle') {
        const paint = strokePaint(d.color, 2)
        for (const r of decoRectsFor(u, d)) {
          if (!intersects(r, y0, y1)) continue
          canvas.drawRRect(
            Skia.RRectXY(Skia.XYWHRect(r.x - 3, r.y - 2, r.width + 6, r.height + 4), 9, 9),
            paint
          )
        }
      }
    }
  })

  if (selection) {
    const handle = Skia.Paint()
    handle.setAntiAlias(true)
    handle.setColor(Skia.Color(theme.accent))
    const drawHandle = (h: { unitIdx: number; offset: number } | undefined, atStart: boolean) => {
      if (!h) return
      const u = b.units[h.unitIdx]
      const rs = u.para.getRectsForRange(h.offset, h.offset + 1)
      const r = rs[0]
      if (!r) return
      const x = u.x + (atStart ? r.x : r.x + r.width)
      const top = u.y + r.y
      const bottom = top + r.height
      if (!intersects({ x, y: top, width: 0, height: r.height }, y0, y1)) return
      const stroke = strokePaint(theme.accent, 2)
      canvas.drawLine(x, top, x, bottom, stroke)
      canvas.drawCircle(x, atStart ? top - 6 : bottom + 6, 7, handle)
    }
    drawHandle(selection.startHandle, true)
    drawHandle(selection.endHandle, false)
  }
  canvas.restore()
  const pic = rec.finishRecordingAsPicture()
  paintStats.rowPictureMs.push(performance.now() - t0)
  return pic
}

/** Absolute (block-space) rects of a unit char range, for selection hit tests and debugging. */
export const blockRectsForRange = rectsFor
