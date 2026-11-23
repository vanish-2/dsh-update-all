# dsh-update-all

Adds an **Updates** tab to the DSH Plugins page that updates every plugin installed from npm in one click.

## Install

```sh
dsh plugin add github:vanish-2/dsh-update-all
```

In the Web app, paste `github:vanish-2/dsh-update-all` into **Plugins → Add plugin** (or `git+https://github.com/vanish-2/dsh-update-all.git`).

## Use

**Plugins → Updates → Update all.** A row's own **Update** replaces just that plugin.

Only registry-installed bundles are listed; Git, local-path, tarball and built-in bundles have no version list. Each update runs the Host's own `updateBundle`, so a failure keeps the installed version, or says so when it could not be reinstalled.

---

## 中文

在「插件」页面增加「更新」标签页，一键更新从 npm 安装的插件。

**安装**：`dsh plugin add github:vanish-2/dsh-update-all`，或在「插件 → 添加插件」里填 `github:vanish-2/dsh-update-all`。

**使用**：打开「插件」→「更新」→「一键更新全部」；单行的「更新」只替换一个插件。

只列出来自 registry 的插件，Git / 本地路径 / 压缩包 / 内置插件没有版本列表。更新走 Host 的 `updateBundle`，失败时保留原版本；无法装回时会明确说明。
