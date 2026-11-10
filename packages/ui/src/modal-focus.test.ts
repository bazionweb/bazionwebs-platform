import { describe, expect, it, vi } from "vitest";
import { getModalTabWrapTarget } from "./modal-focus.js";

describe("modal focus wrapping", () => {
  it("wraps backward from the first focusable control to the last", () => {
    const first = { focus: vi.fn() };
    const last = { focus: vi.fn() };

    expect(getModalTabWrapTarget([first, last], first, true)).toBe(last);
  });

  it("wraps forward from the last focusable control to the first", () => {
    const first = { focus: vi.fn() };
    const last = { focus: vi.fn() };

    expect(getModalTabWrapTarget([first, last], last, false)).toBe(first);
  });

  it("leaves normal tab movement alone and tolerates an empty dialog", () => {
    const first = { focus: vi.fn() };
    const middle = { focus: vi.fn() };
    const last = { focus: vi.fn() };

    expect(getModalTabWrapTarget([first, middle, last], middle, false)).toBeUndefined();
    expect(getModalTabWrapTarget([], null, false)).toBeUndefined();
  });
});
