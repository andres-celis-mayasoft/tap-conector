import { CokeInvoice } from '../coke/coke.document';
// import { PostobonInvoice } from '../postobon/postobon.document';
// import { InfocargueInvoice } from '../infocargue/infocargue.document';
// import { PostobonTiqueteInvoice } from '../postobon-tiquete/postobon-tiquete.document';

export class DocumentFactory {
  static create(type: string, ocrResponse: any, service: any) {
    switch (type) {
      case 'Factura Coke':
        return new CokeInvoice(ocrResponse,service);

      // case 'Factura Postobon':
      //   return new PostobonInvoice(ocrResponse);

      // case 'Factura Infocargue':
      //   return new InfocargueInvoice(ocrResponse);

      // case 'Factura Tiquete POS Postobon':
      //   return new PostobonTiqueteInvoice(ocrResponse);

      default:
        throw new Error(`Documento no soportado: ${type}`);
    }
  }
}
