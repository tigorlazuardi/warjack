import { db, type Jobs } from '@warjack/database'
import { sql } from 'kysely'

export type WorkerStatus = 'idle' | 'busy' | 'dead'

export interface WorkerConfig {
  workerId: string
  lockTimeout?: number // milliseconds, default 30000
  heartbeatInterval?: number // milliseconds, default 5000
  pollInterval?: number // milliseconds, default 1000
}

export type JobHandler = (job: Jobs) => Promise<void>

/**
 * Worker Service
 * Handles processing jobs from topics with exclusive topic locking
 */
export class WorkerService {
  private workerId: string
  private lockTimeout: number
  private heartbeatInterval: number
  private pollInterval: number
  private currentTopic: string | null = null
  private running: boolean = false
  private heartbeatTimer: Timer | null = null
  private jobHandler: JobHandler | null = null

  constructor(config: WorkerConfig) {
    this.workerId = config.workerId
    this.lockTimeout = config.lockTimeout ?? 30000
    this.heartbeatInterval = config.heartbeatInterval ?? 5000
    this.pollInterval = config.pollInterval ?? 1000
  }

  /**
   * Set job handler
   */
  setJobHandler(handler: JobHandler) {
    this.jobHandler = handler
  }

  /**
   * Start worker loop
   */
  async start() {
    if (this.running) {
      throw new Error('Worker already running')
    }

    if (!this.jobHandler) {
      throw new Error('Job handler not set. Call setJobHandler() first.')
    }

    this.running = true

    // Register worker
    await this.registerWorker()

    // Start heartbeat
    this.startHeartbeat()

    console.log(`[Worker ${this.workerId}] Started`)

    // Main loop
    while (this.running) {
      try {
        // Try acquire topic lock
        const topic = await this.acquireAvailableTopic()

        if (topic) {
          console.log(`[Worker ${this.workerId}] Acquired topic: ${topic}`)
          this.currentTopic = topic

          // Process all pending jobs in this topic
          await this.processTopicJobs(topic)

          // Release lock
          await this.releaseTopicLock(topic)
          this.currentTopic = null
          console.log(`[Worker ${this.workerId}] Released topic: ${topic}`)
        } else {
          // No available topic, wait
          await Bun.sleep(this.pollInterval)
        }
      } catch (error) {
        console.error(`[Worker ${this.workerId}] Error in main loop:`, error)
        await Bun.sleep(this.pollInterval)
      }
    }
  }

  /**
   * Stop worker
   */
  async stop() {
    console.log(`[Worker ${this.workerId}] Stopping...`)
    this.running = false

    // Stop heartbeat
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }

    // Release current topic if any
    if (this.currentTopic) {
      await this.releaseTopicLock(this.currentTopic)
      this.currentTopic = null
    }

    // Unregister worker
    await this.unregisterWorker()

