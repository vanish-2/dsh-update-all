# Update all plugins

English | [中文](#中文)

One click replaces every plugin that the profile installed from an npm registry with its newest installable version.

## Install

In the DSH Web **Plugins → Add plugin** field, or from a shell:

```sh
dsh plugin add github:vanish-2/dsh-update-all
```

The same string works as `git+https://github.com/vanish-2/dsh-update-all.git`. It needs a Web or Desktop profile,
which serves the `pluginManager` Host Remotes this tab calls; nothing else is required and there is no configuration.

## Use it

1. Open **Plugins** in the sidebar.
2. Select the **Updates** tab. It reads the profile's bundles and checks each registry-installed plugin once.
3. Press **Update all (n)** to replace all of them, or **Update** on one row to replace only that plugin.

The status line reports the run as it goes and ends with how many plugins updated, how many need a DSH restart, and
how many failed. A failed row keeps the reason the Host reported. One outcome is worse than a failure and is named
separately: if the target installation fails and the Host cannot reinstall the version it removed, that row says the
plugin is not installed, and the plugin then has to be installed again from its own page. Press **Cancel** during a
run to stop the update in flight and the plugins still queued after it.

## How a version is chosen

For each plugin, the tab asks the Host for the versions published after the installed one and offers the newest one
that declares a bundle, accepts the running DSH version, and is neither deprecated nor a prerelease. When newer
versions exist but all of them need a newer DSH, the row says so instead of offering an update. A plugin installed
from Git, a local path, or a tarball, and a bundle shipped with DSH, has no version list and is not listed.

## What it changes, and what it does not

Each replacement runs the Host's own `updateBundle` operation, which the Plugins page's update dialog also uses: it
removes the installed version, installs the target, and reinstalls the removed version when the target fails. Changes
apply immediately on a profile with HMR and report `restart-required` without it. The plugin does not touch your
configuration, does not install anything you did not already have installed, and offers no versions the Host calls
incompatible. Plugins added or removed elsewhere appear after you press **Check again**.

---

## 中文

一键把 profile 中从 npm registry 安装的插件替换为各自可安装的最新版本。

### 安装

在 DSH Web 的「插件 → 添加插件」里填下面这行，或者在命令行执行：

```sh
dsh plugin add github:vanish-2/dsh-update-all
```

也可以写成 `git+https://github.com/vanish-2/dsh-update-all.git`。需要 Web 或 Desktop profile（它调用的是 Host 的
`pluginManager` Remote）；除此之外不需要任何配置。

### 用法

1. 打开侧边栏的「插件」。
2. 切到「更新」标签页，它会读取 profile 的插件包并逐个检查 registry 上的新版本。
3. 点「一键更新全部（n）」全部替换，或点某一行的「更新」只替换该插件。

状态行会随更新进度变化，结束时说明成功几个、几个需要重启 DSH、几个失败。失败的那一行会保留 Host 给出的原因。
有一种比失败更糟的结果会单独标出：目标版本安装失败、且 Host 无法装回它卸载掉的版本时，该行会说明插件已不再安装，
需要到它自己的页面重新安装。更新过程中可以点「取消」，停止正在进行的更新，排在后面的插件不再更新。

### 版本如何挑选

对每个插件，该页向 Host 询问比已安装版本更新的版本，并给出其中最新的、声明了 bundle、接受当前 DSH 版本、且不是
deprecated 或 prerelease 的那一个。如果存在新版本但都要求更高的 DSH，该行会说明这一点而不是提供更新。通过 Git、
本地路径或压缩包安装的插件，以及 DSH 自带的插件没有版本列表，不会出现在这里。

### 会改什么、不会改什么

每次替换都走 Host 的 `updateBundle`，与「插件」页面自己的更新对话框是同一个操作：卸载已安装版本、安装目标版本，
目标失败时再装回被卸载的版本。有 HMR 的 profile 立即生效，没有 HMR 的会报告 `restart-required`。该插件不会改动你的
配置、不会安装你原本没有安装的包，也不会提供 Host 判定为不兼容的版本。在别处增删的插件，点「重新检查」后才会反映出来。
