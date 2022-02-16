import * as cache from '@actions/cache'
import * as core from '@actions/core'
import * as exec from '@actions/exec'
import * as fs from 'fs'
import * as path from 'path'
import * as toolCache from '@actions/tool-cache'
import {
  ANDROID_HOME_DIR,
  ANDROID_SDK_ROOT,
  COMMANDLINE_TOOLS_LINUX_URL,
  COMMANDLINE_TOOLS_MAC_URL,
  COMMANDLINE_TOOLS_WINDOWS_URL
} from './constants'
import {ReserveCacheError} from '@actions/cache'

export async function getAndroidSdk(
  sdkVersion: string,
  buildToolsVersion: string,
  ndkVersion: string,
  cmakeVersion: string,
  isUseCache: boolean
): Promise<void> {
  const restoreKey = `${sdkVersion}-${buildToolsVersion}-${ndkVersion}-${cmakeVersion}-0`

  if (isUseCache) {
    const matchedKey = await cache.restoreCache([ANDROID_HOME_DIR], restoreKey)
    if (matchedKey) {
      core.info(`Found in cache`)
      return Promise.resolve()
    }
  }

  // download sdk-tools
  core.info(`downloading cmdline-tools ...`)
  fs.mkdirSync(ANDROID_HOME_DIR, {recursive: true})

  let cmdlineToolsDownloadUrl: string
  switch (process.platform) {
    case 'win32':
      cmdlineToolsDownloadUrl = COMMANDLINE_TOOLS_WINDOWS_URL
      break
    case 'darwin':
      cmdlineToolsDownloadUrl = COMMANDLINE_TOOLS_MAC_URL
      break
    case 'linux':
      cmdlineToolsDownloadUrl = COMMANDLINE_TOOLS_LINUX_URL
      break
    default:
      throw Error(`Unsupported platform: ${process.platform}`)
  }
  const downloadedCmdlineToolsPath = await toolCache.downloadTool(
    cmdlineToolsDownloadUrl
  )
  const extractedCmdlineToolPath = await toolCache.extractZip(
    downloadedCmdlineToolsPath
  )
  core.info(`downloaded cmdline-tools`)

  // install android sdk
  core.info(`installing ...`)
  const sdkManagerBin = path.join(
    extractedCmdlineToolPath,
    'cmdline-tools',
    'bin'
  )
  core.addPath(sdkManagerBin)

  await exec.exec(
    'sdkmanager',
    [`--licenses`, `--sdk_root=${ANDROID_SDK_ROOT}`],
    {
      input: Buffer.from(Array(10).fill('y').join('\n'), 'utf8')
    }
  )

  const taskList = []
  taskList.push(
    exec.exec(
      'sdkmanager',
      [`build-tools;${buildToolsVersion}`, `--sdk_root=${ANDROID_SDK_ROOT}`],
      {
        silent: true
      }
    )
  )
  taskList.push(
    exec.exec(
      'sdkmanager',
      [`platform-tools`, `--sdk_root=${ANDROID_SDK_ROOT}`],
      {
        silent: true
      }
    )
  )
  taskList.push(
    exec.exec(
      'sdkmanager',
      [`platforms;android-${sdkVersion}`, `--sdk_root=${ANDROID_SDK_ROOT}`],
      {
        silent: true
      }
    )
  )
  if (ndkVersion) {
    taskList.push(
      exec.exec(
        'sdkmanager',
        [`ndk;${ndkVersion}`, `--sdk_root=${ANDROID_SDK_ROOT}`],
        {
          silent: true
        }
      )
    )
  }
  if (cmakeVersion) {
    taskList.push(
      exec.exec(
        'sdkmanager',
        [`cmake;${cmakeVersion}`, `--sdk_root=${ANDROID_SDK_ROOT}`],
        {
          silent: true
        }
      )
    )
  }
  await Promise.all(taskList)
  core.info(`installed`)

  // add cache
  core.info(`caching ...`)
  try {
    await cache.saveCache([ANDROID_HOME_DIR], restoreKey)
  } catch (error) {
    // 同じKeyで登録してもOK
    if (error instanceof ReserveCacheError) {
      core.info(error.message)
    }
  }
  core.info(`cached`)
}
