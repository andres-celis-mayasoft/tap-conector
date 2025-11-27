-- CreateTable
CREATE TABLE "document" (
    "id" SERIAL NOT NULL,
    "document_id" INTEGER NOT NULL,
    "file_id" TEXT,
    "survey_id" TEXT,
    "photo_type" TEXT,
    "photo_type_ocr" TEXT,
    "errors" TEXT,
    "extracted" BOOLEAN NOT NULL DEFAULT false,
    "validated" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL,
    "capture_start_date" TIMESTAMP(3),
    "capture_end_date" TIMESTAMP(3),
    "document_url" TEXT,
    "maya_document_json" TEXT,
    "tap_document_json" TEXT,
    "path" TEXT,
    "assigned_user_id" INTEGER,
    "assigned_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "field" (
    "id" SERIAL NOT NULL,
    "document_id" INTEGER NOT NULL,
    "row" SMALLINT,
    "name" TEXT NOT NULL,
    "value" TEXT,
    "corrected_value" TEXT,
    "confidence" DECIMAL(5,2),
    "type" TEXT NOT NULL,
    "extracted" BOOLEAN NOT NULL DEFAULT false,
    "validated" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "field_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT,
    "role" TEXT NOT NULL DEFAULT 'user',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "excluded_products" (
    "id" SERIAL NOT NULL,
    "description" VARCHAR(500),

    CONSTRAINT "excluded_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "factura" (
    "id_factura" SERIAL NOT NULL,
    "idRegistroEncuesta" BIGINT NOT NULL,
    "responseId" BIGINT,
    "sticketQR" VARCHAR(50),
    "responseReceived" VARCHAR(100),
    "nombre_variable" VARCHAR(255),
    "tipo_foto" VARCHAR(255),
    "link" TEXT,
    "flag_digitalizacion" SMALLINT,
    "fecha_digitalizacion" TIMESTAMP(3),
    "fechaExtraccion" TIMESTAMP(3),

    CONSTRAINT "factura_pkey" PRIMARY KEY ("id_factura")
);

-- CreateTable
CREATE TABLE "resultado_digitalizacion" (
    "id_detalle_factura" SERIAL NOT NULL,
    "id_factura" INTEGER NOT NULL,
    "idRegistroEncuesta" INTEGER NOT NULL,
    "numero_factura" VARCHAR(11),
    "fecha_factura" TIMESTAMP(3),
    "razon_social" TEXT,
    "codigoProducto" VARCHAR(111),
    "descripcion" VARCHAR(500),
    "tipo_embalage" VARCHAR(255),
    "unidad_embalage" DECIMAL(11,2),
    "packs_vendidos" DECIMAL(11,2),
    "valor_venta" DECIMAL(10,0),
    "unidades_vendidas" DECIMAL(11,2),
    "total_factura" DECIMAL(11,2),
    "total_factura_sin_iva" DECIMAL(11,2),
    "numeroFila" INTEGER NOT NULL,
    "VALOR_IBUA_Y_OTROS" INTEGER,

    CONSTRAINT "resultado_digitalizacion_pkey" PRIMARY KEY ("id_detalle_factura")
);

-- CreateTable
CREATE TABLE "estado_digitalizacion_factura" (
    "id" SERIAL NOT NULL,
    "id_factura" INTEGER NOT NULL,
    "estado_digitalizacion_id" INTEGER NOT NULL,

    CONSTRAINT "estado_digitalizacion_factura_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "document_document_id_key" ON "document"("document_id");

-- CreateIndex
CREATE INDEX "document_assigned_user_id_idx" ON "document"("assigned_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE INDEX "factura_sticketQR_idx" ON "factura"("sticketQR");

-- CreateIndex
CREATE INDEX "factura_tipo_foto_idx" ON "factura"("tipo_foto");

-- CreateIndex
CREATE INDEX "factura_responseId_idx" ON "factura"("responseId");

-- CreateIndex
CREATE UNIQUE INDEX "factura_idRegistroEncuesta_nombre_variable_key" ON "factura"("idRegistroEncuesta", "nombre_variable");

-- CreateIndex
CREATE INDEX "resultado_digitalizacion_idRegistroEncuesta_idx" ON "resultado_digitalizacion"("idRegistroEncuesta");

-- CreateIndex
CREATE INDEX "resultado_digitalizacion_numero_factura_idx" ON "resultado_digitalizacion"("numero_factura");

-- CreateIndex
CREATE INDEX "resultado_digitalizacion_descripcion_idx" ON "resultado_digitalizacion"("descripcion");

-- CreateIndex
CREATE INDEX "resultado_digitalizacion_fecha_factura_idx" ON "resultado_digitalizacion"("fecha_factura");

-- CreateIndex
CREATE UNIQUE INDEX "resultado_digitalizacion_id_factura_numeroFila_key" ON "resultado_digitalizacion"("id_factura", "numeroFila");

-- CreateIndex
CREATE UNIQUE INDEX "estado_digitalizacion_factura_id_factura_key" ON "estado_digitalizacion_factura"("id_factura");

-- AddForeignKey
ALTER TABLE "document" ADD CONSTRAINT "document_assigned_user_id_fkey" FOREIGN KEY ("assigned_user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field" ADD CONSTRAINT "field_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "document"("document_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resultado_digitalizacion" ADD CONSTRAINT "resultado_digitalizacion_id_factura_fkey" FOREIGN KEY ("id_factura") REFERENCES "document"("document_id") ON DELETE CASCADE ON UPDATE CASCADE;
