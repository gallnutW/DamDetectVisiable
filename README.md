# DasVisable - Cesium 模型查看器

这个项目用 Cesium 可视化 `DHF`、`thermal` 和 `LiDAR` 三个 3D Tiles 模型，并加载 KML 检测框。

## 目录结构

```text
DasVisable/
├─ run.py                   # 启动入口，调用 server.serve.main()
├─ README.md
├─ .gitignore
├─ server/
│  ├─ __init__.py
│  └─ serve.py              # HTTP 静态服务，服务 web/ 并把 /data 映射到 data/
├─ web/
│  ├─ index.html            # 页面结构，外链 CSS 与 JS
│  ├─ css/
│  │  └─ main.css           # 页面样式
│  ├─ js/
│  │  ├─ app.js             # UI 生成、事件绑定与启动编排
│  │  ├─ config.js          # 图层与数据源配置（新增图层只改这里）
│  │  ├─ viewer.js          # Cesium 初始化与相机工具
│  │  ├─ models.js          # 3D Tiles 加载与显隐
│  │  └─ detections.js      # KML 检测框加载与显隐
│  └─ vendor/
│     └─ cesium/            # 本地化 Cesium 库
└─ data/
   ├─ DHF/                  # DHF 3D Tiles
   ├─ thermal/              # Thermal 3D Tiles
   ├─ LiDAR/                # LiDAR 点云 3D Tiles
   └─ kml/
      ├─ classified/        # 坝顶裂缝、溢洪道裂缝、析出物检测框
      └─ backup/            # KML 备份
```

`server/serve.py` 只把 `web/` 作为静态根目录暴露，并将 `/data/*` 请求映射到项目根下的 `data/` 目录；浏览器端通过 `config.js` 中的相对 URL 加载模型和检测框。

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
