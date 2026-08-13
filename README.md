# DasVisable - Cesium 模型查看器

这个页面用 Cesium 可视化 `DHF` 和 `thermal` 两个 3D Tiles 模型，并允许用户在二者之间切换。
同时加载 `812kml/classified/` 下的检测框 KML 文件，检测框默认显示，也可以在页面左上角取消勾选来隐藏。

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
