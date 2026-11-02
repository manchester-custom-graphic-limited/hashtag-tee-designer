import { TAG_MAX_CHARS } from '../config.js'

// A hashtag is letters, numbers, combining marks and `_` — the same set Instagram
// and TikTok link. Spaces and punctuation would end the tag on a real post.
export function cleanTagText(raw) {
  return Array.from(String(raw).replace(/^#+/, '').replace(/[^\p{L}\p{N}\p{M}_]/gu, ''))
    .slice(0, TAG_MAX_CHARS)
    .join('')
}

export function tagLabel(tag) {
  return `#${tag.text}`
}
