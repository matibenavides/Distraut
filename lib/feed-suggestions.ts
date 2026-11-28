import type { Filter, FilterType, VideoMetadata } from "../types/filter"
import { filterKey, normalizeFilterValue } from "./filters"
import { findVideoCards, readVideoMetadata } from "./youtube-dom"

export const SCAN_YOUTUBE_FEED = "scan-youtube-feed"

export interface FeedSuggestion {
  type: FilterType
  value: string
  count: number
}

export interface FeedScan {
  videos: number
  suggestions: FeedSuggestion[]
}

const commonWords = new Set(
  "a al algo ante aqui asi con como cual cuando de del donde desde el ella ellos en entre era es esa ese esta este esto estos hacer hay la las lo los mas me mi muy nada nos o para pero por que se ser si sin sobre son su sus te tiene todo tu un una uno unas unos y ya the of to and or for from with this that these those are why how what when where will your you our new video videos shorts oficial official".split(
    " "
  )
)

function meaningful(word: string) {
  return word.length >= 3 && /\p{L}/u.test(word) && !commonWords.has(word)
}

function titleTerms(title: string) {
  const terms = new Set<string>()
  for (const phrase of normalizeFilterValue(title).split(
    /[^\p{L}\p{M}\p{N}\p{Zs}]+/u
  )) {
    const words = [...phrase.matchAll(/[\p{L}\p{M}\p{N}]+/gu)]
    for (const [start, word] of words.entries()) {
      if (!meaningful(word[0])) continue
      terms.add(word[0])
      for (const end of words.slice(start + 1, start + 3)) {
        if (meaningful(end[0]))
          terms.add(phrase.slice(word.index, (end.index ?? 0) + end[0].length))
      }
    }
  }
  return terms
}

export function suggestFeedFilters(
  videos: readonly VideoMetadata[],
  filters: readonly Filter[] = []
): FeedScan {
  const existing = new Set(filters.map(filterKey))
  const terms = new Map<string, FeedSuggestion>()
  const channels = new Map<string, FeedSuggestion>()
  for (const { title, channelName } of videos) {
    for (const value of titleTerms(title ?? "")) {
      const saved = terms.get(value)
      if (saved) saved.count++
      else terms.set(value, { type: "keyword", value, count: 1 })
    }
    const channel = normalizeFilterValue(channelName ?? "")
    if (channel && channelName) {
      const saved = channels.get(channel)
      if (saved) saved.count++
      else
        channels.set(channel, { type: "channel", value: channelName, count: 1 })
    }
  }
  const keywords: FeedSuggestion[] = []
  const ranked = [...terms.values()]
    .filter(
      (term) =>
        !existing.has(filterKey(term)) &&
        (term.count > 1 || !/\s/u.test(term.value))
    )
    .sort(
      (a, b) =>
        b.count - a.count ||
        Number(/\s/u.test(b.value)) - Number(/\s/u.test(a.value)) ||
        b.value.length - a.value.length
    )
  for (const term of ranked) {
    if (
      !keywords.some(
        (other) =>
          other.count === term.count &&
          ` ${other.value} `.includes(` ${term.value} `)
      )
    )
      keywords.push(term)
    if (keywords.length === 12) break
  }
  return {
    videos: videos.length,
    suggestions: [
      ...keywords,
      ...[...channels.values()]
        .filter((channel) => !existing.has(filterKey(channel)))
        .sort((a, b) => b.count - a.count)
        .slice(0, 12)
    ]
  }
}

export function scanYouTubeFeed(
  root: ParentNode,
  filters: readonly Filter[] = []
): FeedScan {
  const videos = new Map<string, VideoMetadata>()
  for (const card of findVideoCards(root)) {
    if (
      card.getClientRects().length === 0 ||
      card.closest(".distraut-hidden, .distraut-suggested-hidden")
    )
      continue
    const href = card
      .querySelector('a[href^="/watch?v="]')
      ?.getAttribute("href")
    const id =
      href && new URL(href, "https://www.youtube.com").searchParams.get("v")
    if (!id || videos.has(id)) continue
    const metadata = readVideoMetadata(card)
    if (metadata.title || metadata.channelName) videos.set(id, metadata)
  }
  return suggestFeedFilters([...videos.values()], filters)
}
