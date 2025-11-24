import { MeikoService } from 'src/modules/meiko/meiko.service';
import { ValidateInvoiceDto } from '../dto/validate-invoice.dto';
import { Fields } from '../enums/fields';
import { ValidatorUtils as Validator } from '../utils/validator.utils';

const CokeValidator = async (
  invoice: ValidateInvoiceDto,
  meikoService: MeikoService,
) => {
  const headers = invoice.encabezado;
  const body = Validator.groupFields(invoice.detalles);

  for (const field of headers) {
    if (field.type === Fields.FECHA_FACTURA) {
      // el año actual
      // fecha obsoleta si es de hace más de 3 meses
    }
    if (field.type === Fields.NUMERO_FACTURA) {
      if (Validator.isNumeric(field?.text)) {
        field.confidence = 1;
        field.text = field?.text?.slice(-5);
      }
    }
    if (field.type === Fields.VALOR_TOTAL_FACTURA) {
      //debe coincidir con el total de los productos
    }
    if (field.type === Fields.RAZON_SOCIAL) {
      field.confidence = 1;
    }
  }

  for (const product of body) {
    const descriptionField = product.find(
      (field) => field.type == Fields.ITEM_DESCRIPCION_PRODUCTO,
    );
    if (descriptionField?.text === 'REDUCCION') {
      // asignar 1 de confianza en el resto de campos y pasar al siguiente producto
      break;
    }
    const razonSocialField = headers.find(field => field.type === Fields.RAZON_SOCIAL)
    const productDB = await meikoService.findByDescription(
      razonSocialField?.text || '', 
      descriptionField?.text || '',
    );
    for (const field of product) {
      if (field.type === Fields.CODIGO_PRODUCTO) {
        if (productDB?.productCode === field.text) {
          field.confidence = 1;
        }
      }
      if (field.type === Fields.TIPO_EMBALAJE) {
        if (productDB?.packagingType === field.text) {
          field.confidence = 1;
        }
      }
      if (field.type === Fields.UNIDADES_VENDIDAS) {
      }
      if (field.type === Fields.VALOR_UNITARIO_ITEM) {
        if (productDB?.packagingType === field.text) {
          field.confidence = 1;
        }
      }
      if (field.type === Fields.VALOR_VENTA_ITEM) {
        if (productDB?.saleValue === field.text) {
          field.confidence = 1;
        }
      }
      if (field.type === Fields.VALOR_IBUA_Y_OTROS) {
        if (productDB?.valueIbuaAndOthers === field.text) {
          field.confidence = 1;
        }
      }
    }
  }
};

export const VALIDATORS = {
  Coke: CokeValidator,
};
