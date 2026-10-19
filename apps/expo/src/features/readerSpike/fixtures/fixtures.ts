// SPIKE: the five fixtures, as sources and as generated render documents.
import type { FixtureId, RenderDocument } from '../contract'
import type { FixtureSource } from './toRenderDocument'

export const FIXTURE_IDS: FixtureId[] = [
  'psalm119',
  'john1-strong',
  'genesis1-bhg-interlinear',
  'john1-parallel',
  'romans8-annotated',
]

/* eslint-disable @typescript-eslint/no-require-imports */
const sources: Record<FixtureId, () => FixtureSource> = {
  psalm119: () => require('./psalm119.source.json'),
  'john1-strong': () => require('./john1-strong.source.json'),
  'genesis1-bhg-interlinear': () => require('./genesis1-bhg-interlinear.source.json'),
  'john1-parallel': () => require('./john1-parallel.source.json'),
  'romans8-annotated': () => require('./romans8-annotated.source.json'),
}
const renders: Record<FixtureId, () => RenderDocument> = {
  psalm119: () => require('./psalm119.render.json'),
  'john1-strong': () => require('./john1-strong.render.json'),
  'genesis1-bhg-interlinear': () => require('./genesis1-bhg-interlinear.render.json'),
  'john1-parallel': () => require('./john1-parallel.render.json'),
  'romans8-annotated': () => require('./romans8-annotated.render.json'),
}
/* eslint-enable @typescript-eslint/no-require-imports */

export const loadFixtureSource = (id: FixtureId): FixtureSource => sources[id]()
export const loadFixtureRender = (id: FixtureId): RenderDocument => renders[id]()
