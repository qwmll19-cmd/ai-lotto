import { request } from './client.js'

export function fetchOpsSummary() {
  return request('/ops/summary')
}

export function fetchOpsMetrics() {
  return request('/ops/metrics')
}

export function fetchHealth() {
  return request('/health')
}
