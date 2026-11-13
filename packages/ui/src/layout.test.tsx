import { describe, expect, it } from "vitest";
import { Cluster, Container, Grid, Section, Stack } from "./layout.js";

describe("responsive layout primitives", () => {
  it("applies reusable container and section classes while preserving attributes", () => {
    const container = Container({ id: "content", className: "custom", children: "Content" });
    const section = Section({ "aria-label": "About", children: "About us" });

    expect(container.props).toMatchObject({ id: "content", className: "bw-container custom", children: "Content" });
    expect(section.props).toMatchObject({ "aria-label": "About", className: "bw-section", children: "About us" });
  });

  it("provides bounded stack, wrapping cluster, and responsive grid variants", () => {
    expect(Stack({ gap: "lg", children: "Stack" }).props.className).toBe("bw-stack bw-stack--lg");
    expect(Cluster({ children: "Actions" }).props.className).toBe("bw-cluster");
    expect(Grid({ columns: "two", children: "Columns" }).props.className).toBe("bw-grid bw-grid--two");
  });
});
