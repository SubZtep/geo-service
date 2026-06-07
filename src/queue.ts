import PQueue from "p-queue"

const concurrency = Number(process.env.QUEUE_CONCURRENCY) || 2

console.log(`[queue] Initializing queue with concurrency: ${concurrency}`)

const queue = new PQueue({ concurrency })

export { queue }

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("[queue] SIGINT received, waiting for queue to finish...")
  await queue.onIdle()
  console.log("[queue] Queue finished, exiting")
  process.exit(0)
})

process.on("SIGTERM", async () => {
  console.log("[queue] SIGTERM received, waiting for queue to finish...")
  await queue.onIdle()
  console.log("[queue] Queue finished, exiting")
  process.exit(0)
})
