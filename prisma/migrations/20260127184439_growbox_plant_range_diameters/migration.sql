/*
  Warnings:

  - You are about to drop the column `growboxPlantCount` on the `Product` table. All the data in the column will be lost.
  - The `growboxConnectionDiameterMm` column on the `Product` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "Product" DROP COLUMN "growboxPlantCount",
ADD COLUMN     "growboxPlantCountMax" INTEGER,
ADD COLUMN     "growboxPlantCountMin" INTEGER,
DROP COLUMN "growboxConnectionDiameterMm",
ADD COLUMN     "growboxConnectionDiameterMm" INTEGER[] DEFAULT ARRAY[]::INTEGER[];
