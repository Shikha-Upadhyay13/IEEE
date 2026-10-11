import { test } from "node:test";
import assert from "node:assert/strict";
import { PDFDocument, PDFName, PDFString } from "pdf-lib";
import { finalizePdf } from "./finalizePdf.mjs";

async function samplePdf() {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage();
  const link = pdf.context.register(
    pdf.context.obj({ Type: "Annot", Subtype: "Link", Rect: [0, 0, 10, 10], A: { S: "URI", URI: PDFString.of("https://x") } })
  );
  const note = pdf.context.register(pdf.context.obj({ Type: "Annot", Subtype: "Text", Rect: [0, 0, 10, 10] }));
  page.node.set(PDFName.of("Annots"), pdf.context.obj([link, note]));
  pdf.catalog.set(PDFName.of("Outlines"), pdf.context.register(pdf.context.obj({ Type: "Outlines", Count: 0 })));
  return pdf.save();
}

async function subtypes(bytes) {
  const pdf = await PDFDocument.load(bytes);
  const annots = pdf.getPages()[0].node.Annots();
  return {
    pdf,
    subtypes: annots ? annots.asArray().map((ref) => pdf.context.lookup(ref).get(PDFName.of("Subtype")).asString()) : [],
  };
}

test("submission copies lose links and bookmarks but keep other annotations", async () => {
  const out = await finalizePdf(await samplePdf(), { title: "A Paper", authors: "A. Author", submission: true });
  const { pdf, subtypes: kinds } = await subtypes(out);
  assert.deepEqual(kinds, ["/Text"]);
  assert.equal(pdf.catalog.get(PDFName.of("Outlines")), undefined);
  assert.equal(pdf.getTitle(), "A Paper");
  assert.equal(pdf.getAuthor(), "A. Author");
  assert.ok(out.subarray(0, 8).toString().startsWith("%PDF-1."));
  assert.ok(!out.includes("/Encrypt"));
});

test("draft copies keep their links", async () => {
  const out = await finalizePdf(await samplePdf(), { title: "Draft", submission: false });
  const { subtypes: kinds } = await subtypes(out);
  assert.deepEqual(kinds, ["/Link", "/Text"]);
});
