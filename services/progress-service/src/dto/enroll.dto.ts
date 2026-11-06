import { ApiProperty } from '@nestjs/swagger';

export class EnrollDto {
  @ApiProperty({ example: 'go', description: 'The chosen programming language for this workshop' })
  language!: string;
}
