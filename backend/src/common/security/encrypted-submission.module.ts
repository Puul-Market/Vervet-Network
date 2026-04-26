import { Module } from '@nestjs/common';
import { EncryptedSubmissionService } from './encrypted-submission.service';

@Module({
  providers: [EncryptedSubmissionService],
  exports: [EncryptedSubmissionService],
})
export class EncryptedSubmissionModule {}
