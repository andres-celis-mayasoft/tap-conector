import { BaseInvoiceSchema } from '../base';
import { CokeBodyFields, CokeHeaderFields } from './coke.fields';

export type CokeInvoiceSchema = BaseInvoiceSchema<
  CokeHeaderFields,
  CokeBodyFields
>;
