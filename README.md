# dsh-update-all

Adds an **Updates** tab to the DSH Plugins page. It checks the newest installable version of every plugin installed from npm and replaces them all on request, reporting whether each change applies now or waits for a restart.

Only registry-installed bundles appear; Git, local-path, tarball and built-in bundles have no version list to check.

---

## 中文

在「插件」页面增加「更新」标签页：检查每个从 npm 安装的插件是否有可安装的新版本，并按需全部替换，同时说明是立即生效还是需要重启 DSH。

只列出来自 registry 的插件；Git、本地路径、压缩包和内置插件没有可检查的版本列表。
