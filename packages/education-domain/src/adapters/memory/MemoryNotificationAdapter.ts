
import { INotificationService, Notification, SendNotificationInput } from '../../ports';

export class MemoryNotificationAdapter implements INotificationService {
  private notifications: Map<string, Notification> = new Map();

  async send(input: SendNotificationInput): Promise<Notification> {
    const id = crypto.randomUUID();
    const notification: Notification = {
      id,
      userId: input.userId,
      type: input.type,
      title: input.title,
      message: input.message,
      isRead: false,
      createdAt: new Date(),
    };
    this.notifications.set(id, notification);
    return notification;
  }

  async getNotifications(userId: string): Promise<Notification[]> {
    return Array.from(this.notifications.values()).filter(n => n.userId === userId);
  }

  async markAsRead(notificationId: string): Promise<Notification> {
    const notification = this.notifications.get(notificationId);
    if (!notification) throw new Error('Notification not found');
    notification.isRead = true;
    this.notifications.set(notificationId, notification);
    return notification;
  }

  async markAllAsRead(userId: string): Promise<void> {
    for (const [id, notification] of this.notifications) {
      if (notification.userId === userId) {
        notification.isRead = true;
        this.notifications.set(id, notification);
      }
    }
  }
}
