declare module "node-telegram-bot-api" {
  import type { EventEmitter } from "events";

  export interface ConstructorOptions {
    polling?: boolean;
  }

  export default class TelegramBot extends EventEmitter {
    constructor(token: string, options?: ConstructorOptions);
    sendMessage(
      chatId: string | number,
      text: string,
      options?: Record<string, unknown>
    ): Promise<unknown>;
  }
}

