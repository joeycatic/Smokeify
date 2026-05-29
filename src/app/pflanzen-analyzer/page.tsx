import { permanentRedirect } from "next/navigation";
import { PLANT_ANALYZER_PATH } from "@/lib/plantAnalyzerPaths";

export default function PlantAnalyzerAliasPage() {
  permanentRedirect(PLANT_ANALYZER_PATH);
}
