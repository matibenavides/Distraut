import type { HiddenContent, StoredState, VideoMetadata } from "../types/filter"
import { shouldHideVideo } from "./matching"
import { isConcentrating } from "./session"

const VIDEO_CARD_SELECTOR = [
  "ytd-rich-grid-renderer ytd-rich-item-renderer[lockup]",
  "ytd-search ytd-video-renderer[is-search]",
  "ytd-watch-next-secondary-results-renderer yt-lockup-view-model"
].join(", ")
const VIDEO_SURFACE_SELECTOR =
  "ytd-rich-grid-renderer, ytd-search, ytd-watch-next-secondary-results-renderer"
const SHORTS_CONTAINER_SELECTOR = [
  "ytd-rich-section-renderer",
  "ytd-rich-shelf-renderer",
  "ytd-reel-shelf-renderer",
  "grid-shelf-view-model",
  "ytd-rich-item-renderer",
  "ytd-reel-item-renderer",
  "ytm-shorts-lockup-view-model-v2",
  "ytm-shorts-lockup-view-model",
  VIDEO_CARD_SELECTOR,
  ".distraut-shorts-hidden"
].join(", ")

export function readVideoMetadata(card: Element): VideoMetadata {
  const titleElement = card.querySelector(
    "h3.ytLockupMetadataViewModelHeadingReset, #video-title"
  )
  const channelElement = card.querySelector(
    ".ytContentMetadataViewModelMetadataRow .ytContentMetadataViewModelMetadataText, ytd-channel-name a"
  )

  return {
    title:
      titleElement?.getAttribute("title")?.trim() ||
      titleElement?.textContent?.trim() ||
      undefined,
    channelName: channelElement?.textContent?.trim() || undefined
  }
}

export function findVideoCards(root: ParentNode): Element[] {
  return Array.from(root.querySelectorAll(VIDEO_CARD_SELECTOR))
}

export function applyVideoFilters(
  root: ParentNode,
  state: StoredState
): HiddenContent[] {
  for (const card of findVideoCards(root)) {
    const isVideo = Boolean(card.querySelector('a[href^="/watch?v="]'))
    card.classList.toggle(
      "distraut-hidden",
      isVideo && shouldHideVideo(state, readVideoMetadata(card))
    )
  }
  for (const card of root.querySelectorAll(SHORTS_CONTAINER_SELECTOR)) {
    card.classList.toggle(
      "distraut-shorts-hidden",
      Boolean(
        state.hideShorts &&
          card.closest(VIDEO_SURFACE_SELECTOR) &&
          card.querySelector('a[href^="/shorts/"]') &&
          !card.querySelector('a[href^="/watch?"]')
      )
    )
  }
  for (const panel of root.querySelectorAll(
    "ytd-watch-next-secondary-results-renderer, .distraut-suggested-hidden"
  )) {
    panel.classList.toggle(
      "distraut-suggested-hidden",
      (!!state.hideSuggested || isConcentrating(state.session)) &&
        panel.matches("ytd-watch-next-secondary-results-renderer")
    )
  }
  const hidden = new Map<string, HiddenContent>()
  for (const link of root.querySelectorAll(
    '.distraut-hidden a[href^="/watch?v="], .distraut-shorts-hidden a[href^="/shorts/"], .distraut-suggested-hidden a[href^="/watch?v="], .distraut-suggested-hidden a[href^="/shorts/"]'
  )) {
    const url = new URL(link.getAttribute("href")!, "https://www.youtube.com")
    const kind = url.pathname === "/watch" ? "videos" : "shorts"
    const id =
      kind === "videos" ? url.searchParams.get("v") : url.pathname.split("/")[2]
    if (id) hidden.set(`${kind}:${id}`, { kind, id })
  }
  return [...hidden.values()]
}

export function observeVideoChanges(
  document: Document,
  onChange: () => void
): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined

  function schedule(): void {
    if (timer !== undefined) return
    timer = setTimeout(() => {
      timer = undefined
      onChange()
    }, 0)
  }

  const Observer = document.defaultView?.MutationObserver ?? MutationObserver
  const observer = new Observer((records) => {
    if (
      records.some((record) => {
        const target =
          record.target.nodeType === 1
            ? (record.target as Element)
            : record.target.parentElement
        if (target?.closest(VIDEO_SURFACE_SELECTOR)) return true
        return Array.from(record.addedNodes).some((node) => {
          if (node.nodeType !== 1) return false
          const element = node as Element
          return (
            Boolean(element.closest(VIDEO_SURFACE_SELECTOR)) ||
            element.matches(VIDEO_SURFACE_SELECTOR) ||
            element.matches(VIDEO_CARD_SELECTOR) ||
            Boolean(element.querySelector(VIDEO_SURFACE_SELECTOR)) ||
            Boolean(element.querySelector(VIDEO_CARD_SELECTOR))
          )
        })
      })
    ) {
      schedule()
    }
  })

  observer.observe(document, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["title", "href", "lockup", "is-search"]
  })
  document.addEventListener("yt-navigate-finish", schedule)

  return () => {
    observer.disconnect()
    document.removeEventListener("yt-navigate-finish", schedule)
    if (timer !== undefined) clearTimeout(timer)
  }
}
