import { Kafka } from "kafkajs";

import type { AppConfig } from "./config.js";

export function createKafkaClient(config: AppConfig) {
  return new Kafka({
    clientId: config.kafkaClientId,
    brokers: config.kafkaBrokers
  });
}
