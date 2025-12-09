import { InvoiceService } from 'src/modules/invoice/invoice.service';
import { AjeInvoice, AjeInvoiceSchema } from '../aje';
import { CokeInvoice } from '../coke/coke.document';
import { FemsaInvoice, FemsaInvoiceSchema } from '../femsa';
import { InfocargueInvoice, InfocargueInvoiceSchema } from '../infocargue';
import { PostobonInvoice, PostobonInvoiceSchema } from '../postobon';
import { QualaInvoice, QualaInvoiceSchema } from '../quala';
import {
  TiquetePosPostobonInvoice,
  TiquetePosPostobonInvoiceSchema,
} from '../tiquete-pos-postobon';
import { MeikoService } from 'src/modules/meiko/meiko.service';
import { CokeInvoiceSchema } from '../coke/coke.schema';
import { Prisma } from '@generated/client-meiko';

const documentMap = {
  'Factura Coke': CokeInvoice,
  'Factura Postobon': PostobonInvoice,
  'Infocargue Postobon': InfocargueInvoice,
  'Factura Tiquete POS Postobon': TiquetePosPostobonInvoice,
  'Factura Femsa': FemsaInvoice,
  'Factura Aje': AjeInvoice,
  'Factura Quala': QualaInvoice,
};

export type ProcessedDataSchema =
  | CokeInvoiceSchema
  | PostobonInvoiceSchema
  | InfocargueInvoiceSchema
  | TiquetePosPostobonInvoiceSchema
  | FemsaInvoiceSchema
  | AjeInvoiceSchema
  | QualaInvoiceSchema;

export type SupportedInvoiceType = InstanceType<
  (typeof documentMap)[keyof typeof documentMap]
>;

export class DocumentFactory {
  static create(
    type: string,
    ocrResponse: ProcessedDataSchema,
    meikoService: MeikoService,
    invoiceService: InvoiceService,
  ): SupportedInvoiceType {
    switch (type) {
      case 'Factura Coke':
        return new CokeInvoice(
          ocrResponse as CokeInvoiceSchema,
          meikoService,
          invoiceService,
        );

      case 'Factura Postobon':
        return new PostobonInvoice(
          ocrResponse as PostobonInvoiceSchema,
          meikoService,
          invoiceService,
        );

      case 'Infocargue Postobon':
        return new InfocargueInvoice(
          ocrResponse as InfocargueInvoiceSchema,
          meikoService,
          invoiceService,
        );

      case 'Factura Tiquete POS Postobon':
        return new TiquetePosPostobonInvoice(
          ocrResponse as TiquetePosPostobonInvoiceSchema,
          meikoService,
          invoiceService,
        );

      case 'Factura Femsa':
        return new FemsaInvoice(
          ocrResponse as FemsaInvoiceSchema,
          meikoService,
          invoiceService,
        );

      case 'Factura Aje':
        return new AjeInvoice(
          ocrResponse as AjeInvoiceSchema,
          meikoService,
          invoiceService,
        );

      case 'Factura Quala':
        return new QualaInvoice(
          ocrResponse as QualaInvoiceSchema,
          meikoService,
          invoiceService,
        );

      default:
        throw new Error(`Documento no soportado: ${type}`);
    }
  }

  static format(
    type: string,
    ocrResponse: ProcessedDataSchema,
    meikoService: MeikoService,
    invoiceService: InvoiceService,
  ): Prisma.ResultCreateManyInput[] {
    switch (type) {
      case 'Factura Coke':
        return new CokeInvoice(
          ocrResponse as CokeInvoiceSchema,
          meikoService,
          invoiceService,
        ).format();

      case 'Factura Postobon':
        return new PostobonInvoice(
          ocrResponse as PostobonInvoiceSchema,
          meikoService,
          invoiceService,
        ).format();

      case 'Infocargue Postobon':
        return new InfocargueInvoice(
          ocrResponse as InfocargueInvoiceSchema,
          meikoService,
          invoiceService,
        ).format();

      case 'Factura Tiquete POS Postobon':
        return new TiquetePosPostobonInvoice(
          ocrResponse as TiquetePosPostobonInvoiceSchema,
          meikoService,
          invoiceService,
        ).format();

      case 'Factura Femsa':
        return new FemsaInvoice(
          ocrResponse as FemsaInvoiceSchema,
          meikoService,
          invoiceService,
        ).format();

      case 'Factura Aje':
        return new AjeInvoice(
          ocrResponse as AjeInvoiceSchema,
          meikoService,
          invoiceService,
        ).format();

      case 'Factura Quala':
        return new QualaInvoice(
          ocrResponse as QualaInvoiceSchema,
          meikoService,
          invoiceService,
        ).format();

      default:
        throw new Error(`Documento no soportado: ${type}`);
    }
  }
}
