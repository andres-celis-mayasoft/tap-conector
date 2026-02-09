import { Global, Module } from '@nestjs/common';
import { AssignmentService } from './assignment.service';

@Global()
@Module({
  providers: [AssignmentService],
  exports: [AssignmentService],
})
export class AssignmentModule {}
