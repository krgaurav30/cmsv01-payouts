import { z } from "zod";

const configSchema = z.object({
  APP_NAME: z.string().default("CMS Banking Platform"),
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  KAFKA_CLIENT_ID: z.string().default("banking-platform"),
  KAFKA_BROKERS: z.string().default("localhost:9092"),
  KAFKA_OUTBOX_TOPIC: z.string().default("cmsv01.domain-events"),
  DATABASE_URL: z.string().min(1),
  BENEFICIARY_PUBLISH_API_KEY: z.string().default("bank-alpha-dev-key")
});

export type AppConfig = {
  appName: string;
  port: number;
  nodeEnv: "development" | "test" | "production";
  kafkaClientId: string;
  kafkaBrokers: string[];
  kafkaOutboxTopic: string;
  databaseUrl: string;
  beneficiaryPublishApiKey: string;
};

export function loadConfig(): AppConfig {
  const env = configSchema.parse(process.env);

  return {
    appName: env.APP_NAME,
    port: env.PORT,
    nodeEnv: env.NODE_ENV,
    kafkaClientId: env.KAFKA_CLIENT_ID,
    kafkaBrokers: env.KAFKA_BROKERS.split(",").map((broker) => broker.trim()),
    kafkaOutboxTopic: env.KAFKA_OUTBOX_TOPIC,
    databaseUrl: env.DATABASE_URL,
    beneficiaryPublishApiKey: env.BENEFICIARY_PUBLISH_API_KEY
  };
}
