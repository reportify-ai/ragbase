declare module 'pdf-parse/lib/pdf-parse.js' {
  interface PDFData {
    text: string;
    numpages: number;
    info: Record<string, any>;
    metadata: Record<string, any>;
    version: string;
  }

  function pdfParse(dataBuffer: Buffer, options?: {
    pagerender?: (pageData: {
      pageIndex: number;
      pageInfo: {
        num: number;
        scale: number;
        rotation: number;
        offsetX: number;
        offsetY: number;
        width: number;
        height: number;
      };
      render: any;
    }) => Promise<string>;
    max?: number;
    version?: string;
  }): Promise<PDFData>;

  export default pdfParse;
} 