    console.log(`[Worker ${this.workerId}] Stopped`)
  }

  /**
   * Register worker in database
   */
  private async registerWorker() {
    const now = Date.now()

    await db
      .insertInto('workers')
      .values({
        worker_id: this.workerId,
        status: 'idle',
        last_heartbeat: now,
        created_at: now,
      })
      .onConflict((oc: any) =>
        oc.column('worker_id').doUpdateSet({
          status: 'idle',
          last_heartbeat: now,
          current_topic: null,
        })
      )
      .execute()
  }

  /**
   * Unregister worker from database
   */
  private async unregisterWorker() {
    await db
      .deleteFrom('workers')
      .where('worker_id', '=', this.workerId)
      .execute()
  }

  /**
   * Start heartbeat timer
   */
  private startHeartbeat() {
    this.heartbeatTimer = setInterval(async () => {
      try {
        const now = Date.now()

        // Update worker heartbeat
        await db
          .updateTable('workers')
          .set({
            last_heartbeat: now,
            current_topic: this.currentTopic,
            status: this.currentTopic ? 'busy' : 'idle',
          })
          .where('worker_id', '=', this.workerId)
          .execute()

        // Update topic lock heartbeat if holding a lock
        if (this.currentTopic) {
          await db
            .updateTable('topic_locks')
            .set({ heartbeat_at: now })
            .where('topic', '=', this.currentTopic)
            .where('worker_id', '=', this.workerId)
            .execute()
        }
      } catch (error) {
        console.error(`[Worker ${this.workerId}] Heartbeat error:`, error)
      }
    }, this.heartbeatInterval)
  }

  /**
   * Acquire an available topic (with lock)
   * Returns topic name if acquired, null if no topic available
   */
  private async acquireAvailableTopic(): Promise<string | null> {
    const now = Date.now()
    const staleThreshold = now - this.lockTimeout

    // Use transaction for atomic lock acquisition
    return await db.transaction().execute(async (tx: any) => {
      // Find topic with pending jobs, not locked or stale lock
      const availableTopic = await tx
        .selectFrom('jobs')
        .select('topic')
        .where('status', '=', 'pending')
        .where(
          'topic',
          'not in',
          tx
            .selectFrom('topic_locks')
            .select('topic')
            .where('heartbeat_at', '>', staleThreshold)
        )
        .orderBy('created_at', 'asc')
        .limit(1)
        .executeTakeFirst()

      if (!availableTopic) return null

      // Acquire lock (upsert)
      await tx
        .insertInto('topic_locks')
        .values({
          topic: availableTopic.topic,
          worker_id: this.workerId,
          locked_at: now,
          heartbeat_at: now,
        })
        .onConflict((oc: any) =>
          oc.column('topic').doUpdateSet({
            worker_id: this.workerId,
            locked_at: now,
            heartbeat_at: now,
          })
        )
        .execute()

      return availableTopic.topic
    })
  }

  /**
   * Process all pending jobs in a topic (FIFO)
   */
  private async processTopicJobs(topic: string) {
    while (this.running) {
      // Get next pending job in this topic (FIFO)
      const job = await db
        .selectFrom('jobs')
        .selectAll()
        .where('topic', '=', topic)
        .where('status', '=', 'pending')
        .orderBy('created_at', 'asc')
        .limit(1)
        .executeTakeFirst()

      if (!job) break // No more jobs in this topic

      console.log(`[Worker ${this.workerId}] Processing job ${job.id} from topic ${topic}`)

      // Mark as processing
      await db
        .updateTable('jobs')
        .set({
          status: 'processing',
          started_at: Date.now(),
          updated_at: Date.now(),
        })
        .where('id', '=', job.id)
        .execute()

      // Update current job in lock
      await db
        .updateTable('topic_locks')
        .set({ current_job_id: job.id })
        .where('topic', '=', topic)
        .where('worker_id', '=', this.workerId)
        .execute()

      // Process job
      try {
        // Call job handler
        if (this.jobHandler) {
          await this.jobHandler(job)
        }

        // Mark completed
        await db
          .updateTable('jobs')
          .set({
            status: 'completed',
            completed_at: Date.now(),
            updated_at: Date.now(),
          })
          .where('id', '=', job.id)
          .execute()

        console.log(`[Worker ${this.workerId}] Job ${job.id} completed`)
      } catch (error) {
        console.error(`[Worker ${this.workerId}] Job ${job.id} failed:`, error)

        // Handle failure
        const newRetryCount = (job.retry_count || 0) + 1
        const status = newRetryCount >= job.max_retries ? 'dead_letter' : 'failed'

        await db
          .updateTable('jobs')
          .set({
            status,
            retry_count: newRetryCount,
            error_message: error instanceof Error ? error.message : String(error),
            updated_at: Date.now(),
          })
          .where('id', '=', job.id)
          .execute()

        if (status === 'dead_letter') {
          console.log(`[Worker ${this.workerId}] Job ${job.id} moved to dead letter queue`)
        } else {
          console.log(`[Worker ${this.workerId}] Job ${job.id} marked as failed (retry ${newRetryCount}/${job.max_retries})`)
        }
      }
    }
  }

  /**
   * Release topic lock
   */
  private async releaseTopicLock(topic: string) {
    await db
      .deleteFrom('topic_locks')
      .where('topic', '=', topic)
      .where('worker_id', '=', this.workerId)
      .execute()
  }
}

/**
 * Create a new worker instance
 */
export function createWorker(config: WorkerConfig): WorkerService {
  return new WorkerService(config)
}
