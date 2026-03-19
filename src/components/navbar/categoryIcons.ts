"use client";

import type { ComponentType, SVGProps } from "react";
import {
  ArchiveBoxIcon,
  ArrowPathIcon,
  ArrowsRightLeftIcon,
  BeakerIcon,
  BoltIcon,
  CalculatorIcon,
  CircleStackIcon,
  CloudIcon,
  Cog6ToothIcon,
  DocumentTextIcon,
  FireIcon,
  FunnelIcon,
  HomeModernIcon,
  LightBulbIcon,
  RectangleStackIcon,
  ScaleIcon,
  Squares2X2Icon,
  SparklesIcon,
  SunIcon,
  TrashIcon,
  WrenchScrewdriverIcon,
} from "@heroicons/react/24/outline";

type CategoryIcon = ComponentType<SVGProps<SVGSVGElement>>;

export function getCategoryIcon(name: string): CategoryIcon {
  const value = name.toLowerCase();

  if (value.includes("aschenbecher") || value.includes("ashtray")) {
    return TrashIcon;
  }

  if (value.includes("aufbewahrung") || value.includes("storage")) {
    return ArchiveBoxIcon;
  }

  if (value.includes("grinder")) {
    return Cog6ToothIcon;
  }

  if (value.includes("tube")) {
    return CircleStackIcon;
  }

  if (value.includes("bong") || value.includes("pipe") || value.includes("pfeife")) {
    return BeakerIcon;
  }

  if (value.includes("feuerzeug") || value.includes("lighter")) {
    return FireIcon;
  }

  if (
    value.includes("papers") ||
    value.includes("papier") ||
    value.includes("paper")
  ) {
    return DocumentTextIcon;
  }

  if (value.includes("rolling tray") || value.includes("kraeuterschale") || value.includes("kräuterschale") || value.includes("tray")) {
    return RectangleStackIcon;
  }

  if (
    value.includes("aktivkohlefilter") ||
    value.includes("filter")
  ) {
    return FunnelIcon;
  }

  if (value.includes("waage") || value.includes("waagen") || value.includes("scale")) {
    return ScaleIcon;
  }

  if (value.includes("messen") || value.includes("mess")) {
    return CalculatorIcon;
  }

  if (value.includes("vapor") || value.includes("verdamp")) {
    return BoltIcon;
  }

  if (
    value.includes("duenger") ||
    value.includes("dünger") ||
    value.includes("substrat") ||
    value.includes("erde") ||
    value.includes("ph-regulator")
  ) {
    return BeakerIcon;
  }

  if (
    value.includes("bewaesser") ||
    value.includes("bewässer") ||
    value.includes("wasser") ||
    value.includes("osmose") ||
    value.includes("autopot")
  ) {
    return CloudIcon;
  }

  if (
    value.includes("luftbefeucht") ||
    value.includes("luftentfeucht") ||
    value.includes("luft") ||
    value.includes("klima")
  ) {
    return CloudIcon;
  }

  if (
    value.includes("ventilator") ||
    value.includes("rohrventilator")
  ) {
    return ArrowPathIcon;
  }

  if (
    value.includes("schlauch") ||
    value.includes("kanal") ||
    value.includes("duct")
  ) {
    return ArrowsRightLeftIcon;
  }

  if (
    value.includes("zelt") ||
    value.includes("growbox")
  ) {
    return HomeModernIcon;
  }

  if (value.includes("licht") || value.includes("led") || value.includes("lampe")) {
    return LightBulbIcon;
  }

  if (
    value.includes("anzucht") ||
    value.includes("samen") ||
    value.includes("seed") ||
    value.includes("headshop")
  ) {
    return SparklesIcon;
  }

  if (value.includes("set") || value.includes("bundle")) {
    return Squares2X2Icon;
  }

  if (value.includes("zubehoer") || value.includes("zubehör") || value.includes("tool")) {
    return WrenchScrewdriverIcon;
  }

  if (value.includes("sonne")) {
    return SunIcon;
  }

  return BoltIcon;
}
