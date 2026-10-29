/**
 * jsdom lays nothing out, so every element has no box — and the CDK's focus trap, which only
 * counts a visible element as tabbable, would find nothing to focus. Gives each element one box
 * for the current test.
 */
export function fakeLayout(): void {
  const box = { length: 1, item: () => null, [Symbol.iterator]: [][Symbol.iterator] };
  vi.spyOn(Element.prototype, 'getClientRects').mockReturnValue(box as unknown as DOMRectList);
}
