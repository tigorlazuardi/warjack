import * as S from "sury";

export const ConfigSchema = S.schema({
  server: S.optional(
    S.schema({
      host: S.optional(S.string, process.env.WARJACK_SERVER_HOST || "0.0.0.0"),
      port: S.optional(
        S.int32,
        parseInt(process.env.WARJACK_SERVER_PORT || "3000"),
      ),
    }),
    {
      host: "0.0.0.0",
      port: 3000,
    },
  ),
  concurrency: S.optional(
    S.schema({
      worker: S.optional(S.int32, 4),
      downloads: S.optional(S.int32, 4),
    }),
    {
      worker: 4,
      downloads: 4,
    },
  ),
});

export type Config = S.Infer<typeof ConfigSchema>;
