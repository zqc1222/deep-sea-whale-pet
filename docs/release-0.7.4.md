# 深海鲸灵 0.7.4

## 本次更新：补齐运行时图标

- 修复 Windows 系统托盘隐藏图标面板中，深海鲸灵图标显示为空白的问题。
- 将 `icon-v3.png` 作为运行时资源随安装版与便携版一起打包。
- Electron 窗口和系统托盘统一使用“鲸尾 + 珍珠 + 声呐环”图标。
- 保留内置 SVG 作为资源缺失时的兜底，不影响开发环境启动。

## 内容指纹

`resources/app.asar` 的 SHA-256 前 12 位：

```text
3F8F4F1759F0
```

该指纹只能说明当前 `app.asar` 内容是否与本 Release 公布值一致，不能验证发布者身份。当前项目未配置商业 Authenticode 证书，Windows SmartScreen 仍可能显示“未知发布者”。

## 安装说明

- 安装版：运行 `DeepSeaWhalePet-Setup-0.7.4-x64.exe`，可选择安装目录。
- 便携版：直接运行 `DeepSeaWhalePet-Portable-0.7.4-x64.exe`。

这是原创非官方同人概念原型，与 DeepSeek 官方无隶属、授权或背书关系。
