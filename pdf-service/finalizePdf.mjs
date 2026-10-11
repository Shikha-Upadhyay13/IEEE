import { PDFDocument, PDFName } from "pdf-lib";

/**
 * Makes Chromium's PDF friendlier to IEEE PDF eXpress: sets document
 * metadata and, for submission copies, removes link annotations and the
 * bookmark outline. The output is unencrypted and written without object
 * streams, so it stays readable by PDF 1.4-era checkers.
 */
export async function finalizePdf(bytes, { title = "", authors = "", keywords = [], submission = false } = {}) {
  const pdf = await PDFDocument.load(bytes, { updateMetadata: false });

  pdf.setTitle(title, { showInWindowTitleBar: true });
  pdf.setAuthor(authors);
  pdf.setSubject(title);
  pdf.setKeywords(keywords);
  pdf.setCreator("IEEE Paper Builder");
  pdf.setProducer("IEEE Paper Builder");
  const now = new Date();
  pdf.setCreationDate(now);
  pdf.setModificationDate(now);

  if (submission) {
    for (const page of pdf.getPages()) {
      const annots = page.node.Annots();
      if (!annots) continue;
      const kept = annots.asArray().filter((ref) => {
        const annot = pdf.context.lookup(ref);
        return annot?.get?.(PDFName.of("Subtype")) !== PDFName.of("Link");
      });
      if (kept.length === 0) page.node.delete(PDFName.of("Annots"));
      else page.node.set(PDFName.of("Annots"), pdf.context.obj(kept));
    }
    pdf.catalog.delete(PDFName.of("Outlines"));
  }

  return Buffer.from(await pdf.save({ useObjectStreams: false }));
}
