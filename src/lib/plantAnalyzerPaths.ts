export const PLANT_ANALYZER_PATH = "/pflanzen-analyse";
export const PLANT_ANALYZER_TEST_PATH = `${PLANT_ANALYZER_PATH}/test`;

export const PLANT_ANALYZER_CASE_LIBRARY_PATH = `${PLANT_ANALYZER_PATH}/faelle`;

export function buildPlantAnalyzerCaseLibraryPath(slug?: string | null) {
  if (!slug) return PLANT_ANALYZER_CASE_LIBRARY_PATH;
  return `${PLANT_ANALYZER_CASE_LIBRARY_PATH}/${slug}`;
}

