import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  async sendPushNotification(
    pushToken: string,
    title: string,
    body: string,
    data?: object,
  ): Promise<void> {
    try {
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          to: pushToken,
          sound: 'default',
          title,
          body,
          data: data || {},
        }),
      });

      const result = await response.json();
      this.logger.log(`Push sent: ${JSON.stringify(result)}`);
    } catch (error) {
      this.logger.error(`Push failed: ${error}`);
    }
  }

  async sendToMany(pushTokens: string[], title: string, body: string, data?: object): Promise<void> {
    await Promise.all(
      pushTokens.map(token => this.sendPushNotification(token, title, body, data))
    );
  }
}