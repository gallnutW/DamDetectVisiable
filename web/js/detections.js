const KML_NAMESPACE = "http://www.opengis.net/kml/2.2";

const DEGREES_TO_RADIANS = Math.PI / 180;
const CGCS2000_SEMI_MAJOR_AXIS = 6378137.0;
const CGCS2000_INVERSE_FLATTENING = 298.257222101;
const CGCS123E_CENTRAL_MERIDIAN = 123.0;
const CGCS123E_FALSE_EASTING = 500000.0;

export function wgs84ToCgcs123E(point) {
  const flattening = 1 / CGCS2000_INVERSE_FLATTENING;
  const eccentricitySquared = flattening * (2 - flattening);
  const secondEccentricitySquared = eccentricitySquared / (1 - eccentricitySquared);
  const latitude = point.latitude * DEGREES_TO_RADIANS;
  const longitude = point.longitude * DEGREES_TO_RADIANS;
  const centralMeridian = CGCS123E_CENTRAL_MERIDIAN * DEGREES_TO_RADIANS;
  const sinLatitude = Math.sin(latitude);
  const cosLatitude = Math.cos(latitude);
  const tanLatitude = Math.tan(latitude);
  const primeVerticalRadius =
    CGCS2000_SEMI_MAJOR_AXIS /
    Math.sqrt(1 - eccentricitySquared * sinLatitude * sinLatitude);
  const tangentSquared = tanLatitude * tanLatitude;
  const cosineFactor = secondEccentricitySquared * cosLatitude * cosLatitude;
  const longitudeOffset = (longitude - centralMeridian) * cosLatitude;
  const eccentricityFourth = eccentricitySquared * eccentricitySquared;
  const eccentricitySixth = eccentricityFourth * eccentricitySquared;

  const meridianArc =
    CGCS2000_SEMI_MAJOR_AXIS *
    (
      (1 - eccentricitySquared / 4 - (3 * eccentricityFourth) / 64 - (5 * eccentricitySixth) / 256) *
        latitude -
      ((3 * eccentricitySquared) / 8 + (3 * eccentricityFourth) / 32 + (45 * eccentricitySixth) / 1024) *
        Math.sin(2 * latitude) +
      ((15 * eccentricityFourth) / 256 + (45 * eccentricitySixth) / 1024) *
        Math.sin(4 * latitude) -
      ((35 * eccentricitySixth) / 3072) * Math.sin(6 * latitude)
    );

  const longitudeOffsetSquared = longitudeOffset * longitudeOffset;
  const longitudeOffsetCubed = longitudeOffsetSquared * longitudeOffset;
  const longitudeOffsetFifth = longitudeOffsetCubed * longitudeOffsetSquared;
  const longitudeOffsetSixth = longitudeOffsetCubed * longitudeOffsetCubed;

  const easting =
    CGCS123E_FALSE_EASTING +
    primeVerticalRadius *
      (
        longitudeOffset +
        ((1 - tangentSquared + cosineFactor) * longitudeOffsetCubed) / 6 +
        (
          (5 - 18 * tangentSquared + tangentSquared * tangentSquared + 72 * cosineFactor -
            58 * secondEccentricitySquared) *
          longitudeOffsetFifth
        ) /
          120
      );

  const northing =
    meridianArc +
    primeVerticalRadius *
      tanLatitude *
      (
        longitudeOffsetSquared / 2 +
        ((5 - tangentSquared + 9 * cosineFactor + 4 * cosineFactor * cosineFactor) *
          longitudeOffsetCubed *
          longitudeOffset) /
          24 +
        (
          (61 - 58 * tangentSquared + tangentSquared * tangentSquared + 600 * cosineFactor -
            330 * secondEccentricitySquared) *
          longitudeOffsetSixth
        ) /
          720
      );

  return {
    x: easting,
    y: northing,
  };
}

function parseCoordinates(text) {
  return String(text || "")
    .trim()
    .split(/\s+/)
    .map(function (chunk) {
      const parts = chunk.split(",").map(Number);
      if (parts.length < 2 || !parts.every(Number.isFinite)) {
        return null;
      }
      return {
        longitude: parts[0],
        latitude: parts[1],
        altitude: parts[2] || 0,
      };
    })
    .filter(Boolean);
}

