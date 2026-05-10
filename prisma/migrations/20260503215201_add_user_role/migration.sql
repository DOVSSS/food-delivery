-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'RESTAURANT', 'COURIER', 'ADMIN');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "role" "Role" NOT NULL DEFAULT 'USER';
