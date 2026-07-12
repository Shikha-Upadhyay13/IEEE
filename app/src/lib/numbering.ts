import type {
  Document,
  BodyNode,
  ResolvedBodyNode,
  InlineNode,
  ResolvedInlineNode,
  ResolvedDocument,
} from "../types/document";

// Simple int -> Roman numeral conversion (no library needed for paper-scale numbers).
function toRoman(num: number): string {
  const table: [number, string][] = [
    [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"],
    [100, "C"], [90, "XC"], [50, "L"], [40, "XL"],
    [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
  ];
  let n = num;
  let result = "";
  for (const [value, symbol] of table) {
    while (n >= value) {
      result += symbol;
      n -= value;
    }
  }
  return result;
}

type Counters = {
  figure: number;
  table: number;
  equation: number;
  section: number;
};

/**
 * Deterministic tree-walk: assigns figure/table/equation/section numbers and
 * builds the citation first-appearance order, all from current block order.
 * Never reads or writes stored numbers — this is the only place numbers exist.
 */
export function resolveNumbering(doc: Document): ResolvedDocument {
  const counters: Counters = { figure: 0, table: 0, equation: 0, section: 0 };
  const citationOrder = new Map<string, number>();

  function citationNumber(refId: string): number {
    let n = citationOrder.get(refId);
    if (n === undefined) {
      n = citationOrder.size + 1;
      citationOrder.set(refId, n);
    }
    return n;
  }

  function resolveInline(nodes: InlineNode[]): ResolvedInlineNode[] {
    return nodes.map((node) => {
      if (node.type === "citeRef") {
        return { ...node, resolvedNumber: citationNumber(node.refId) };
      }
      if (node.type === "xref") {
        // xref numbers are resolved in a second pass (see below), since a figure/table
        // may be cited before it's walked. Placeholder here, patched after the main walk.
        return { ...node, resolvedNumber: -1 };
      }
      return node;
    });
  }

  function resolveBody(nodes: BodyNode[], depth: number): ResolvedBodyNode[] {
    return nodes.map((node): ResolvedBodyNode => {
      switch (node.type) {
        case "section": {
          counters.section += 1;
          const number = depth === 0 ? toRoman(counters.section) : String(counters.section);
          return {
            ...node,
            resolvedNumber: number,
            children: resolveBody(node.children, depth + 1),
          };
        }
        case "paragraph":
          return { ...node, content: resolveInline(node.content) };
        case "figure":
          counters.figure += 1;
          return {
            ...node,
            resolvedNumber: counters.figure,
            caption: resolveInline(node.caption),
          };
        case "table":
          counters.table += 1;
          return {
            ...node,
            resolvedNumber: toRoman(counters.table),
            caption: resolveInline(node.caption),
          };
        case "equation":
          counters.equation += 1;
          return { ...node, resolvedNumber: counters.equation };
      }
    });
  }

  const resolvedBody = resolveBody(doc.body, 0);

  // Second pass: patch xref placeholders now that every figure/table has a number.
  const figureNumbers = new Map<string, number>();
  const tableNumbers = new Map<string, string>();
  (function collect(nodes: ResolvedBodyNode[]) {
    for (const node of nodes) {
      if (node.type === "figure") figureNumbers.set(node.id, node.resolvedNumber);
      if (node.type === "table") tableNumbers.set(node.id, node.resolvedNumber as unknown as string);
      if (node.type === "section") collect(node.children);
    }
  })(resolvedBody);

  (function patchXrefs(nodes: ResolvedBodyNode[]) {
    for (const node of nodes) {
      if (node.type === "paragraph") {
        node.content = node.content.map((inline) => {
          if (inline.type === "xref") {
            const num =
              inline.targetType === "figure"
                ? figureNumbers.get(inline.targetId)
                : tableNumbers.get(inline.targetId);
            return { ...inline, resolvedNumber: num ?? 0 };
          }
          return inline;
        });
      }
      if (node.type === "section") patchXrefs(node.children);
    }
  })(resolvedBody);

  const resolvedReferences = doc.references
    .map((ref) => ({ ...ref, resolvedNumber: citationOrder.get(ref.id) ?? Number.MAX_SAFE_INTEGER }))
    .sort((a, b) => a.resolvedNumber - b.resolvedNumber);

  return {
    ...doc,
    body: resolvedBody,
    references: resolvedReferences,
  };
}
