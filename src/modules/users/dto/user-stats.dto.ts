export class UserStatsResponseDto {
  userId: number;
  periodStart: Date;
  periodEnd: Date;
  documentsProcessed: number;
  productsModified: number;
}
