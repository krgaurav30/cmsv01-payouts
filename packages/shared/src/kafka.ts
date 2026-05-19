import { Kafka } from "kafkajs";

import type { AppConfig } from "./config.js";

export function createKafkaClient(config: AppConfig) {
  return new Kafka({
    clientId: config.kafkaClientId,
    brokers: config.kafkaBrokers,
    ...(config.kafkaSaslUsername && config.kafkaSaslPassword
      ? {
          ssl: true,
          sasl: {
            mechanism: "scram-sha-256",
            username: config.kafkaSaslUsername,
            password: config.kafkaSaslPassword
          }
        }
      : {})
  });
}
