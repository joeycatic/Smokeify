import type { GrowvaultIconName } from "@/components/icons/GrowvaultIcon";

export function getCategoryIconName(name: string): GrowvaultIconName {
  const value = name.toLowerCase();

  if (
    value.includes("duenger") ||
    value.includes("dünger") ||
    value.includes("substrat") ||
    value.includes("erde") ||
    value.includes("coco") ||
    value.includes("soil")
  ) {
    return "soil";
  }

  if (
    value.includes("bewaesser") ||
    value.includes("bewässer") ||
    value.includes("wasser") ||
    value.includes("osmose") ||
    value.includes("autopot")
  ) {
    return "water";
  }

  if (
    value.includes("abluft") ||
    value.includes("filter") ||
    value.includes("luft") ||
    value.includes("klima") ||
    value.includes("ventilator")
  ) {
    return "fan";
  }

  if (
    value.includes("zelt") ||
    value.includes("growbox")
  ) {
    return "tent";
  }

  if (value.includes("licht") || value.includes("led") || value.includes("lampe")) {
    return "light";
  }

  if (
    value.includes("anzucht") ||
    value.includes("samen") ||
    value.includes("seed")
  ) {
    return "sprout";
  }

  if (
    value.includes("messen") ||
    value.includes("mess") ||
    value.includes("ph") ||
    value.includes("ec") ||
    value.includes("steuer")
  ) {
    return "gauge";
  }

  if (value.includes("zubehoer") || value.includes("zubehör") || value.includes("tool")) {
    return "package";
  }

  if (value.includes("set") || value.includes("bundle")) {
    return "package";
  }

  return "leaf";
}
