# DasVisable - Cesium 模型查看器

这个页面用 Cesium 可视化 `DHF` 和 `thermal` 两个 3D Tiles 模型。两个模型可以单独显示，也可以同时勾选显示。
同时加载 `812kml/classified/` 下的检测框 KML 文件，并把三类检测框拆成独立开关：

- 坝顶裂缝
- 溢洪道裂缝
- 析出物

每类可以单独显示或隐藏，也可以勾选多类同时显示；“检测框”主开关可以统一显示或隐藏全部检测框。

## 启动

在本目录运行：

```powershell
python server.py
```

然后打开 <http://127.0.0.1:8000>。

也可以指定端口或允许局域网访问：

```powershell
python server.py --port 8080
python server.py --host 0.0.0.0 --port 8080
```

## 数据说明

- `DHF/tileset.json`
- `thermal/tileset.json`
- `812kml/classified/*.kml`

Cesium 库已本地化在 `cesium/Build/Cesium/`，页面不依赖外网。
