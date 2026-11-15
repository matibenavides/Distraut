import type { VideoMetadata } from "../types/filter"
import type { StoredState } from "../types/filter"
import { shouldHideVideo } from "./matching"

const VIDEO_CARD_SELECTOR = [
  "ytd-rich-grid-renderer ytd-rich-item-renderer[lockup]",
  "ytd-search ytd-video-renderer[is-search]",
  "ytd-watch-next-secondary-results-renderer yt-lockup-view-model"
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

export function applyVideoFilters(root: ParentNode, state: StoredState): void {
  for (const card of findVideoCards(root)) {
    const isVideo = Boolean(card.querySelector('a[href^="/watch?v="]'))
    card.classList.toggle(
      "distraut-hidden",
      isVideo && shouldHideVideo(state, readVideoMetadata(card))
    )
  }
}
