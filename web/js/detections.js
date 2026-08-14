export function createDetectionManager(viewer, definitions, setStatus) {
  const dataSources = new Map();
  const visibility = new Map();

  definitions.forEach(function (definition) {
    visibility.set(definition.key, definition.defaultVisible);
  });

  function addAbsoluteAltitudeMode(xmlDoc) {
    const kmlNamespace = "http://www.opengis.net/kml/2.2";
    const polygons = xmlDoc.getElementsByTagName("Polygon");

    for (let i = 0; i < polygons.length; i += 1) {
      const polygon = polygons[i];
      const existing = polygon.getElementsByTagName("altitudeMode")[0];
      if (existing) {
        continue;
      }

      const altitudeMode = xmlDoc.createElementNS(kmlNamespace, "altitudeMode");
      altitudeMode.textContent = "absolute";
      polygon.insertBefore(altitudeMode, polygon.firstChild);
    }
  }

  async function loadDataSource(definition) {
    const response = await fetch(encodeURI(definition.url));
    if (!response.ok) {
      throw new Error(`${definition.label} 请求失败：HTTP ${response.status}`);
    }

    const xmlText = await response.text();
    const xmlDoc = new DOMParser().parseFromString(xmlText, "application/xml");
    const parserErrors = xmlDoc.getElementsByTagName("parsererror");
    if (parserErrors.length > 0) {
      throw new Error(`${definition.label} KML 解析失败`);
    }

    addAbsoluteAltitudeMode(xmlDoc);

    const dataSource = await Cesium.KmlDataSource.load(xmlDoc, {
      camera: viewer.scene.camera,
      canvas: viewer.scene.canvas,
      clampToGround: false,
    });

    dataSource.show = visibility.get(definition.key);
    viewer.dataSources.add(dataSource);
    dataSources.set(definition.key, dataSource);
    return dataSource;
  }

  function setVisible(key, visible) {
    visibility.set(key, visible);
    const dataSource = dataSources.get(key);
    if (dataSource) {
      dataSource.show = visible;
    }
    viewer.scene.requestRender();
  }

  function setAllVisible(visible) {
    definitions.forEach(function (definition) {
      setVisible(definition.key, visible);
    });
  }

  function allVisible() {
    return definitions.every(function (definition) {
      return visibility.get(definition.key);
    });
  }

  async function loadAll() {
    const results = await Promise.all(
      definitions.map(function (definition) {
        return loadDataSource(definition);
      }),
    );
    console.info(`已加载 ${results.length} 个检测框 KML 数据源`);
    return results;
  }

  return { loadAll, setVisible, setAllVisible, allVisible };
}