function uniqueRing(points) {
  const result = [];
  points.forEach(function (point) {
    const last = result[result.length - 1];
    const sameAsLast =
      last &&
      Math.abs(last.longitude - point.longitude) < 1e-10 &&
      Math.abs(last.latitude - point.latitude) < 1e-10 &&
      Math.abs(last.altitude - point.altitude) < 1e-8;

    if (!sameAsLast) {
      result.push(point);
    }
  });

  const first = result[0];
  const last = result[result.length - 1];
  if (
    result.length > 1 &&
    first &&
    last &&
    Math.abs(first.longitude - last.longitude) < 1e-10 &&
    Math.abs(first.latitude - last.latitude) < 1e-10 &&
    Math.abs(first.altitude - last.altitude) < 1e-8
  ) {
    result.pop();
  }

  return result;
}

function toCartesian(point) {
  return Cesium.Cartesian3.fromDegrees(point.longitude, point.latitude, point.altitude);
}

function toLocalPoints(points) {
  const origin = toCartesian(points[0]);
  const fixedToEnu = Cesium.Matrix4.inverseTransformation(
    Cesium.Transforms.eastNorthUpToFixedFrame(origin),
    new Cesium.Matrix4(),
  );

  return points.map(function (point) {
    return Cesium.Matrix4.multiplyByPoint(
      fixedToEnu,
      toCartesian(point),
      new Cesium.Cartesian3(),
    );
  });
}

function polygonArea(localPoints) {
  let area = 0;
  for (let i = 0; i < localPoints.length; i += 1) {
    const current = localPoints[i];
    const next = localPoints[(i + 1) % localPoints.length];
    area += current.x * next.y - next.x * current.y;
  }
  return Math.abs(area) / 2;
}

function orientedBoundingBox(localPoints) {
  if (!localPoints.length) {
    return { lengthMeters: 0, widthMeters: 0 };
  }

  let centerX = 0;
  let centerY = 0;
  localPoints.forEach(function (point) {
    centerX += point.x;
    centerY += point.y;
  });
  centerX /= localPoints.length;
  centerY /= localPoints.length;

  let varianceX = 0;
  let varianceY = 0;
  let covariance = 0;
  localPoints.forEach(function (point) {
    const dx = point.x - centerX;
    const dy = point.y - centerY;
    varianceX += dx * dx;
    varianceY += dy * dy;
    covariance += dx * dy;
  });

  const angle = 0.5 * Math.atan2(2 * covariance, varianceX - varianceY);
  const axisX = Math.cos(angle);
  const axisY = Math.sin(angle);
  const normalX = -Math.sin(angle);
  const normalY = Math.cos(angle);

  const along = localPoints.map(function (point) {
    return (point.x - centerX) * axisX + (point.y - centerY) * axisY;
  });
  const across = localPoints.map(function (point) {
    return (point.x - centerX) * normalX + (point.y - centerY) * normalY;
  });

  return {
    lengthMeters: Math.max.apply(null, along) - Math.min.apply(null, along),
    widthMeters: Math.max.apply(null, across) - Math.min.apply(null, across),
  };
}

function sequenceNumber(name) {
  const match = String(name || "").match(/(\d+)\s*$/);
  return match ? parseInt(match[1], 10) : null;
}

function averagePoint(points) {
  const total = { longitude: 0, latitude: 0, altitude: 0 };
  points.forEach(function (point) {
    total.longitude += point.longitude;
    total.latitude += point.latitude;
    total.altitude += point.altitude;
  });
  return {
    longitude: total.longitude / points.length,
    latitude: total.latitude / points.length,
    altitude: total.altitude / points.length,
  };
}

