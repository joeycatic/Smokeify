import { permanentRedirect } from "next/navigation";
import {
  buildGrowvaultCustomizerUrl,
  logGrowvaultCustomizerBridge,
} from "@/lib/growvaultPublicStorefront";

export default function CustomizerPage() {
  logGrowvaultCustomizerBridge({
    sourcePath: "/customizer",
    targetPath: "/customizer",
    method: "GET",
    mode: "redirect",
  });
  permanentRedirect(buildGrowvaultCustomizerUrl());
}
