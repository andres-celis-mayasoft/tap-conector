export class InvoiceUtils {
  static getErrors(data) {
    data.encabezado = data.encabezado.filter(
      (field) => field.confidence < 1,
    ) as any;
    data.detalles = data.detalles.filter(
      (field) => field.confidence < 1,
    ) as any;

    return [
      ...data.encabezado.map(
        (field) => 'Field: ' + field.type + ' Error: ' + field.error,
      ),
      ...data.detalles.map(
        (field) =>
          'Field: ' +
          field.type +
          ' Row: ' +
          field.row +
          ' Error: ' +
          field.error,
      ),
    ];
  }
}
