import { Module } from "@medusajs/framework/utils";
import OrderRoutingModuleService from "./service";

export const ORDER_ROUTING_MODULE = "order_routing";

export default Module(ORDER_ROUTING_MODULE, {
  service: OrderRoutingModuleService,
});
