import { InvoiceService } from 'src/modules/invoice/invoice.service';
import { AjeInvoice } from '../aje';
import { CokeInvoice } from '../coke/coke.document';
import { FemsaInvoice } from '../femsa';
import { InfocargueInvoice } from '../infocargue';
import { PostobonInvoice } from '../postobon';
import { QualaInvoice } from '../quala';
import { TiquetePosPostobonInvoice } from '../tiquete-pos-postobon';
import { MeikoService } from 'src/modules/meiko/meiko.service';

export class DocumentFactory {
  static create(
    type: string,
    ocrResponse: any,
    meikoService: MeikoService,
    invoiceService: InvoiceService,
  ) {
    switch (type) {
      case 'Factura Coke':
        return new CokeInvoice(ocrResponse, meikoService, invoiceService);

      case 'Factura Postobon':
        return new PostobonInvoice(ocrResponse, meikoService, invoiceService);

      case 'Infocargue Postobon':
        return new InfocargueInvoice(ocrResponse, meikoService, invoiceService);

      case 'Factura Tiquete POS Postobon':
        return new TiquetePosPostobonInvoice(
          ocrResponse,
          meikoService,
          invoiceService,
        );

      case 'Factura Femsa':
        return new FemsaInvoice(ocrResponse, meikoService, invoiceService);

      case 'Factura Aje':
        return new AjeInvoice(ocrResponse, meikoService, invoiceService);

      case 'Factura Quala':
        return new QualaInvoice(ocrResponse, meikoService, invoiceService);

      default:
        throw new Error(`Documento no soportado: ${type}`);
    }
  }
}
