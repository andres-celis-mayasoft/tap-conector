import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { ExcludedService } from './excluded.service';

@Controller('excluded')
export class ExcludedController {
  constructor(private readonly excludedService: ExcludedService) {}

  @Post()
  create(@Body() createExcludedDto: any) {
    return this.excludedService.create(createExcludedDto);
  }

  @Get()
  findAll() {
    return this.excludedService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.excludedService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateExcludedDto: any) {
    return this.excludedService.update(+id, updateExcludedDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.excludedService.remove(+id);
  }
}
