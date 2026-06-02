import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

export const planTier = pgEnum('plan_tier', ['free', 'pro']);
export const bucketType = pgEnum('bucket_type', [
  'prioridade',
  'roi_alto',
  'delega',
  'depois',
  'descarta',
]);
export const statusTriagem = pgEnum('status_triagem', [
  'pendente',
  'classificando',
  'classificada',
  'erro',
]);

export const profiles = pgTable(
  'profiles',
  {
    id: uuid('id').primaryKey(),
    email: text('email').notNull(),
    displayName: text('display_name'),
    plan: planTier('plan').notNull().default('free'),
    criteriosPersonalizados: jsonb('criterios_personalizados'),
    onboardingCompleted: boolean('onboarding_completed').notNull().default(false),
    stripeCustomerId: text('stripe_customer_id').unique(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    stripeCustomerIdx: index('idx_profiles_stripe_customer').on(table.stripeCustomerId),
  }),
);

export const triagens = pgTable(
  'triagens',
  {
    id: uuid('id').primaryKey().default(sql`uuid_generate_v4()`),
    userId: uuid('user_id').notNull(),
    textoBruto: text('texto_bruto'),
    imagemUrl: text('imagem_url'),
    status: statusTriagem('status').notNull().default('pendente'),
    tokensInput: integer('tokens_input').notNull().default(0),
    tokensOutput: integer('tokens_output').notNull().default(0),
    custoEstimadoUsd: numeric('custo_estimado_usd', { precision: 10, scale: 6 })
      .notNull()
      .default('0'),
    modeloUsado: text('modelo_usado'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    classifiedAt: timestamp('classified_at', { withTimezone: true }),
  },
  (table) => ({
    userCreatedIdx: index('idx_triagens_user_created').on(table.userId, table.createdAt),
  }),
);

export const itens = pgTable(
  'itens',
  {
    id: uuid('id').primaryKey().default(sql`uuid_generate_v4()`),
    triagemId: uuid('triagem_id')
      .notNull()
      .references(() => triagens.id, { onDelete: 'cascade' }),
    texto: text('texto').notNull(),
    bucket: bucketType('bucket').notNull(),
    justificativa: text('justificativa').notNull(),
    posicao: integer('posicao').notNull().default(0),
    concluido: boolean('concluido').notNull().default(false),
    concluidoAt: timestamp('concluido_at', { withTimezone: true }),
    gatilhoRetorno: jsonb('gatilho_retorno'),
    delegacao: jsonb('delegacao'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    triagemIdx: index('idx_itens_triagem').on(table.triagemId),
    bucketIdx: index('idx_itens_bucket').on(table.triagemId, table.bucket, table.posicao),
  }),
);

export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;
export type Triagem = typeof triagens.$inferSelect;
export type NewTriagem = typeof triagens.$inferInsert;
export type Item = typeof itens.$inferSelect;
export type NewItem = typeof itens.$inferInsert;
