// 图层与数据源配置：新增模型或检测框只需在这里登记。

export const CESIUM_BASE_URL = "vendor/cesium/";

export const models = [
  { key: "DHF", label: "DHF", url: "data/DHF/tileset.json", defaultVisible: true },
  { key: "thermal", label: "Thermal", url: "data/thermal/tileset.json", defaultVisible: true },
  { key: "LiDAR", label: "LiDAR", url: "data/LiDAR/tileset.json", defaultVisible: true },
];

export const detections = [
  { key: "dam_crest", label: "坝顶裂缝", url: "data/kml/classified/crack_dam crest.kml", defaultVisible: true },
  { key: "spillway", label: "溢洪道裂缝", url: "data/kml/classified/crack_spillway.kml", defaultVisible: true },
  { key: "precipitate", label: "析出物", url: "data/kml/classified/precipitate.kml", defaultVisible: true },
];
