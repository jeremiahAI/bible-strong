// SPIKE: the WebView baseline. Renders a fixture through the real BibleDOMWrapper (the path
// normal reading uses), fed with the fixture's source verses, highlights and word annotations.
import produce from 'immer'
import { useEffect, useMemo, useRef, useState } from 'react'
import { atom, useAtomValue, useSetAtom } from 'jotai'
import type { LayoutChangeEvent } from 'react-native'
import { View } from 'react-native'
import { useSelector } from 'react-redux'

import books from '~assets/bible_versions/books-desc'
import type { Verse } from '~common/types'
import type { WebViewProps } from '~features/bible/BibleDOM/BibleDOMWrapper'
import BibleDOMPortalHost from '~features/bible/BibleDOMPortalHost'
import { getBibleDOMDestination } from '~features/bible/SharedBibleDOM'
import type { RootState } from '~redux/modules/reducer'
import type { WordAnnotation, WordAnnotationsObj } from '~redux/modules/user/wordAnnotations'
import {
  activeBibleTabIdAtom,
  bibleDOMHostLayoutsAtom,
  getDefaultBibleTab,
  sharedBibleDOMPropsAtom,
} from '~state/tabs'
import type { VersionCode } from '~state/tabs'

import type { Decoration, ReaderEvent, ReaderProps, RenderDocument, Run } from '../contract'
import { loadFixtureSource } from '../fixtures/fixtures'
import { setBenchListener } from './benchSink'

const noop = () => {}
const EMPTY_PASSAGE_MEDIA = {
  introduction: [],
  isIntroductionStartChapter: false,
  afterVerses: {},
  chapterResources: [],
}

const toWordAnnotations = (
  document: RenderDocument,
  blockId: string,
  decorations: Decoration[],
  seq: number,
  issuedAt: number,
  version: string
): WordAnnotationsObj => {
  const block = document.blocks.find(candidate => candidate.id === blockId)
  const runs: Run[] = block?.kind === 'paragraph' ? block.runs : []
  const result: WordAnnotationsObj = {}
  decorations.forEach((decoration, index) => {
    const words = new Map<string, { start: number; end: number }>()
    let offset = 0
    for (const run of runs) {
      const runEnd = offset + run.text.length
      if (
        run.verseKey &&
        run.wordIndex !== undefined &&
        runEnd > decoration.start &&
        offset < decoration.end
      ) {
        const range = words.get(run.verseKey)
        words.set(run.verseKey, {
          start: Math.min(range?.start ?? run.wordIndex, run.wordIndex),
          end: Math.max(range?.end ?? run.wordIndex, run.wordIndex),
        })
      }
      offset = runEnd
    }
    const id = `bench-cmd|${blockId}|${seq}|${index}`
    const annotation: WordAnnotation = {
      id,
      version: version as VersionCode,
      ranges: [...words].map(([verseKey, range]) => ({
        verseKey,
        startWordIndex: range.start,
        endWordIndex: range.end,
        text: '',
      })),
      color: decoration.color,
      type:
        decoration.kind === 'underline' || decoration.kind === 'circle'
          ? decoration.kind
          : 'background',
      date: issuedAt,
    }
    result[id] = annotation
  })
  return result
}

