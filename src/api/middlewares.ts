import { defineMiddlewares } from "@medusajs/framework/http"
import multer from "multer"

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
})

export default defineMiddlewares({
  routes: [
    {
      method: ["POST"],
      matcher: "/store/orders/:id/payment-proof",
      middlewares: [upload.single("file")],
    },
  ],
})
