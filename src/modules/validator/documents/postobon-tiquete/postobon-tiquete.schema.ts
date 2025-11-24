import { BaseInvoiceSchema } from '../base';
import {
  PostobonTiqueteBodyFields,
  PostobonTiqueteHeaderFields,
} from './postobon-tiquete.fields';

export type PostobonTiqueteInvoiceSchema = BaseInvoiceSchema<
  PostobonTiqueteHeaderFields,
  PostobonTiqueteBodyFields
>;
