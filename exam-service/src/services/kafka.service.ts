import { publishEvent } from '../config/kafka';

export class KafkaService {
  async publishEvent(type: string, data: any): Promise<void> {
    await publishEvent(type, data);
  }
}