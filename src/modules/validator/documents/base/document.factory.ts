import { AjeInvoice } from '../aje';
import { CokeInvoice } from '../coke/coke.document';
import { FemsaInvoice } from '../femsa';
import { InfocargueInvoice } from '../infocargue';
import { PostobonInvoice } from '../postobon';
import { QualaInvoice } from '../quala';
import { TiquetePosPostobonInvoice } from '../tiquete-pos-postobon';

export class DocumentFactory {
  static create(type: string, ocrResponse: any, service: any) {
    switch (type) {
      case 'Factura Coke':
        return new CokeInvoice(ocrResponse, service);

      case 'Factura Postobon':
        return new PostobonInvoice(ocrResponse, service);

      case 'Factura Infocargue':
        return new InfocargueInvoice(ocrResponse, service);

      case 'Factura Tiquete POS Postobon':
        return new TiquetePosPostobonInvoice(ocrResponse, service);

      case 'Femsa':
        return new FemsaInvoice(ocrResponse, service);

      case 'Aje':
        return new AjeInvoice(ocrResponse, service);

      case 'Quala':
        return new QualaInvoice(ocrResponse, service);

      default:
        throw new Error(`Documento no soportado: ${type}`);
    }
  }
}
