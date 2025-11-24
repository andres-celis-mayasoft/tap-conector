import { BaseInvoiceSchema } from '../base';
import { PostobonBodyFields, PostobonHeaderFields } from './postobon.fields';

export type PostobonInvoiceSchema = BaseInvoiceSchema<
  PostobonHeaderFields,
  PostobonBodyFields
>;
