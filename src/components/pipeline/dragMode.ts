import { Platform } from 'react-native';

/**
 * How board cards are dragged on this device:
 * - `mouse`: web with a mouse or trackpad; the drag starts as soon as the pointer moves.
 * - `hold`: native touch; press and hold first, so a swipe still scrolls the board.
 * - `none`: touch browsers. A card that can be dragged there blocks the browser's own scrolling
 *   (and a hold-to-drag is cancelled once scrolling starts), so cards are moved with their arrow
 *   or from the profile instead.
 */
export type CardDragMode = 'mouse' | 'hold' | 'none';

function detectDragMode(): CardDragMode {
  if (Platform.OS !== 'web') return 'hold';
  const coarse = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;
  return coarse ? 'none' : 'mouse';
}

export const CARD_DRAG_MODE = detectDragMode();
