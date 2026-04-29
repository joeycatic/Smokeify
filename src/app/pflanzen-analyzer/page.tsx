import { permanentRedirect } from "next/navigation";
import {
  buildGrowvaultAnalyzerUrl,
  logGrowvaultAnalyzerBridge,
} from "@/lib/growvaultPublicStorefront";

export default function PlantAnalyzerPage() {
  logGrowvaultAnalyzerBridge({
    sourcePath: "/pflanzen-analyzer",
    targetPath: "/pflanzen-analyse",
    method: "GET",
    mode: "redirect",
  });
  permanentRedirect(buildGrowvaultAnalyzerUrl());
}
