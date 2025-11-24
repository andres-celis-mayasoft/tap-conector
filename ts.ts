export const EXAMPLE = {
  encabezado: [
    {
      type: "fecha_factura",
      text: "2825-18-24",
      confidence: 0.9,
    },
    {
      type: "numero_factura",
      text: "61443",
      confidence: 0.6,
    },
    {
      type: "razon_social",
      text: "POSTOBON S.A.",
      confidence: 1.0,
    },
    {
      type: "total_factura_sin_iva",
      text: "999,6",
      confidence: 0.81,
    },
    {
      type: "valor_total_factura",
      text: "12888,4",
      confidence: 0.92,
    },
  ],
  detalles: [
    {
      type: "codigo_producto",
      text: "",
      confidence: 1.0,
      row: 1,
    },
    {
      type: "item_descripcion_producto",
      text: "AGUA CRISTAL PLANA PET 300ML X24 SPRECI",
      confidence: 0.95,
      row: 1,
    },
    {
      type: "tipo_embalaje",
      text: "ST",
      confidence: 0.86,
      row: 1,
    },
    {
      type: "unidades_vendidas",
      text: "1.2",
      confidence: 1.0,
      row: 1,
    },
    {
      type: "valor_venta_item",
      text: "12000",
      confidence: 1.0,
      row: 1,
    },
    {
      type: "unidades_embalaje",
      text: "24",
      confidence: 1.0,
      row: 1,
    },
    {
      type: "packs_vendidos",
      confidence: 1.0,
      row: 1,
    },
    {
      type: "es_devolucion",
      text: "0",
      confidence: 1.0,
      row: 1,
    },
  ],
  tipoFacturaOcr: "Factura Tiquete POS Postobon",
  urlFactura:
    "https://www.easysales.com.co/ServiciosEasySurvey/api/ObtenerEvidencia?usuario=EasySurveyClientMeiko&password=EasySurveyClientMeiko&nombre_archivo_int=C659608FCDE778B6_20251101_092750.jpg&nombre_archivo=6760468_Foto_Factura_Postobon_1.jpg",
  id: 211,
  facturaId: 4211357,
};
