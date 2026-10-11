import { beforeEach, describe, expect, it, vi } from "vitest";

const responses = vi.hoisted(() => ({
  update: { data: null as unknown, error: null as unknown },
  select: { data: null as unknown },
}));

vi.mock("../supabaseClient", () => {
  const chain = (result: () => unknown) => {
    const builder: Record<string, unknown> = {};
    for (const method of ["update", "eq", "select"]) builder[method] = () => builder;
    builder.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result()).then(resolve);
    builder.maybeSingle = () => Promise.resolve(responses.select);
    return builder;
  };
  return {
    supabase: {
      from: () => ({
        update: () => chain(() => responses.update),
        select: () => chain(() => responses.select),
      }),
    },
  };
});

import { NOT_WRITABLE_MESSAGE, saveDocument } from "./documentWrites";

describe("saveDocument", () => {
  beforeEach(() => {
    responses.update = { data: null, error: null };
    responses.select = { data: null };
  });

  it("returns the new version when the expected version matched", async () => {
    responses.update = { data: [{ version: 4 }], error: null };
    expect(await saveDocument("d", { title: "T", content: {} }, 3)).toEqual({ status: "saved", version: 4 });
  });

  it("reports a conflict when someone else saved first", async () => {
    responses.update = { data: [], error: null };
    responses.select = { data: { version: 7 } };
    expect(await saveDocument("d", { title: "T", content: {} }, 3)).toEqual({ status: "conflict", version: 7 });
  });

  it("reports no access when the paper can't be read or written", async () => {
    responses.update = { data: [], error: null };
    const result = await saveDocument("d", { title: "T", content: {} }, 3);
    expect(result.status === "error" && result.error.message).toBe(NOT_WRITABLE_MESSAGE);
  });
});
