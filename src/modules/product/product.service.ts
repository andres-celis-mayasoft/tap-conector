import { Injectable } from '@nestjs/common';
import { Prisma, Product } from '@generated/client';
import { Prisma as PrismaRaw } from '@prisma/client';
import { PrismaService } from 'src/database/services/prisma.service';

@Injectable()
export class ProductService {
  constructor(private readonly prisma: PrismaService) {}

  async findOneFuzzy(
    description: string,
    companyId: number,
  ): Promise<Product | null> {
    const threshold = 3;

    const products = await this.prisma.$queryRaw<Product[]>`
            SELECT * FROM "product"
            WHERE levenshtein("description", ${description}) <= ${threshold}
            AND "company_id" = ${companyId}
            ORDER BY levenshtein("description", ${description}) ASC
            LIMIT 1;
        `;

    return products[0] || null;
  }

  async search(
    field: string,
    value: string,
    companyId: number,
  ): Promise<Product[]> {
    const allowedFields = ['code', 'description'];

    if (!allowedFields.includes(field)) {
      throw new Error('Invalid search field');
    }
    // const query =

    // use full text search
    const result = await this.prisma.$queryRawUnsafe(
      `
      SELECT *
      FROM product
      WHERE ${field} ILIKE '%' || $1 || '%'
        AND company_id = $2
      ORDER BY similarity(${field}, $1) DESC
      LIMIT 20;
      `,
      value,
      companyId,
    );

    return result;
  }

  create(createProductDto: Prisma.ProductCreateInput) {
    return 'This action adds a new product';
  }

  findAll() {
    return `This action returns all product`;
  }

  findOne(data: Prisma.ProductWhereInput) {
    return this.prisma.product.findFirst({
      where: data,
    });
  }

  update(id: number, updateProductDto: Prisma.ProductUpdateInput) {
    return `This action updates a #${id} product`;
  }

  remove(id: number) {
    return `This action removes a #${id} product`;
  }
}
