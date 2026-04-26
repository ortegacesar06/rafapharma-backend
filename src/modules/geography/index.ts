import { Module } from "@medusajs/framework/utils";
import GeographyModuleService from "./service";

export const GEOGRAPHY_MODULE = "geography";

export default Module(GEOGRAPHY_MODULE, {
  service: GeographyModuleService,
});
