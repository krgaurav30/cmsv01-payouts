import { z } from "zod";

const configSchema = z.object({
  APP_NAME: z.string().default("CMS Banking Platform"),
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  KAFKA_CLIENT_ID: z.string().default("banking-platform"),
  KAFKA_BROKERS: z.string().default("localhost:9092"),
  KAFKA_OUTBOX_TOPIC: z.string().default("cmsv01.domain-events"),
  DATABASE_URL: z.string().min(1),
  DATABASE_MAX_CONNECTIONS: z.coerce.number().int().positive().default(3),
  BENEFICIARY_PUBLISH_API_KEY: z.string().default("bank-alpha-dev-key"),
  JWT_SECRET: z.string().optional(),
  JWT_TOKEN_EXPIRY_SECONDS: z.coerce.number().int().positive().default(3600),
  KAFKA_SASL_USERNAME: z.string().optional(),
  KAFKA_SASL_PASSWORD: z.string().optional(),
  DB_SSL_REJECT_UNAUTHORIZED: z.enum(["true", "false"]).optional()
});

export type AppConfig = {
  appName: string;
  port: number;
  nodeEnv: "development" | "test" | "production";
  kafkaClientId: string;
  kafkaBrokers: string[];
  kafkaOutboxTopic: string;
  databaseUrl: string;
  databaseMaxConnections: number;
  beneficiaryPublishApiKey: string;
  jwtSecret: string;
  jwtTokenExpirySeconds: number;
  kafkaSaslUsername?: string;
  kafkaSaslPassword?: string;
  dbSslRejectUnauthorized: boolean;
};

export function loadConfig(): AppConfig {
  const env = configSchema.parse(process.env);

  const dbSslRejectUnauthorized = env.DB_SSL_REJECT_UNAUTHORIZED
    ? env.DB_SSL_REJECT_UNAUTHORIZED === "true"
    : env.NODE_ENV === "production";

  return {
    appName: env.APP_NAME,
    port: env.PORT,
    nodeEnv: env.NODE_ENV,
    kafkaClientId: env.KAFKA_CLIENT_ID,
    kafkaBrokers: env.KAFKA_BROKERS.split(",").map((broker) => broker.trim()),
    kafkaOutboxTopic: env.KAFKA_OUTBOX_TOPIC,
    databaseUrl: env.DATABASE_URL,
    databaseMaxConnections: env.DATABASE_MAX_CONNECTIONS,
    beneficiaryPublishApiKey: env.BENEFICIARY_PUBLISH_API_KEY,
    jwtSecret: resolveJwtSecret(env.JWT_SECRET, env.NODE_ENV),
    jwtTokenExpirySeconds: env.JWT_TOKEN_EXPIRY_SECONDS,
    kafkaSaslUsername: env.KAFKA_SASL_USERNAME,
    kafkaSaslPassword: env.KAFKA_SASL_PASSWORD,
    dbSslRejectUnauthorized
  };
}

/**
 * Resolves the JWT signing secret. In production, a proper secret MUST be provided.
 * In development/test, a deterministic dev-only fallback is used for convenience.
 */
function resolveJwtSecret(envSecret: string | undefined, nodeEnv: string): string {
  if (envSecret && envSecret.length >= 32) {
    return envSecret;
  }

  if (nodeEnv === "production") {
    throw new Error(
      "FATAL: JWT_SECRET environment variable is missing or too short (minimum 32 chars). " +
      "A strong signing secret is required in production. Generate one with: openssl rand -hex 32"
    );
  }

  // Development-only fallback — never used in production
  return "cmsv01-dev-only-jwt-secret-do-not-use-in-prod";
}