function extractFeatures(xmlDoc, definition) {
  const features = [];
  const placemarks = xmlDoc.getElementsByTagName("Placemark");

  for (let i = 0; i < placemarks.length; i += 1) {
    const placemark = placemarks[i];
    const nameNode = placemark.getElementsByTagName("name")[0];
    const coordinatesNode = placemark.getElementsByTagName("coordinates")[0];
    const name = nameNode ? nameNode.textContent.trim() : `${definition.label} ${i + 1}`;
    if (!coordinatesNode) {
      continue;
    }

    const ringPoints = parseCoordinates(coordinatesNode.textContent);
    const points = uniqueRing(ringPoints);
    if (points.length < 3) {
      continue;
    }

    const localPoints = toLocalPoints(points);
    const box = orientedBoundingBox(localPoints);
    const center = averagePoint(points);
    const id = name || `${definition.key}_${i + 1}`;

    features.push({
      id,
      key: definition.key,
      typeLabel: definition.label,
      name,
      sequenceNumber: sequenceNumber(name),
      points,
      center,
      lengthMeters: box.lengthMeters,
      widthMeters: box.widthMeters,
      areaSquareMeters: polygonArea(localPoints),
    });
  }

  features.sort(function (a, b) {
    const aSequence = a.sequenceNumber === null ? Number.MAX_SAFE_INTEGER : a.sequenceNumber;
    const bSequence = b.sequenceNumber === null ? Number.MAX_SAFE_INTEGER : b.sequenceNumber;
    if (aSequence !== bSequence) {
      return aSequence - bSequence;
    }
    return a.name.localeCompare(b.name);
  });

  return features;
}

export function createDetectionManager(viewer, definitions, setStatus) {
  const dataSources = new Map();
  const visibility = new Map();
  const featuresByKey = new Map();
  let selection = null;

  definitions.forEach(function (definition) {
    visibility.set(definition.key, definition.defaultVisible);
  });

  function addAbsoluteAltitudeMode(xmlDoc) {
    const polygons = xmlDoc.getElementsByTagName("Polygon");

    for (let i = 0; i < polygons.length; i += 1) {
      const polygon = polygons[i];
      const existing = polygon.getElementsByTagName("altitudeMode")[0];
      if (existing) {
        continue;
      }

      const altitudeMode = xmlDoc.createElementNS(KML_NAMESPACE, "altitudeMode");
      altitudeMode.textContent = "absolute";
      polygon.insertBefore(altitudeMode, polygon.firstChild);
    }
  }

  function captureEntityStyle(entity) {
    const polygon = entity.polygon;
    if (!polygon) {
      return null;
    }
    return {
      material: polygon.material,
      outline: polygon.outline,
      outlineColor: polygon.outlineColor,
      outlineWidth: polygon.outlineWidth,
    };
  }

  function restoreEntityStyle(style, entity) {
    if (!style || !entity.polygon) {
      return;
    }
    entity.polygon.material = style.material;
    entity.polygon.outline = style.outline;
    entity.polygon.outlineColor = style.outlineColor;
    entity.polygon.outlineWidth = style.outlineWidth;
  }

  function applySelectedStyle(entity) {
    if (!entity.polygon) {
      return;
    }
    entity.polygon.material = Cesium.Color.YELLOW.withAlpha(0.5);
    entity.polygon.outline = true;
    entity.polygon.outlineColor = Cesium.Color.YELLOW;
    entity.polygon.outlineWidth = 4;
  }

  function clearSelection() {
    if (!selection) {
      return;
    }
    restoreEntityStyle(selection.style, selection.entity);
    selection = null;
    viewer.scene.requestRender();
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

    const features = extractFeatures(xmlDoc, definition);
    featuresByKey.set(definition.key, features);
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

  function getFeatures(key) {
    return featuresByKey.get(key) || [];
  }

  function selectFeature(key, featureId) {
    const feature = getFeatures(key).find(function (item) {
      return item.id === featureId;
    });
    if (!feature) {
      return null;
    }

    clearSelection();

    const dataSource = dataSources.get(key);
    if (!dataSource) {
      return feature;
    }

    const entity = dataSource.entities.values.find(function (item) {
      return item.name === feature.name || item.id === feature.id;
    });
    if (!entity) {
      return feature;
    }

    const style = captureEntityStyle(entity);
    applySelectedStyle(entity);
    selection = { key, featureId, entity, style };
    viewer.scene.requestRender();
    return feature;
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

  return {
    loadAll,
    setVisible,
    setAllVisible,
    allVisible,
    getFeatures,
    selectFeature,
    clearSelection,
  };
}
