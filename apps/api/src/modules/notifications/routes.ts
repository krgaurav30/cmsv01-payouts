import type { FastifyPluginAsync } from "fastify";

import { markNotificationReadSchema } from "./contracts.js";
import { NotificationsService } from "./service.js";

export const notificationsRoutes: FastifyPluginAsync = async (app) => {
  const notificationsService = new NotificationsService();

  app.get("/v1/notifications", async (request) => {
    const query = request.query as { recipientUserId?: string };

    return {
      items: query.recipientUserId
        ? await notificationsService.listNotifications(query.recipientUserId)
        : []
    };
  });

  app.post("/v1/notifications/:notificationId/read", async (request, reply) => {
    const params = request.params as { notificationId: string };
    const parsed = markNotificationReadSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        message: "Invalid notification read payload",
        issues: parsed.error.flatten()
      });
    }

    const notification = await notificationsService.markNotificationRead(
      params.notificationId,
      parsed.data
    );

    if (!notification) {
      return reply.status(404).send({
        message: "Notification not found"
      });
    }

    return notification;
  });

  app.post("/v1/notifications/read-all", async (request, reply) => {
    const parsed = markNotificationReadSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        message: "Invalid notification read payload",
        issues: parsed.error.flatten()
      });
    }

    await notificationsService.markAllRead(parsed.data.actedByUserId);
    return reply.status(204).send();
  });
};
