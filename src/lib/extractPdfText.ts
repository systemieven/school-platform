/**
 * extractPdfText — wrapper lazy sobre pdfjs-dist.
 *
 * Motivação: pdfjs-dist pesa ~500 KB e só é usado em dois pontos (drawer de
 * candidato no admin / página pública /trabalhe-conosco do PR4). O dynamic
 * import mantém o bundle inicial leve.
 *
 * Retorna o texto concatenado de todas as páginas, separado por `\n`.
 * Lança erro com mensagem legível se o PDF for inválido ou encriptado.
 */

type PdfLoader = typeof import('pdfjs-dist');

let cached: PdfLoader | null = null;

async function loadPdfjs(): Promise<PdfLoader> {
  if (cached) return cached;
  // O pdfjs-dist 4.x exige workerSrc configurado. Usamos um worker inline via
  // Vite's `?url` import para ficar independente de CDN.
  const pdfjs = await import('pdfjs-dist');
  const workerMod = (await import(
    /* @vite-ignore */ 'pdfjs-dist/build/pdf.worker.min.mjs?url'
  )) as { default: string };
  pdfjs.GlobalWorkerOptions.workerSrc = workerMod.default;
  cached = pdfjs;
  return pdfjs;
}

export interface ExtractedPdfText {
  text: string;
  pageCount: number;
  truncated: boolean;
}

/** Limite defensivo para não enviar PDFs absurdamente longos ao LLM. */
const MAX_CHARS = 24_000;

/**
 * Extrai texto de um PDF passado como `File`, `Blob` ou `ArrayBuffer`.
 * Trunca em MAX_CHARS para proteger o orçamento de tokens do agente.
 */
export async function extractPdfText(
  input: File | Blob | ArrayBuffer,
): Promise<ExtractedPdfText> {
  const pdfjs = await loadPdfjs();

  const data = input instanceof ArrayBuffer ? input : await input.arrayBuffer();

  let doc;
  try {
    doc = await pdfjs.getDocument({ data }).promise;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`Não foi possível ler o PDF: ${msg}`);
  }

  const parts: string[] = [];
  let total = 0;
  let truncated = false;

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!pageText) continue;
    if (total + pageText.length > MAX_CHARS) {
      parts.push(pageText.slice(0, MAX_CHARS - total));
      truncated = true;
      break;
    }
    parts.push(pageText);
    total += pageText.length;
  }

  return {
    text: parts.join('\n'),
    pageCount: doc.numPages,
    truncated,
  };
}
