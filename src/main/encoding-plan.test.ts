import test from 'node:test'
import assert from 'node:assert/strict'
import {
  estimateInputBitrateKbps,
  estimateOutputSizeBytes,
  planAudioEncoding,
  selectAacBitrateKbps
} from './encoding-plan'

test('estimateInputBitrateKbps computes bitrate from size+duration', () => {
  const kbps = estimateInputBitrateKbps([
    { durationSec: 5006.497959, sizeBytes: 86777728 }
  ])
  assert.ok(kbps > 138 && kbps < 139)
})

test('planAudioEncoding uses copy for one mp3 source', () => {
  const plan = planAudioEncoding([
    { codec: 'mp3', durationSec: 5006.5, sizeBytes: 86777728, bitRateBps: 138664 }
  ])

  assert.equal(plan.strategy, 'copy')
  assert.match(plan.description, /Без перекодирования/)
})

test('planAudioEncoding uses AAC for multiple sources', () => {
  const plan = planAudioEncoding([
    { codec: 'mp3', durationSec: 1200, sizeBytes: 20 * 1024 * 1024 },
    { codec: 'mp3', durationSec: 1200, sizeBytes: 20 * 1024 * 1024 }
  ])

  assert.equal(plan.strategy, 'aac')
  assert.ok(typeof plan.targetBitrateKbps === 'number')
  assert.ok((plan.targetBitrateKbps || 0) >= 64)
})

test('selectAacBitrateKbps clamps to safe range and rounds to 16k grid', () => {
  assert.equal(selectAacBitrateKbps(139), 144)
  assert.equal(selectAacBitrateKbps(20), 64)
  assert.equal(selectAacBitrateKbps(500), 160)
})

test('estimateOutputSizeBytes for copy keeps size near source + overhead', () => {
  const plan = planAudioEncoding([
    { codec: 'mp3', durationSec: 5006.5, sizeBytes: 86777728, bitRateBps: 138664 }
  ])
  const estimated = estimateOutputSizeBytes(5006.5, plan, 86777728, '1080p')

  assert.ok(estimated > 90 * 1024 * 1024)
  assert.ok(estimated < 130 * 1024 * 1024)
})

test('estimateOutputSizeBytes is larger in max-quality mode than min-size mode', () => {
  const plan = planAudioEncoding([
    { codec: 'mp3', durationSec: 5006.5, sizeBytes: 86777728, bitRateBps: 138664 }
  ])
  const minSize = estimateOutputSizeBytes(5006.5, plan, 86777728, '1080p', 'min_size')
  const maxQuality = estimateOutputSizeBytes(5006.5, plan, 86777728, '1080p', 'max_quality')

  assert.ok(maxQuality > minSize)
})
