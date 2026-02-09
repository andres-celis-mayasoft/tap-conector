import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Logger,
  ParseIntPipe,
} from '@nestjs/common';
import { StickerService } from './sticker.service';
import { UpdateStickerDto } from './dto/update-sticker.dto';
import { StickerStatus } from './domain/sticker.types';

@Controller('sticker')
export class StickerController {
  private readonly logger = new Logger(StickerController.name);

  constructor(private readonly stickerService: StickerService) {}

  // ==================== QUERY ENDPOINTS ====================

  @Get()
  async findAll(
    @Query('submissionId') submissionId?: string,
    @Query('photoType') photoType?: string,
    @Query('status') status?: StickerStatus,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    this.logger.log('Finding all stickers');
    return this.stickerService.findAll({
      submissionId,
      photoType,
      status,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Get('pending')
  async findPending(@Query('limit') limit?: string) {
    this.logger.log('Finding pending stickers');
    return this.stickerService.findPending(limit ? parseInt(limit, 10) : undefined);
  }

  @Get('unassigned')
  async findUnassigned(@Query('limit') limit?: string) {
    this.logger.log('Finding unassigned stickers');
    return this.stickerService.findUnassigned(limit ? parseInt(limit, 10) : undefined);
  }

  @Get('assigned/:userId')
  async findByAssignedUser(@Param('userId', ParseIntPipe) userId: number) {
    this.logger.log(`Finding stickers assigned to user: ${userId}`);
    return this.stickerService.findByAssignedUser(userId);
  }

  @Get('count')
  async count(
    @Query('submissionId') submissionId?: string,
    @Query('photoType') photoType?: string,
    @Query('status') status?: StickerStatus,
  ) {
    return this.stickerService.count({ submissionId, photoType, status });
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    this.logger.log(`Finding sticker with id: ${id}`);
    return this.stickerService.findById(id);
  }

  @Get('external/:externalId')
  async findByExternalId(@Param('externalId', ParseIntPipe) externalId: number) {
    this.logger.log(`Finding sticker with externalId: ${externalId}`);
    return this.stickerService.findByExternalId(externalId);
  }

  // ==================== UPDATE ENDPOINTS ====================

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateStickerDto: UpdateStickerDto,
  ) {
    this.logger.log(`Updating sticker with id: ${id}`);
    return this.stickerService.update(id, updateStickerDto);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    this.logger.log(`Removing sticker with id: ${id}`);
    await this.stickerService.delete(id);
    return { message: `Sticker ${id} deleted` };
  }

  // ==================== VALIDATION WORKFLOW ENDPOINTS ====================

  @Post(':id/assign/:userId')
  async assignToUser(
    @Param('id', ParseIntPipe) id: number,
    @Param('userId', ParseIntPipe) userId: number,
  ) {
    this.logger.log(`Assigning sticker ${id} to user ${userId}`);
    return this.stickerService.assignToUser(id, userId);
  }

  @Post(':id/unassign')
  async unassign(@Param('id', ParseIntPipe) id: number) {
    this.logger.log(`Unassigning sticker ${id}`);
    return this.stickerService.unassign(id);
  }

  @Post(':id/start-processing')
  async startProcessing(@Param('id', ParseIntPipe) id: number) {
    this.logger.log(`Starting processing for sticker ${id}`);
    return this.stickerService.startProcessing(id);
  }

  @Post(':id/complete')
  async completeValidation(@Param('id', ParseIntPipe) id: number) {
    this.logger.log(`Completing validation for sticker ${id}`);
    return this.stickerService.completeValidation(id);
  }

  @Post(':id/error')
  async markAsError(
    @Param('id', ParseIntPipe) id: number,
    @Body('error') error: string,
  ) {
    this.logger.log(`Marking sticker ${id} as error`);
    return this.stickerService.markAsError(id, error);
  }

  @Post(':id/no-procesable')
  async markAsNoProcesable(@Param('id', ParseIntPipe) id: number) {
    this.logger.log(`Marking sticker ${id} as no procesable`);
    return this.stickerService.markAsNoProcesable(id);
  }

  // ==================== SYNC ENDPOINTS ====================

  @Post('extract')
  async extractFromClient(@Query('limit') limit?: string) {
    this.logger.log('Manually triggering extraction from client DB');
    const extracted = await this.stickerService.extractPendingFromClient(
      limit ? parseInt(limit, 10) : undefined,
    );
    return { extracted: extracted.length, stickers: extracted };
  }

  @Post('deliver')
  async deliverToClient() {
    this.logger.log('Manually triggering delivery to client DB');
    const delivered = await this.stickerService.deliverCompletedToClient();
    return { delivered };
  }
}
