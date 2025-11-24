import { CokeInvoice } from './coke/coke.document';
import { PostobonInvoice } from './postobon/postobon.document';
import { InfocargueInvoice } from './infocargue/infocargue.document';

export class DocumentFactory {
  static create(type: string, ocrResponse: any) {
    switch (type) {
      case 'Factura Coke':
        return new CokeInvoice(ocrResponse);

      case 'Factura Postobon':
        return new PostobonInvoice(ocrResponse);

      case 'Factura Infocargue':
        return new InfocargueInvoice(ocrResponse);

      default:
        throw new Error(`Documento no soportado: ${type}`);
    }
  }
}
