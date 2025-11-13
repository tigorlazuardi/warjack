import { jobQueue, createWorker, type Jobs } from './packages/core/src/index'

// Simple job handler for testing
const jobHandler = async (job: Jobs) => {
  const payload = JSON.parse(job.payload)
  console.log(`Processing job ${job.id}:`, payload)

  // Simulate work
  await Bun.sleep(100)

  console.log(`Job ${job.id} completed`)
}

// Test script
async function test() {
  console.log('=== Testing Job Queue System ===\n')

  // 1. Enqueue some jobs
  console.log('1. Enqueueing jobs...')

  await jobQueue.enqueue({
    topic: 'email',
    payload: { to: 'user1@example.com', subject: 'Hello' }
  })

  await jobQueue.enqueue({
    topic: 'email',
    payload: { to: 'user2@example.com', subject: 'World' }
  })

  await jobQueue.enqueue({
    topic: 'sms',
    payload: { to: '+1234567890', message: 'Test SMS' }
  })

  console.log('Jobs enqueued!\n')

  // 2. Check topics
  console.log('2. Checking topics...')
  const stats = await jobQueue.getTopicStats()
  console.log('Topic stats:', JSON.stringify(stats, null, 2))

  const pendingTopics = await jobQueue.getTopicsWithPendingJobs()
  console.log('Pending topics:', pendingTopics)
  console.log()

  // 3. Start worker
  console.log('3. Starting worker...')
  const worker = createWorker({
    workerId: 'test-worker-1',
    lockTimeout: 30000,
    heartbeatInterval: 5000,
    pollInterval: 500,
  })

  worker.setJobHandler(jobHandler)

  // Start worker in background
  const workerPromise = worker.start()

  // Wait for jobs to be processed
  await Bun.sleep(3000)

  // 4. Check final stats
  console.log('\n4. Final stats...')
  const finalStats = await jobQueue.getTopicStats()
  console.log('Final topic stats:', JSON.stringify(finalStats, null, 2))

  // Stop worker
  console.log('\n5. Stopping worker...')
  await worker.stop()

  console.log('\n=== Test Complete ===')
  process.exit(0)
}

test().catch((error) => {
  console.error('Test failed:', error)
  process.exit(1)
})
