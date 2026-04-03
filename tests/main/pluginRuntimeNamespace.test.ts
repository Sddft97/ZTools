import { describe, expect, it } from 'vitest'
import {
  DEV_PLUGIN_SUFFIX,
  isDevelopmentPluginName,
  toDevPluginName,
  fromDevPluginName,
  getPluginDataPrefix,
  getPluginDocId,
  getPluginSessionPartition,
  getPluginZBrowserPartition,
  getDetachedWindowSizeKey
} from '../../src/shared/pluginRuntimeNamespace'

describe('pluginRuntimeNamespace', () => {
  it('DEV_PLUGIN_SUFFIX is __dev', () => {
    expect(DEV_PLUGIN_SUFFIX).toBe('__dev')
  })

  it('isDevelopmentPluginName correctly identifies dev plugins', () => {
    expect(isDevelopmentPluginName('demo__dev')).toBe(true)
    expect(isDevelopmentPluginName('demo')).toBe(false)
    expect(isDevelopmentPluginName('demo__development')).toBe(false)
    expect(isDevelopmentPluginName('__dev')).toBe(true) // ends with __dev suffix
  })

  it('toDevPluginName adds __dev suffix', () => {
    expect(toDevPluginName('demo')).toBe('demo__dev')
    expect(toDevPluginName('my-plugin')).toBe('my-plugin__dev')
    // not idempotent: always appends suffix
    expect(toDevPluginName('demo__dev')).toBe('demo__dev__dev')
  })

  it('fromDevPluginName removes __dev suffix', () => {
    expect(fromDevPluginName('demo__dev')).toBe('demo')
    expect(fromDevPluginName('demo')).toBe('demo')
  })

  it('getPluginDataPrefix returns correct LMDB prefix', () => {
    expect(getPluginDataPrefix('demo')).toBe('PLUGIN/demo/')
    expect(getPluginDataPrefix('demo__dev')).toBe('PLUGIN/demo__dev/')
  })

  it('getPluginDocId returns correct doc ID', () => {
    expect(getPluginDocId('demo', 'settings')).toBe('PLUGIN/demo/settings')
    expect(getPluginDocId('demo__dev', 'settings')).toBe('PLUGIN/demo__dev/settings')
  })

  it('getPluginSessionPartition uses pluginName directly', () => {
    expect(getPluginSessionPartition('demo')).toBe('persist:demo')
    expect(getPluginSessionPartition('demo__dev')).toBe('persist:demo__dev')
  })

  it('getPluginZBrowserPartition uses pluginName directly', () => {
    expect(getPluginZBrowserPartition('demo')).toBe('demo.zbrowser')
    expect(getPluginZBrowserPartition('demo__dev')).toBe('demo__dev.zbrowser')
  })

  it('getDetachedWindowSizeKey returns pluginName directly', () => {
    expect(getDetachedWindowSizeKey('demo')).toBe('demo')
    expect(getDetachedWindowSizeKey('demo__dev')).toBe('demo__dev')
  })
})
