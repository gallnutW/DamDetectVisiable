# DasVisable - Cesium 模型查看器

这个项目用 Cesium 可视化 `DHF`、`thermal` 和 `LiDAR` 三个 3D Tiles 模型，并加载 KML 检测框。

## 目录结构

- `web/`：前端页面、样式、脚本，以及本地化的 Cesium 库
- `server/`：本地 HTTP 静态服务
- `data/`：3D Tiles 与 KML 数据集
- `run.py`：启动入口

## 启动

在本目录运行：

```powershell
python run.py
```

然后打开 <http://127.0.0.1:8000>。

也可以指定端口或允许局域网访问：

```powershell
python run.py --port 8080
python run.py --host 0.0.0.0 --port 8080
```

## 功能

- 三个模型可以单独显示，也可以同时勾选显示
- 三类检测框（坝顶裂缝、溢洪道裂缝、析出物）可以独立开关
- “检测框”主开关可以统一显示或隐藏全部检测框

## 数据说明

- `data/DHF/tileset.json`
- `data/thermal/tileset.json`
- `data/LiDAR/tileset.json`
- `data/kml/classified/*.kml`

Cesium 库已本地化在 `web/vendor/cesium/`，页面不依赖外网。
