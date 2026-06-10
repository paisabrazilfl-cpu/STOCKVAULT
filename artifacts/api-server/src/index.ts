import { sendDeepseek } from "./lib/ai/nvidiaDeepseekClient";
import app from "./app";
import { logger } from "./lib/logger";

const port = Number(process.env["PORT"] || 10000);

// Expose sendDeepseek for app-wide use
(global as any).sendDeepseek = sendDeepseek;
app.listen(port, () => {
  logger.info({ port }, "Server listening");
});
