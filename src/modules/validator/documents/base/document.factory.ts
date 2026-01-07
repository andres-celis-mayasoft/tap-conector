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
import { GeneralInvoice, GeneralInvoiceSchema } from '../general';
import { TolimaInvoiceSchema } from '../tolima/tolima.schema';
import { TolimaInvoice } from '../tolima/tolima.document';
import { KoppsInvoice, KoppsInvoiceSchema } from '../kopps';
import { ExcludedService } from 'src/modules/excluded/excluded.service';
import { ProductService } from 'src/modules/product/product.service';
import { AlpinaInvoice, AlpinaInvoiceSchema } from '../alpina';
import {
  DistribuidorGrpsInvoice,
  DistribuidorGrpsInvoiceSchema,
} from '../distribuidor-grps';
import {
  EntregaPostobonInvoice,
  EntregaPostobonInvoiceSchema,
} from '../entrega-postobon';
import { EntregaCokeInvoice } from '../entrega-coke/entrega-coke.document';
import { EntregaCokeInvoiceSchema } from '../entrega-coke/entrega-coke.schema';

const documentMap = {
  'Factura Coke': CokeInvoice,
  'Factura Postobon': PostobonInvoice,
  'Infocargue Postobon': InfocargueInvoice,
  'Factura Tiquete POS Postobon': TiquetePosPostobonInvoice,
  'Factura Femsa': FemsaInvoice,
  'Factura Aje': AjeInvoice,
  'Factura Quala': QualaInvoice,
  'Factura Tolima': TolimaInvoice,
  'Factura Kopps': KoppsInvoice,
  'Factura Otros Proveedores': GeneralInvoice,
  'Factura Alpina': AlpinaInvoice,
  'Factura Distribuidor GRPS': DistribuidorGrpsInvoice,
  'Entrega Postobon': EntregaPostobonInvoice,
  'Recibo Entrega Coke': EntregaCokeInvoice,
};

export type ProcessedDataSchema =
  | CokeInvoiceSchema
  | PostobonInvoiceSchema
  | InfocargueInvoiceSchema
  | TiquetePosPostobonInvoiceSchema
  | FemsaInvoiceSchema
  | AjeInvoiceSchema
  | QualaInvoiceSchema
  | GeneralInvoiceSchema
  | TolimaInvoiceSchema
  | KoppsInvoiceSchema
  | AlpinaInvoiceSchema
  | DistribuidorGrpsInvoiceSchema
  | EntregaCokeInvoiceSchema
  | EntregaPostobonInvoiceSchema;

export type SupportedInvoiceType = InstanceType<
  (typeof documentMap)[keyof typeof documentMap]
>;

export class DocumentFactory {
  static create(
    type: string,
    ocrResponse: ProcessedDataSchema,
    meikoService: MeikoService,
    invoiceService: InvoiceService,
    excludedService: ExcludedService,
    productService: ProductService,
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

      case 'Factura Tolima':
        return new TolimaInvoice(
          ocrResponse as TolimaInvoiceSchema,
          meikoService,
          invoiceService,
        );

      case 'Factura Kopps':
        return new KoppsInvoice(
          ocrResponse as KoppsInvoiceSchema,
          excludedService,
          productService,
        );

      case 'Factura Otros Proveedores':
        return new GeneralInvoice(
          ocrResponse as GeneralInvoiceSchema,
          meikoService,
          invoiceService,
        );

      case 'Factura Alpina':
        return new AlpinaInvoice(
          ocrResponse as AlpinaInvoiceSchema,
          meikoService,
          invoiceService,
        );

      case 'Factura Distribuidor GRPS':
        return new DistribuidorGrpsInvoice(
          ocrResponse as DistribuidorGrpsInvoiceSchema,
          meikoService,
          invoiceService,
        );

      case 'Entrega Postobon':
        return new EntregaPostobonInvoice(
          ocrResponse as EntregaPostobonInvoiceSchema,
          meikoService,
          invoiceService,
        );

      case 'Recibo Entrega Coke':
        return new EntregaCokeInvoice(
          ocrResponse as EntregaCokeInvoiceSchema,
          meikoService,
          invoiceService,
        );

      case 'Recibo Entrega Postobon':
        return new EntregaPostobonInvoice(
          ocrResponse as EntregaPostobonInvoiceSchema,
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
    excludedService: ExcludedService,
    productService: ProductService,
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

      case 'Factura Tolima':
        return new TolimaInvoice(
          ocrResponse as TolimaInvoiceSchema,
          meikoService,
          invoiceService,
        ).format();

      case 'Factura Kopps':
        return new KoppsInvoice(
          ocrResponse as KoppsInvoiceSchema,
          excludedService,
          productService,
        ).format();

      case 'Factura Otros Proveedores':
        return new GeneralInvoice(
          ocrResponse as GeneralInvoiceSchema,
          meikoService,
          invoiceService,
        ).format();

      case 'Factura Alpina':
        return new AlpinaInvoice(
          ocrResponse as AlpinaInvoiceSchema,
          meikoService,
          invoiceService,
        ).format();

      case 'Factura Distribuidor GRPS':
        return new DistribuidorGrpsInvoice(
          ocrResponse as DistribuidorGrpsInvoiceSchema,
          meikoService,
          invoiceService,
        ).format();

      case 'Entrega Postobon':
        return new EntregaPostobonInvoice(
          ocrResponse as EntregaPostobonInvoiceSchema,
          meikoService,
          invoiceService,
        ).format();

      case 'Recibo Entrega Coke':
        return new EntregaCokeInvoice(
          ocrResponse as EntregaCokeInvoiceSchema,
          meikoService,
          invoiceService,
        ).format();
      
      case 'Recibo Entrega Postobon':
        return new EntregaPostobonInvoice(
          ocrResponse as EntregaPostobonInvoiceSchema,
          meikoService,
          invoiceService,
        ).format();

      default:
        throw new Error(`Documento no soportado: ${type}`);
    }
  }
}
