import { Injectable, Logger } from '@nestjs/common';

export interface PushSound {
  channelId: string;
  sound: string;
}

// Канал и звук создаются в courier-app (utils/notifications.ts, assets/sounds/new_order.wav)
export const COURIER_NEW_ORDER_SOUND: PushSound = {
  channelId: 'new-orders',
  sound: 'new_order.wav',
};

const DEFAULT_SOUND: PushSound = { channelId: 'orders', sound: 'default' };

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  async sendPushNotification(
    pushToken: string,
    title: string,
    body: string,
    data?: object,
    pushSound: PushSound = DEFAULT_SOUND,
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
          sound: pushSound.sound,
          title,
          body,
          data: data || {},
          channelId: pushSound.channelId,
          priority: 'high',
        }),
      });

      const result = await response.json();
      this.logger.log(`Push sent: ${JSON.stringify(result)}`);
    } catch (error) {
      this.logger.error(`Push failed: ${error}`);
    }
  }

  async sendToMany(
    pushTokens: string[],
    title: string,
    body: string,
    data?: object,
    pushSound?: PushSound,
  ): Promise<void> {
    await Promise.all(
      pushTokens.map(token => this.sendPushNotification(token, title, body, data, pushSound))
    );
  }
}
