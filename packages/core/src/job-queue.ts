import { db, type Jobs } from "@warjack/database";

export type JobStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "dead_letter";

export interface EnqueueJobParams {
  topic: string;
  payload: any;
  maxRetries?: number;
}

export interface JobResult {
  id: number;
  topic: string;
  status: JobStatus;
  createdAt: number;
}

/**
 * JobQueue Service
 * Handles enqueueing jobs to topics
 */
export class JobQueueService {
  /**
   * Enqueue a new job to a topic
   */
  async enqueue(params: EnqueueJobParams): Promise<JobResult> {
    const now = Date.now();

    const result = await db
      .insertInto("jobs")
      .values({
        topic: params.topic,
        payload: JSON.stringify(params.payload),
        status: "pending",
        max_retries: params.maxRetries ?? 3,
        created_at: now,
        updated_at: now,
      })
      .returning(["id", "topic", "status", "created_at"])
      .executeTakeFirstOrThrow();

    return {
      id: result.id,
      topic: result.topic,
      status: result.status as JobStatus,
      createdAt: result.created_at,
    };
  }

  /**
   * Get jobs by topic
   */
  async getJobsByTopic(topic: string, status?: JobStatus): Promise<Jobs[]> {
    return db
      .selectFrom("jobs")
      .selectAll()
      .where("topic", "=", topic)
      .$if(!!status, (qb) => qb.where("status", "=", status!))
      .orderBy("created_at", "asc")
      .execute();
  }

  /**
   * Get all topics with pending jobs
   */
  async getTopicsWithPendingJobs(): Promise<string[]> {
    const results = await db
      .selectFrom("jobs")
      .select("topic")
      .distinct()
      .where("status", "=", "pending")
      .execute();

    return results.map((r: { topic: string }) => r.topic);
  }

  /**
   * Get job statistics by topic
   */
  async getTopicStats(topic?: string) {
    let query = db
      .selectFrom("jobs")
      .select("topic")
      .select("status")
      .select((eb: any) => eb.fn.count("id").as("count"));

    if (topic) {
      query = query.where("topic", "=", topic);
    }

    const results = await query.groupBy(["topic", "status"]).execute();

    // Group by topic
    const statsByTopic: Record<string, Record<string, number>> = {};

    for (const row of results) {
      if (!statsByTopic[row.topic]) {
        statsByTopic[row.topic] = {};
      }
      const status = row.status as string;
      const count = row.count as number | string;
      statsByTopic[row.topic]![status] = Number(count);
    }

    return statsByTopic;
  }
}

// Export singleton instance
export const jobQueue = new JobQueueService();
