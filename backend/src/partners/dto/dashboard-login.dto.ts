import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class DashboardLoginDto {
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @IsString()
  @MinLength(12)
  @MaxLength(200)
  password!: string;
}
