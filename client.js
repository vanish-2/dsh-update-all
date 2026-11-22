/**
 * Browser half of the update-all bundle: the **Updates** tab of the Plugins page.
 *
 * It reads the profile's bundles through the Host's `pluginManager` Remote, asks every registry-installed bundle for
 * the versions newer than the installed one, and replaces one plugin or all of them through the same Host operation
 * the page's own update dialog uses (`updateBundle`). Nothing here decides installability: a version is offered only
 * when the Host lists it, declares a bundle, accepts the running DSH, and is neither deprecated nor a prerelease.
 *
 * The run lives in a store beside the tab, not in its React state: the page unmounts a contributed tab whenever
 * another tab is selected, and a batch that stops halfway through would leave the profile in a state the user never
 * asked for. The tab is only a view of that store.
 */
window.__ModuleLoader__.load({
  id: 'dsh-update-all',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useEffect, useRef, useSyncExternalStore } = React

    /** Locale namespace owned by this plugin. */
    const NS = 'updateAll'

    /** This package, which never updates itself while it renders the tab. */
    const SELF = 'dsh-update-all'

    /**
     * How many plugin checks run at once. Each check already runs up to `versionLookupConcurrency` (4) registry reads
     * inside the Host, and every one of those is a pnpm process, so this multiplies: 3 keeps a six-plugin check near
     * two seconds without putting a dozen pnpm processes on the machine.
     */
    const CHECK_CONCURRENCY = 3

    /** Simplified Chinese dictionary and key source of truth. */
    const zh = {
      tab: '更新',
      updateAll: '一键更新全部',
      updateAllCount: '一键更新全部（{count}）',
      update: '更新',
      rowUpdate: '更新 {name}',
      cancel: '取消',
      recheck: '重新检查',
      reading: '正在读取插件…',
      checking: '正在检查更新…',
      checkingProgress: '正在检查更新（{done}/{total}）…',
      checkingOne: '检查中…',
      checkFailed: '检查失败',
      latest: '已是最新版本',
      toUpdate: '可更新到 {version}',
      blocked: '新版本需要更新 DSH',
      blockedDetail: '{version} 需要 {peers}，当前 DSH 为 {runtime}',
      disabledTag: '已停用',
      available: '{count} 个插件可以更新',
      allLatest: '所有插件均为最新版本',
      checksFailed: '{count} 个插件检查失败',
      nothing: '没有从 registry 安装的插件，无需更新。',
      loadFailed: '读取插件列表失败：{reason}',
      checkedAt: '上次检查于 {time}',
      summaryRunning: '正在更新 {done}/{total}…',
      summaryDone: '更新完成：成功 {ok}，需重启 {restart}，失败 {fail}',
      cancelledSuffix: '已取消，其余插件未更新',
      updating: '正在更新…',
      updated: '已更新至 {version}',
      restart: '已更新至 {version}，重启 DSH 后生效',
      overridden: '已更新至 {version}，但被更高优先级的配置覆盖',
      updateRefused: '目标版本被拒绝：{reason}',
      updateLost: '无法确认更新结果，请重新检查',
      updateRemoveFailed: '卸载已安装版本失败：{reason}',
      updateKept: '更新失败，已保留原版本：{reason}',
      updateRestored: '更新失败，已恢复 {version}：{reason}',
      updateBroken: '更新失败，且原版本未能恢复',
      updateCancelled: '更新已取消',
      unknownReason: '未知错误',
    }

    /** English dictionary; mirrors every key of `zh`. */
    const en = {
      tab: 'Updates',
      updateAll: 'Update all',
      updateAllCount: 'Update all ({count})',
      update: 'Update',
      rowUpdate: 'Update {name}',
      cancel: 'Cancel',
      recheck: 'Check again',
      reading: 'Reading plugins…',
      checking: 'Checking for updates…',
      checkingProgress: 'Checking for updates ({done}/{total})…',
      checkingOne: 'Checking…',
      checkFailed: 'Check failed',
      latest: 'Up to date',
      toUpdate: 'Update to {version}',
      blocked: 'A newer version needs a newer DSH',
      blockedDetail: '{version} requires {peers}; this DSH is {runtime}',
      disabledTag: 'Disabled',
      available: '{count} plugins can be updated',
      allLatest: 'All plugins are up to date',
      checksFailed: '{count} plugins could not be checked',
      nothing: 'No plugin installed from a registry can be updated.',
      loadFailed: 'Could not read the plugin list: {reason}',
      checkedAt: 'Last checked {time}',
      summaryRunning: 'Updating {done}/{total}…',
      summaryDone: 'Done — updated: {ok}, restart needed: {restart}, failed: {fail}',
      cancelledSuffix: 'cancelled; the remaining plugins were not updated',
      updating: 'Updating…',
      updated: 'Updated to {version}',
      restart: 'Updated to {version}; restart DSH to apply',
      overridden: 'Updated to {version}, but a higher-priority configuration overrides it',
      updateRefused: 'Target version refused: {reason}',
      updateLost: 'The update result is unknown; check again',
      updateRemoveFailed: 'Removing the installed version failed: {reason}',
      updateKept: 'Update failed; the installed version stayed: {reason}',
      updateRestored: 'Update failed; {version} was reinstalled: {reason}',
      updateBroken: 'Update failed and the installed version could not be reinstalled',
      updateCancelled: 'Update cancelled',
      unknownReason: 'Unknown error',
    }

    /** Component-local styles; every color is a theme token, with a literal fallback for skins that omit one. */
    const CSS = `
.dshua-root { display: flex; flex-direction: column; gap: 10px; padding: 4px 0 8px; color: var(--dsw-alias-label-primary); }
.dshua-actionbar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.dshua-actionbar .dshua-status { flex: 1 1 160px; text-align: right; }
.dshua-btn { height: 32px; padding: 0 13px; border-radius: var(--dsw-radius-sm, 8px); border: 1px solid var(--dsw-alias-border-l2); background: transparent; color: var(--dsw-alias-label-primary); font: inherit; font-size: 13px; line-height: 1; cursor: pointer; transition: background-color 120ms ease, opacity 120ms ease; }
.dshua-btn:hover:not([aria-disabled="true"]) { background: var(--dsw-alias-bg-layer-2); }
.dshua-btn:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 2px; }
.dshua-btn[aria-disabled="true"] { opacity: .45; cursor: default; }
.dshua-primary { border-color: transparent; background: var(--dsw-alias-button-primary-fill, var(--dsw-alias-brand-primary)); color: var(--dsw-alias-label-primary-inverted, #fff); font-weight: 500; }
.dshua-primary:hover:not([aria-disabled="true"]) { background: var(--dsw-alias-button-primary-hover, var(--dsw-alias-brand-primary)); opacity: .92; }
.dshua-status { min-height: 18px; font-size: 12px; line-height: 1.5; color: var(--dsw-alias-label-secondary); }
.dshua-status[data-tone="error"] { color: var(--dsw-alias-state-error-primary); }
.dshua-status[data-tone="warn"] { color: var(--dsw-alias-state-warn-primary); }
.dshua-status[data-tone="success"] { color: var(--dsw-alias-state-success-primary); }
.dshua-list { list-style: none; margin: 2px 0 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.dshua-row { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border: 1px solid var(--dsw-alias-border-l1); border-radius: var(--dsw-radius-md, 10px); background: var(--dsw-alias-bg-layer-1); }
.dshua-rowmain { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.dshua-titlerow { display: flex; align-items: center; gap: 6px; min-width: 0; }
.dshua-name { font-size: 13px; font-weight: 500; line-height: 1.4; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dshua-tag { flex: 0 0 auto; padding: 0 5px; height: 16px; display: inline-flex; align-items: center; border: 1px solid var(--dsw-alias-border-l2); border-radius: 4px; font-size: 10px; line-height: 1; color: var(--dsw-alias-label-secondary); }
.dshua-pkg { font-size: 11px; line-height: 1.4; color: var(--dsw-alias-label-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dshua-versions { flex: 0 0 auto; font-size: 12px; font-variant-numeric: tabular-nums; color: var(--dsw-alias-label-secondary); white-space: nowrap; }
.dshua-versions b { color: var(--dsw-alias-brand-primary); font-weight: 500; }
.dshua-statusline { flex: 0 1 200px; min-width: 0; font-size: 12px; line-height: 1.4; text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dshua-statusline[data-tone="brand"] { color: var(--dsw-alias-brand-primary); }
.dshua-statusline[data-tone="success"] { color: var(--dsw-alias-state-success-primary); }
.dshua-statusline[data-tone="warn"] { color: var(--dsw-alias-state-warn-primary); }
.dshua-statusline[data-tone="error"] { color: var(--dsw-alias-state-error-primary); }
.dshua-statusline[data-tone="muted"], .dshua-statusline[data-tone="idle"] { color: var(--dsw-alias-label-secondary); }
.dshua-rowbutton { flex: 0 0 auto; }
.dshua-empty { padding: 18px 2px; font-size: 13px; color: var(--dsw-alias-label-secondary); }
@media (max-width: 640px) {
  .dshua-row { flex-wrap: wrap; }
  .dshua-statusline { flex-basis: 100%; text-align: left; }
}
`

    /** The tone of a row's status line, from its outcome or check state. */
    const TONES = {
      updating: 'idle', done: 'success', restart: 'warn', overridden: 'warn', failed: 'error', broken: 'error',
    }

    /** The newest version the Host can install in place of the installed one, as the page's own `updateCandidate`. */
    function newerCandidate(list) {
      if (!list || list.status !== 'listed') return undefined
      return list.versions.find(version => version.bundle && version.incompatible === undefined
        && version.deprecated === undefined && !version.prerelease)
    }

    /** The first newer version the running DSH refuses, which explains why nothing can be installed. */
    function blockedVersion(list) {
      if (!list || list.status !== 'listed') return undefined
      return list.versions.find(version => !version.prerelease && version.incompatible !== undefined)
    }

    /** The DSH requirements a refused version states, as one phrase: `engines.dsh` or DSH peer ranges. */
    function peersText(incompatible) {
      const requirements = (incompatible && incompatible.requirements) || {}
      const parts = Object.entries(requirements).map(([name, range]) => `${name} ${String(range)}`)
      return parts.length > 0 ? parts.join(', ') : '—'
    }

    /** A request id for one update, so the Host can name its progress, its cancellation, and its logs. */
    function newRequestId() {
      const crypto = window.crypto
      if (crypto && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
      return `update-all-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
    }

    /** The last segment of a package name, for the row's title. */
    function shortName(name) {
      const slash = name.lastIndexOf('/')
      return slash === -1 ? name : name.slice(slash + 1)
    }

    /**
     * Await one Remote call. A rejected promise means the answer was lost, which is not the same as a refusal: the
     * Host may have finished the work.
     */
    async function settle(promise) {
      try {
        return await promise
      } catch (error) {
        return { ok: false, lost: true, error: { message: String((error && error.message) || error) } }
      }
    }

    /** The transport's or the Host's words for a refused Remote call. */
    function refusedText(answer) {
      const error = answer && answer.error
      if (!error) return undefined
      return error.message ? String(error.message) : error.code ? String(error.code) : undefined
    }

    /** The Host's reason for a refused change: its diagnostic when it has one, else the error code. */
    function changeReason(change) {
      const error = change && change.error
      if (!error) return undefined
      if (error.diagnostic) return String(error.diagnostic)
      return error.code ? String(error.code) : undefined
    }

    /**
     * How one update ended, as locale keys the render translates. A failed installation after the removal names what
     * the Host reinstalled, because an outcome where nothing is installed must not read like a kept version.
     * @param {object} update - the Host's `PluginUpdateResult`.
     * @returns {{status: string, code: string, params?: object}} the row outcome.
     */
    function outcomeOf(update) {
      const reason = changeReason(update.result)
      if (update.step === 'check') return { status: 'failed', code: 'updateRefused', params: { reason } }
      if (update.step === 'remove') return { status: 'failed', code: 'updateRemoveFailed', params: { reason } }
      const application = update.result && update.result.application
      if (application === 'applied') return { status: 'done', code: 'updated', params: { version: update.to } }
      if (application === 'restart-required') return { status: 'restart', code: 'restart', params: { version: update.to } }
      if (application === 'overridden') return { status: 'overridden', code: 'overridden', params: { version: update.to } }
      if (application === 'cancelled') return { status: 'failed', code: 'updateCancelled' }
      if (!update.restore) return { status: 'failed', code: 'updateKept', params: { reason } }
      const restored = update.restore.application
      if (restored === 'failed' || restored === 'cancelled') return { status: 'broken', code: 'updateBroken' }
      return { status: 'failed', code: 'updateRestored', params: { version: update.from, reason } }
    }

    /** The local time of day a check arrived, as `HH:MM`. */
    function clock(timestamp) {
      const time = new Date(timestamp)
      return `${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}`
    }

    /** Run `worker` over `items` with at most `limit` in flight, settling when every item is done. */
    async function mapLimit(items, limit, worker) {
      let next = 0
      const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (next < items.length) {
          const index = next
          next += 1
          await worker(items[index], index)
        }
      })
      await Promise.all(runners)
    }

    /**
     * The run, kept outside the tab so a batch survives the tab being switched away and a returning tab reads the
     * same state. Every field is published as one snapshot; the render derives all text in the active locale.
     * @param {() => object} manager - reads the Host's `pluginManager` namespace at call time.
     * @returns {object} the store: `subscribe`, `getSnapshot`, `start`, `load`, `checkAll`, `run`, `cancel`.
     */
    function createUpdates(manager) {
      let state = {
        /** `loading` until the first bundle read settles; `ready` or `error` after it. */
        phase: 'loading',
        error: '',
        /** Registry-installed bundles this plugin can replace, in short-name order. */
        packages: [],
        /** Per package: `{ status: 'listed', list }` or `{ status: 'refused', reason }`. */
        checks: {},
        /** Per package: how its update ended, kept until the next check or run. */
        results: {},
        checkedAt: 0,
        checking: false,
        checkDone: 0,
        checkTotal: 0,
        running: false,
        queueDone: 0,
        queueTotal: 0,
        /** The request id of the update in flight, which a cancellation names. */
        requestId: null,
        /** The user stopped the batch; the remaining plugins stay untouched. */
        cancelled: false,
      }
      let started = false
      const listeners = new Set()

      /** Publish one changed snapshot, then let mounted views read it. */
      const patch = (changes) => {
        state = { ...state, ...changes }
        for (const listener of [...listeners]) listener()
      }

      /** Read the bundles the Host can replace from a registry. */
      const load = async () => {
        const answer = await settle(manager().listBundles())
        if (!answer.ok) {
          patch({ phase: 'error', error: refusedText(answer) || '' })
          return
        }
        const packages = answer.value
          // An update removes the installed package first, so a package that cannot be removed offers none.
          .filter(bundle => bundle.name !== SELF && bundle.update === 'registry' && typeof bundle.version === 'string'
            && bundle.installed === true && bundle.removable === true && bundle.availability !== 'installation')
          .map(bundle => ({ name: bundle.name, version: bundle.version, enabled: bundle.enabled === true }))
          .sort((left, right) => shortName(left.name).localeCompare(shortName(right.name)))
        patch({ packages, phase: 'ready', error: '' })
      }

      /** Ask the Host for one package's newer versions. A refused list is a failed check, never "up to date". */
      const checkOne = async (name) => {
        const answer = await settle(manager().listVersions(name, {}))
        let check
        if (!answer.ok) {
          check = { status: 'refused', reason: refusedText(answer) }
        } else if (!answer.value || answer.value.status === 'refused') {
          check = { status: 'refused', reason: answer.value ? answer.value.reason : undefined }
        } else {
          check = { status: 'listed', list: answer.value }
        }
        patch({ checks: { ...state.checks, [name]: check } })
      }

      /** Check the registry packages a few at a time, so a large profile does not check them one by one. */
      const checkAll = async () => {
        if (state.running || state.checking) return
        const packages = state.packages
        patch({
          checking: true, checks: {}, results: {}, checkedAt: 0, checkDone: 0, checkTotal: packages.length,
          queueTotal: 0, cancelled: false,
        })
        await mapLimit(packages, CHECK_CONCURRENCY, async (pkg) => {
          await checkOne(pkg.name)
          patch({ checkDone: state.checkDone + 1 })
        })
        patch({ checking: false, checkedAt: Date.now() })
      }

      /** Replace one plugin with the version its check offered. */
      const updateOne = async (name) => {
        const check = state.checks[name]
        const candidate = newerCandidate(check && check.list)
        if (!candidate) return
        const requestId = newRequestId()
        patch({ results: { ...state.results, [name]: { status: 'updating', code: 'updating' } }, requestId })
        const answer = await settle(manager().updateBundle(name, candidate.version, {
          registry: check.list.registry,
          requestId,
        }))
        let outcome
        if (answer.ok) outcome = outcomeOf(answer.value)
        else if (answer.lost) outcome = { status: 'failed', code: 'updateLost' }
        else outcome = { status: 'failed', code: 'updateRefused', params: { reason: refusedText(answer) } }
        patch({ results: { ...state.results, [name]: outcome }, requestId: null })
        await checkOne(name)
      }

      /** Replace the named plugins one Host operation at a time; the tab may come and go meanwhile. */
      const run = async (names) => {
        const queue = names.filter(name => newerCandidate(state.checks[name] && state.checks[name].list))
        if (queue.length === 0 || state.running || state.checking) return
        patch({
          results: {}, running: true, queueDone: 0, queueTotal: queue.length, cancelled: false, requestId: null,
        })
        for (const name of queue) {
          if (state.cancelled) break
          await updateOne(name)
          patch({ queueDone: state.queueDone + 1 })
        }
        patch({ running: false, requestId: null })
        await load()
      }

      /** Stop the update in flight, which also stops the queue behind it. */
      const cancel = async () => {
        const requestId = state.requestId
        patch({ cancelled: true })
        if (requestId !== null) await settle(manager().cancelInstall(requestId))
      }

      return {
        subscribe(listener) {
          listeners.add(listener)
          return () => { listeners.delete(listener) }
        },
        getSnapshot() {
          return state
        },
        /** Read the list and check it once per session, on the first tab that mounts. */
        async start() {
          if (started) return
          started = true
          await load()
          if (state.phase === 'ready') await checkAll()
        },
        /** The recheck action: read the list again, then check it, so a failed read is recoverable in place. */
        async refresh() {
          await load()
          if (state.phase === 'ready') await checkAll()
        },
        checkAll,
        run,
        cancel,
      }
    }

    return {
      inject: ['slots', 'locale', 'remote', 'remote.pluginManager'],

      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'update-all: dictionaries')
        const t = ctx.locale.bind(NS)
        /** The Host namespace, read at call time so a replaced Remote service is not held stale. */
        const manager = () => ctx.remote.pluginManager
        const updates = createUpdates(manager)

        /**
         * The Updates tab: one row per registry-installed plugin, its newer version, and the two actions.
         * @param {object} props - the page's owner props plus the `t` seat of this namespace.
         * @returns {object} the rendered tab.
         */
        function UpdateAllTab(props) {
          const translate = typeof props.t === 'function' ? props.t : key => key
          const snapshot = useSyncExternalStore(updates.subscribe, updates.getSnapshot)
          const started = useRef(false)
          useEffect(() => {
            if (started.current) return
            started.current = true
            void updates.start()
          }, [])

          /** The text of one structured outcome, with a localized reason when the Host gave none. */
          const outcomeText = (result) => {
            const params = result.params ? { ...result.params } : undefined
            if (params !== undefined && 'reason' in params && !params.reason) params.reason = translate('unknownReason')
            return translate(result.code, params)
          }

          const busy = snapshot.running || snapshot.checking
          const candidates = snapshot.packages.filter(pkg => newerCandidate(snapshot.checks[pkg.name] && snapshot.checks[pkg.name].list))
          const count = candidates.length
          const unchecked = snapshot.packages.filter(pkg => snapshot.checks[pkg.name] && snapshot.checks[pkg.name].status === 'refused').length
          const finished = Object.values(snapshot.results).filter(result => result.status !== 'updating')
          const ok = finished.filter(result => result.status === 'done' || result.status === 'restart' || result.status === 'overridden').length
          const restart = finished.filter(result => result.status === 'restart').length
          const fail = finished.filter(result => result.status === 'failed' || result.status === 'broken').length

          /** The status line above the list: what is running, or what the last check found. */
          const summary = (() => {
            if (snapshot.phase === 'loading') return { tone: 'idle', text: translate('reading') }
            if (snapshot.phase === 'error') {
              return { tone: 'error', text: translate('loadFailed', { reason: snapshot.error || translate('unknownReason') }) }
            }
            if (snapshot.running) {
              return { tone: 'idle', text: translate('summaryRunning', { done: snapshot.queueDone, total: snapshot.queueTotal }) }
            }
            if (snapshot.queueTotal > 0) {
              const done = translate('summaryDone', { ok, restart, fail })
              return {
                tone: fail > 0 ? 'error' : 'success',
                text: snapshot.cancelled ? `${done} · ${translate('cancelledSuffix')}` : done,
              }
            }
            if (snapshot.checking) {
              return {
                tone: 'idle',
                text: snapshot.checkTotal > 0
                  ? translate('checkingProgress', { done: snapshot.checkDone, total: snapshot.checkTotal })
                  : translate('checking'),
              }
            }
            const found = count > 0 ? translate('available', { count }) : translate('allLatest')
            const failedPart = unchecked > 0 ? ` · ${translate('checksFailed', { count: unchecked })}` : ''
            const at = snapshot.checkedAt > 0 ? ` · ${translate('checkedAt', { time: clock(snapshot.checkedAt) })}` : ''
            return { tone: unchecked > 0 ? 'warn' : count > 0 ? 'brand' : 'success', text: `${found}${failedPart}${at}` }
          })()

          /** One row: the plugin, its versions, how it stands, and its own update action. */
          const row = (pkg) => {
            const check = snapshot.checks[pkg.name]
            const result = snapshot.results[pkg.name]
            const candidate = newerCandidate(check && check.list)
            const blocked = blockedVersion(check && check.list)
            let tone
            let text
            if (result !== undefined) {
              tone = TONES[result.status] || 'idle'
              text = outcomeText(result)
            } else if (check === undefined) {
              tone = 'idle'
              text = translate('checkingOne')
            } else if (check.status === 'refused') {
              tone = 'error'
              text = `${translate('checkFailed')} · ${check.reason || translate('unknownReason')}`
            } else if (candidate !== undefined) {
              tone = 'brand'
              text = translate('toUpdate', { version: candidate.version })
            } else if (blocked !== undefined) {
              tone = 'warn'
              text = `${translate('blocked')} · ${translate('blockedDetail', {
                version: blocked.version,
                peers: peersText(blocked.incompatible),
                runtime: blocked.incompatible.runtimeVersion,
              })}`
            } else {
              tone = 'muted'
              text = translate('latest')
            }
            return h('li', { key: pkg.name, className: 'dshua-row' },
              h('div', { className: 'dshua-rowmain' },
                h('div', { className: 'dshua-titlerow' },
                  h('span', { className: 'dshua-name', title: pkg.name }, shortName(pkg.name)),
                  pkg.enabled ? null : h('span', { className: 'dshua-tag' }, translate('disabledTag'))),
                h('span', { className: 'dshua-pkg' }, pkg.name)),
              h('span', { className: 'dshua-versions' },
                pkg.version,
                candidate ? h('b', { key: 'to' }, ` → ${candidate.version}`) : null),
              h('span', { className: 'dshua-statusline', 'data-tone': tone, title: text }, text),
              candidate === undefined
                ? null
                : h('button', {
                  type: 'button',
                  className: 'dshua-btn dshua-rowbutton',
                  'aria-label': translate('rowUpdate', { name: shortName(pkg.name) }),
                  'aria-disabled': busy ? 'true' : undefined,
                  onClick: () => { if (!busy) void updates.run([pkg.name]) },
                }, translate('update')))
          }

          return h('section', { className: 'dshua-root', 'aria-busy': busy ? 'true' : 'false' },
            h('style', null, CSS),
            h('div', { className: 'dshua-actionbar' },
              h('button', {
                type: 'button',
                className: 'dshua-btn',
                'aria-disabled': busy || snapshot.phase === 'loading' ? 'true' : undefined,
                onClick: () => { if (!busy && snapshot.phase !== 'loading') void updates.refresh() },
              }, translate('recheck')),
              h('button', {
                type: 'button',
                className: 'dshua-btn dshua-primary',
                'aria-disabled': busy || count === 0 ? 'true' : undefined,
                onClick: () => { if (!busy && count > 0) void updates.run(snapshot.packages.map(pkg => pkg.name)) },
              }, snapshot.running
                ? translate('updating')
                : count > 0 ? translate('updateAllCount', { count }) : translate('updateAll')),
              snapshot.running
                ? h('button', {
                  type: 'button',
                  className: 'dshua-btn',
                  'aria-disabled': snapshot.cancelled ? 'true' : undefined,
                  onClick: () => { if (!snapshot.cancelled) void updates.cancel() },
                }, translate('cancel'))
                : null,
              h('div', { className: 'dshua-status', 'data-tone': summary.tone, role: 'status', 'aria-live': 'polite' }, summary.text)),
            snapshot.phase === 'ready' && snapshot.packages.length === 0
              ? h('p', { className: 'dshua-empty' }, translate('nothing'))
              : h('ul', { className: 'dshua-list' }, snapshot.packages.map(row)))
        }

        ctx.slots.inject('plugins.tab', () => ctx.slots.register({
          name: 'plugins.tab',
          id: 'update-all',
          order: 20,
          label: () => t('tab'),
          locale: NS,
        }, UpdateAllTab))
      },
    }
  },
})
