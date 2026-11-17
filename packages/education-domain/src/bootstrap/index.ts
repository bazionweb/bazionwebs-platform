
import {
  IDatabase,
  IKVStore,
  IQueue,
  ISecretsManager,
  IRateLimiter,
  IWriteQueue,
  ILogger,
  ITracer,
  IIdentityProvider,
  ILMSProvider,
  IEmailProvider,
  IPaymentProvider,
  IDocumentGenerator,
  INotificationService,
  IStorage,
} from '../ports';

import {
  D1DatabaseAdapter,
  PostgresDatabaseAdapter,
  CloudflareKVAdapter,
  CloudflareQueueAdapter,
  CloudflareRateLimiterAdapter,
  CloudflareWriteQueueAdapter,
  EnvironmentSecretsAdapter,
  CloudflareLoggerAdapter,
  CloudflareTracerAdapter,
  ResendEmailAdapter,
  CloudflareR2StorageAdapter,
  MemoryDatabaseAdapter,
  MemoryKVAdapter,
  InMemoryQueueAdapter,
  MemoryRateLimiterAdapter,
  MemoryWriteQueueAdapter,
  MemorySecretsAdapter,
  MemoryIdentityAdapter,
  MemoryLMSAdapter,
  MemoryEmailAdapter,
  MemoryPaymentAdapter,
  MemoryDocumentAdapter,
  MemoryNotificationAdapter,
  MemoryStorageAdapter,
  StripeAdapter,
  PaystackAdapter,
  PdfDocumentAdapter,
  D1IdentityAdapter,
} from '../adapters';

export interface PlatformContext {
  db: IDatabase;
  kv: IKVStore;
  queue: IQueue;
  secrets: ISecretsManager;
  rateLimiter: IRateLimiter;
  writeQueue: IWriteQueue;
  logger: ILogger;
  tracer: ITracer;
  identity: IIdentityProvider;
  lms: ILMSProvider;
  email: IEmailProvider;
  payment: IPaymentProvider;
  document: IDocumentGenerator;
  notification: INotificationService;
  storage: IStorage;
  shutdown?: () => Promise<void>;
}

export function bootstrap(env: any): PlatformContext {
  const provider = env.PLATFORM_PROVIDER || 'cloudflare';
  switch (provider) {
    case 'cloudflare':
      return buildCloudflare(env);
    case 'local':
      return buildLocal(env);
    default:
      throw new Error(`Unknown provider: ${provider}. Only 'cloudflare' and 'local' are supported.`);
  }
}

function unimplemented<T extends object>(portName: string): T {
  return new Proxy({} as T, {
    get(_t, prop) {
      throw new Error(
        `[bootstrap] ${portName}.${String(prop)}() called, but no real adapter is ` +
        `configured for the 'cloudflare' provider. Wire a real adapter or explicitly ` +
        `handle this as "not yet available" in the caller.`
      );
    },
  });
}

function buildCloudflare(env: any): PlatformContext {
  const tracer = new CloudflareTracerAdapter();
  
  // Email provider: use Resend if API key is available, else memory
  const emailProvider = env.RESEND_API_KEY 
    ? new ResendEmailAdapter(env.RESEND_API_KEY)
    : new MemoryEmailAdapter();
    
  // Storage provider: use R2 if bucket is available, else memory
  const storageProvider = env.DOCUMENTS
    ? new CloudflareR2StorageAdapter(env.DOCUMENTS, env.R2_PUBLIC_URL || 'https://pub-documents.bmiuniversities.org')
    : new MemoryStorageAdapter();

  const rateLimiter = env.RATE_LIMITER
    ? new CloudflareRateLimiterAdapter(env.RATE_LIMITER)
    : new MemoryRateLimiterAdapter();

  const writeQueue = env.WRITE_QUEUE
    ? new CloudflareWriteQueueAdapter(env.WRITE_QUEUE)
    : new MemoryWriteQueueAdapter();

  const paymentProvider = env.PAYSTACK_SECRET_KEY
    ? new PaystackAdapter(env.PAYSTACK_SECRET_KEY, { webhookSecret: env.PAYSTACK_WEBHOOK_SECRET })
    : env.STRIPE_SECRET_KEY
      ? new StripeAdapter(env.STRIPE_SECRET_KEY, env.STRIPE_WEBHOOK_SECRET)
      : unimplemented<IPaymentProvider>('payment');

  // Database: prefer Neon (Postgres) when a connection string is configured,
  // otherwise fall back to D1 during the strangler-fig migration phase.
  const candidates = [
    env.DATABASE_URL_CORE,
    env.DATABASE_URL,
    env.CORE_HYPERDRIVE?.connectionString,
    env.HYPERDRIVE?.connectionString,
  ];

  let coreConnectionUrl: string | undefined;
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim().length > 0) {
      coreConnectionUrl = c.trim();
      break;
    }
  }

  const dbAdapter = coreConnectionUrl
    ? new PostgresDatabaseAdapter(coreConnectionUrl)
    : new D1DatabaseAdapter(env.DB);
  return {
    db: dbAdapter,
    kv: new CloudflareKVAdapter(env.KV),
    queue: new CloudflareQueueAdapter(env.EMAIL_QUEUE || env.QUEUE),
    rateLimiter,
    writeQueue,
    secrets: new EnvironmentSecretsAdapter(env),
    logger: new CloudflareLoggerAdapter(tracer.getRequestId()),
    tracer,
    identity: new D1IdentityAdapter(dbAdapter),
    lms: unimplemented<ILMSProvider>('lms'),
    email: emailProvider,
    payment: paymentProvider,
    document: new PdfDocumentAdapter(),
    notification: unimplemented<INotificationService>('notification'),
    storage: storageProvider,
  };
}

function buildLocal(_env: any): PlatformContext {
  const tracer = new CloudflareTracerAdapter();
  return {
    db: new MemoryDatabaseAdapter(),
    kv: new MemoryKVAdapter(),
    queue: new InMemoryQueueAdapter(),
    rateLimiter: new MemoryRateLimiterAdapter(),
    writeQueue: new MemoryWriteQueueAdapter(),
    secrets: new MemorySecretsAdapter(_env),
    logger: new CloudflareLoggerAdapter(tracer.getRequestId()),
    tracer,
    identity: new MemoryIdentityAdapter(),
    lms: new MemoryLMSAdapter(),
    email: new MemoryEmailAdapter(),
    payment: new MemoryPaymentAdapter(),
    document: new MemoryDocumentAdapter(),
    notification: new MemoryNotificationAdapter(),
    storage: new MemoryStorageAdapter(),
  };
}


