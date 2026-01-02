import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/database/services/prisma.service';
import { Excluded, Prisma } from '@generated/client';

@Injectable()
export class ExcludedService {
  constructor(private readonly prisma: PrismaService) {}

  async findOneFuzzy(description: string, companyId: number): Promise<Excluded | null> {
    const threshold = 3;

    const products = await this.prisma.$queryRaw<Excluded[]>`
          SELECT * FROM "excluded"
          WHERE levenshtein("description", ${description}) <= ${threshold}
          and "company_id" = ${companyId}
          ORDER BY levenshtein("description", ${description}) ASC
          LIMIT 1;
      `;

    return products[0] || null;
  }

  create(createExcludedDto: Prisma.ExcludedCreateInput) {
    return 'This action adds a new excluded';
  }

  findAll() {
    return `This action returns all excluded`;
  }

  findOne(id: number) {
    return `This action returns a #${id} excluded`;
  }

  update(id: number, updateExcludedDto: Prisma.ExcludedUpdateInput) {
    return `This action updates a #${id} excluded`;
  }

  remove(id: number) {
    return `This action removes a #${id} excluded`;
  }
}
