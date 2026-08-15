import { zoomToTilesets } from "./viewer.js";

export function createModelManager(viewer, definitions, setStatus) {
  const tilesets = new Map();
  const visibility = new Map();

  definitions.forEach(function (definition) {
    visibility.set(definition.key, definition.defaultVisible);
  });

  function visibleDefinitions() {
    return definitions.filter(function (definition) {
      return visibility.get(definition.key);
    });
  }

  function visibleTilesets() {
    return visibleDefinitions()
      .map(function (definition) {
        return tilesets.get(definition.key);
      })
      .filter(Boolean);
  }

  function refreshView() {
    zoomToTilesets(viewer, visibleTilesets());
    const labels = visibleDefinitions().map(function (definition) {
      return definition.label;
    });
    setStatus(labels.length ? `当前显示：${labels.join(" + ")}` : "当前未选择模型");
  }

  async function loadTileset(definition) {
    setStatus(`正在加载 ${definition.label} 模型...`);
    try {
      const tileset = await Cesium.Cesium3DTileset.fromUrl(definition.url, {
        maximumScreenSpaceError: 16,
        cacheBytes: 1024 * 1024 * 1024,
      });

      tileset.show = visibility.get(definition.key);
      viewer.scene.primitives.add(tileset);
      tilesets.set(definition.key, tileset);
      return tileset;
    } catch (error) {
      console.error(`加载 ${definition.label} 失败:`, error);
      setStatus(`${definition.label} 加载失败，请检查服务是否已启动`, true);
      return null;
    }
  }

  function setVisible(key, visible) {
    visibility.set(key, visible);
    const tileset = tilesets.get(key);
    if (tileset) {
      tileset.show = visible;
    }
    refreshView();
  }

  async function loadAll() {
    const results = await Promise.all(
      definitions.map(function (definition) {
        return loadTileset(definition);
      }),
    );

    if (results.some(Boolean)) {
      refreshView();
    } else {
      setStatus("部分模型加载失败，请检查控制台日志", true);
    }

    return results;
  }

  function getTileset(key) {
    return tilesets.get(key);
  }

  return { loadAll, setVisible, refreshView, getTileset };
}
