import { CokeInvoice } from "./coke/coke.document";

export class DocumentFactory {
  static create(type: string, ocrResponse: any) {
    switch (type) {
      case "Factura Coke":
        return new CokeInvoice(ocrResponse);


      default:
        throw new Error(`Documento no soportado: ${type}`);
    }
  }
}