const WebViewReader = ({ document, command, onEvent }: ReaderProps) => {
  const source = useMemo(() => loadFixtureSource(document.fixture), [document.fixture])
  const rawSettings = useSelector((state: RootState) => state.user.bible.settings)
  const fontFamily = useSelector((state: RootState) => state.user.fontFamily)
  const settings = useMemo(
    () =>
      produce(rawSettings, draft => {
        draft.theme = 'default'
        draft.fontFamily = fontFamily
      }),
    [rawSettings, fontFamily]
  )
  const bibleAtom = useMemo(
    () => atom(getDefaultBibleTab(source.version as VersionCode)),
    [source.version]
  )

  const onEventRef = useRef(onEvent)
  onEventRef.current = onEvent
  useEffect(() => {
    setBenchListener((event: ReaderEvent) => onEventRef.current(event))
    return () => setBenchListener(null)
  }, [])

  const [verseToScroll, setVerseToScroll] = useState<number | undefined>(undefined)
  const [verseNavigationRequest, setVerseNavigationRequest] = useState(0)
  const [commandAnnotations, setCommandAnnotations] = useState<WordAnnotationsObj>({})
  const lastSeq = useRef(0)
  useEffect(() => {
    if (!command || command.seq === lastSeq.current) return
    lastSeq.current = command.seq
    if (command.type === 'scrollToVerse') {
      setVerseToScroll(Number(command.verseKey.split('-')[2]))
      setVerseNavigationRequest(command.seq)
    } else {
      setCommandAnnotations(
        toWordAnnotations(
          document,
          command.blockId,
          command.decorations,
          command.seq,
          command.issuedAt,
          source.version
        )
      )
    }
  }, [command, document, source.version])

  const wordAnnotations = useMemo(
    () => ({ ...(source.wordAnnotations ?? {}), ...commandAnnotations }),
    [source.wordAnnotations, commandAnnotations]
  )

  const book = books.find(candidate => candidate.Numero === source.book)!
  const props: WebViewProps = {
    tabId: 'reader-bench',
    bibleAtom,
    book,
    chapter: source.chapter,
    isLoading: false,
    addSelectedVerse: noop,
    removeSelectedVerse: noop,
    setSelectedVerse: noop,
    version: source.version as VersionCode,
    interlinearMode: source.interlinearMode,
    contextDisplayMode: 'fullChapter',
    isSelectionMode: undefined,
    verses: source.verses as Verse[],
    parallelVerses: (source.parallelVersions ?? []).map(parallel => ({
      id: parallel.id as VersionCode,
      verses: parallel.verses as Verse[],
    })),
    focusVerses: undefined,
    selectedVerses: {},
    highlightedVerses: source.highlights ?? {},
    notedVerses: {},
    allNotes: {},
    bookmarkedVerses: {},
    linkedVerses: {},
    allLinks: {},
    studyRelations: {},
    wordAnnotations,
    settings,
    verseToScroll,
    verseNavigationRequest,
    pericopeChapter: {},
    passageMedia: EMPTY_PASSAGE_MEDIA,
    setSelectedCode: noop,
    selectedCode: null,
    chapterEntities: [],
    chapterEntitiesLoaded: false,
    chapterEntityModuleStatus: null,
    chapterEntityDownloadState: { progress: 0 },
    personalBibleDataEnabled: true,
  }

  // The app renders one shared BibleDOMWrapper (SharedBibleDOM, mounted at the app root and kept
  // warm) and portals it into the active Bible tab's PortalHost. The bench feeds that same
  // machinery: it publishes the fixture props for the active Bible tab and hosts the destination.
  const activeBibleTabId = useAtomValue(activeBibleTabIdAtom)
  const setSharedProps = useSetAtom(sharedBibleDOMPropsAtom)
  const setHostLayouts = useSetAtom(bibleDOMHostLayoutsAtom)
  useEffect(() => {
    if (activeBibleTabId) setSharedProps({ ...props, tabId: activeBibleTabId })
    // props is rebuilt every render; republish only when the inputs that matter change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBibleTabId, source, wordAnnotations, settings, verseToScroll, verseNavigationRequest])
  const onHostLayout = ({ nativeEvent: { layout } }: LayoutChangeEvent) => {
    if (!activeBibleTabId || layout.width <= 0 || layout.height <= 0) return
    const width = Math.round(layout.width)
    const height = Math.round(layout.height)
    setHostLayouts(current =>
      current[activeBibleTabId]?.width === width && current[activeBibleTabId]?.height === height
        ? current
        : { ...current, [activeBibleTabId]: { width, height } }
    )
  }
  if (!activeBibleTabId) return null
  return (
    <View style={{ flex: 1 }} onLayout={onHostLayout}>
      <BibleDOMPortalHost
        name={getBibleDOMDestination(activeBibleTabId)}
        style={{ flex: 1, zIndex: -1 }}
      />
    </View>
  )
}

export default WebViewReader
