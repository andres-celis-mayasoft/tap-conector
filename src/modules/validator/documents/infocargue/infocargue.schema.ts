import { BaseInvoiceSchema } from '../base';
import { InfocargueBodyFields, InfocargueHeaderFields } from './infocargue.fields';

export type InfocargueInvoiceSchema = BaseInvoiceSchema<
  InfocargueHeaderFields,
  InfocargueBodyFields
>;
