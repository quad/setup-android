import * as core from '@actions/core'
import * as cache from '@actions/cache'
import {ANDROID_HOME_DIR} from './constants'
import {CacheEntry, ReserveCacheError} from '@actions/cache'

const RESTORED_ENTRY_STATE_KEY = 'restoredEntry'

function generateRestoreKey(
  sdkVersion: string,
  buildToolsVersion: string,
  ndkVersion: string,
  cmakeVersion: string,
  cacheKey: string
): string {
  if (cacheKey) return cacheKey
  return `${sdkVersion}-${buildToolsVersion}-${ndkVersion}-${cmakeVersion}-v3.2`
}

export async function restoreCache(
  sdkVersion: string,
  buildToolsVersion: string,
  ndkVersion: string,
  cmakeVersion: string,
  cacheKey: string
): Promise<CacheEntry | undefined> {
  const restoreKey = generateRestoreKey(
    sdkVersion,
    buildToolsVersion,
    ndkVersion,
    cmakeVersion,
    cacheKey
  )

  const restoredEntry = await cache.restoreCache([ANDROID_HOME_DIR], restoreKey)
  if (restoredEntry) {
    core.info(`Found in cache: ${restoreKey}`)
  } else {
    core.info(`Not Found cache: ${restoreKey}`)
  }
  core.saveState(RESTORED_ENTRY_STATE_KEY, restoredEntry)
  return Promise.resolve(restoredEntry)
}

export async function saveCache(
  sdkVersion: string,
  buildToolsVersion: string,
  ndkVersion: string,
  cmakeVersion: string,
  cacheKey: string
): Promise<CacheEntry | undefined> {
  const restoreKey = generateRestoreKey(
    sdkVersion,
    buildToolsVersion,
    ndkVersion,
    cmakeVersion,
    cacheKey
  )

  core.info(`caching "${restoreKey}" ...`)
  try {
    const savedEntry = await cache.saveCache([ANDROID_HOME_DIR], restoreKey)
    return Promise.resolve(savedEntry)
  } catch (error) {
    // 同じKeyで登録してもOK
    if (error instanceof ReserveCacheError) {
      core.info(error.message)
    }
  }
}

export function getRestoredEntry(): CacheEntry | undefined {
  const restoredEntryJson = core.getState(RESTORED_ENTRY_STATE_KEY)
  if (restoredEntryJson) {
    return JSON.parse(restoredEntryJson)
  }
}
