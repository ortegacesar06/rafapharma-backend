import OrderModule from "@medusajs/medusa/order";
import OrderRoutingModule from "../modules/order-routing";
import { defineLink } from "@medusajs/framework/utils";

export default defineLink(
  OrderModule.linkable.order,
  OrderRoutingModule.linkable.orderRouting
);
