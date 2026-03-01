import test from 'node:test'
import assert from 'node:assert/strict'
import { buildVideoOutputOptions, resolveVideoProfile } from './video-profiles'

test('resolveVideoProfile returns different CRF for different modes', () => {
  const maxQuality = resolveVideoProfile('1080p', 'max_quality')
  const minSize = resolveVideoProfile('1080p', 'min_size')

  assert.ok(maxQuality.crf < minSize.crf)
  assert.equal(maxQuality.width, 1920)
  assert.equal(minSize.height, 1080)
})

test('buildVideoOutputOptions picks faster NVENC preset for min-size mode', () => {
  const maxQuality = resolveVideoProfile('1080p', 'max_quality')
  const minSize = resolveVideoProfile('1080p', 'min_size')

  const maxQualityOptions = buildVideoOutputOptions('h264_nvenc', maxQuality)
  const minSizeOptions = buildVideoOutputOptions('h264_nvenc', minSize)

  assert.ok(maxQualityOptions.includes('p4'))
  assert.ok(minSizeOptions.includes('p1'))
})

test('buildVideoOutputOptions uses libx264 fallback with stillimage tuning', () => {
  const profile = resolveVideoProfile('720p', 'min_size')
  const options = buildVideoOutputOptions('libx264', profile)

  assert.ok(options.includes('libx264'))
  assert.ok(options.includes('stillimage'))
})

test('resolveVideoProfile localizes mode label for English', () => {
  const profile = resolveVideoProfile('1080p', 'max_quality', 'en')
  assert.equal(profile.modeLabel, 'mode: max quality')
})
