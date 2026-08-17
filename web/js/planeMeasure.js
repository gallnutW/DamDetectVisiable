const PLANE_POINT_COLOR = Cesium.Color.fromCssColorString("#3b82f6");
const PLANE_LINE_COLOR = Cesium.Color.fromCssColorString("#7dd3fc");
const PLANE_PREVIEW_COLOR = Cesium.Color.fromCssColorString("#fbbf24");
const PLANE_AREA_COLOR = Cesium.Color.fromCssColorString("#34d399");
const PLANE_LABEL_BACKGROUND = Cesium.Color.fromCssColorString("#0b0f19").withAlpha(0.82);

function isDefined(value) {
  return Cesium.defined(value);
}

function midpoint(left, right) {
  const result = new Cesium.Cartesian3();
  Cesium.Cartesian3.add(left, right, result);
  return Cesium.Cartesian3.divideByScalar(result, 2, result);
}

function centroid(points) {
  const result = new Cesium.Cartesian3();
  points.forEach(function (point) {
    Cesium.Cartesian3.add(result, point, result);
  });
  return Cesium.Cartesian3.divideByScalar(result, points.length, result);
}

function polygonArea(points) {
  const origin = centroid(points);
  const normal = new Cesium.Cartesian3();

  for (let index = 0; index < points.length; index += 1) {
    const current = Cesium.Cartesian3.subtract(
      points[index],
      origin,
      new Cesium.Cartesian3(),
    );
    const next = Cesium.Cartesian3.subtract(
      points[(index + 1) % points.length],
      origin,
      new Cesium.Cartesian3(),
    );
    const cross = Cesium.Cartesian3.cross(current, next, new Cesium.Cartesian3());
    Cesium.Cartesian3.add(normal, cross, normal);
  }

  return Cesium.Cartesian3.magnitude(normal) / 2;
}

function formatDistance(distance) {
  return `${distance.toFixed(2)} m`;
}

function formatArea(area) {
  if (area >= 1000000) {
    return `${(area / 1000000).toFixed(3)} km²`;
  }
  return `${area.toFixed(2)} m²`;
}

function calculateMeasurement(points) {
  if (points.length < 4) {
    return null;
  }

  const edges = [0, 1, 2, 3].map(function (index) {
    const start = points[index];
    const end = points[(index + 1) % points.length];
    return {
      startIndex: index,
      endIndex: (index + 1) % points.length,
      start,
      end,
      length: Cesium.Cartesian3.distance(start, end),
      center: midpoint(start, end),
    };
  });

  const area = polygonArea(points);

  return {
    edges,
    area,
    center: centroid(points),
  };
}

export function createPlaneMeasureTool(viewer) {
  const state = {
    active: false,
    points: [],
    measurement: null,
    entities: {
      points: [],
      lines: [],
      labels: [],
      polygon: null,
      previewLine: null,
      previewPoint: null,
    },
  };

  let handler = null;
  let previewFrame = null;
  let previewWindowPosition = null;

  function removeEntity(entity) {
    if (entity) {
      viewer.entities.remove(entity);
    }
  }

  function removePreviewEntities() {
    if (previewFrame !== null) {
      window.cancelAnimationFrame(previewFrame);
      previewFrame = null;
    }
    previewWindowPosition = null;
    removeEntity(state.entities.previewLine);
    removeEntity(state.entities.previewPoint);
    state.entities.previewLine = null;
    state.entities.previewPoint = null;
  }

  function clearGraphics() {
    removePreviewEntities();

    state.entities.points.forEach(removeEntity);
    state.entities.lines.forEach(removeEntity);
    state.entities.labels.forEach(removeEntity);
    removeEntity(state.entities.polygon);

    state.entities.points = [];
    state.entities.lines = [];
    state.entities.labels = [];
    state.entities.polygon = null;
  }

  function addPointEntity(position) {
    const entity = viewer.entities.add({
      position,
      point: {
        pixelSize: 9,
        color: PLANE_POINT_COLOR,
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 2,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    });
    state.entities.points.push(entity);
    return entity;
  }

  function addLineEntity(positions, color, width) {
    const entity = viewer.entities.add({
      polyline: {
        positions: positions.slice(),
        width: width || 3,
        material: color || PLANE_LINE_COLOR,
        arcType: Cesium.ArcType.NONE,
      },
    });
    state.entities.lines.push(entity);
    return entity;
  }

  function addLabelEntity(position, text, color) {
    const entity = viewer.entities.add({
      position,
      label: {
        text,
        font: '14px "Microsoft YaHei", "PingFang SC", sans-serif',
        fillColor: color || PLANE_LINE_COLOR,
        showBackground: true,
        backgroundColor: PLANE_LABEL_BACKGROUND,
        backgroundPadding: new Cesium.Cartesian2(8, 4),
        pixelOffset: new Cesium.Cartesian2(0, -16),
        horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
        verticalOrigin: Cesium.VerticalOrigin.CENTER,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    });
    state.entities.labels.push(entity);
    return entity;
  }

  function addPolygonEntity(points) {
    const entity = viewer.entities.add({
      polygon: {
        hierarchy: new Cesium.PolygonHierarchy(points.slice()),
        material: Cesium.Color.fromCssColorString("#38bdf8").withAlpha(0.18),
        outline: true,
        outlineColor: PLANE_LINE_COLOR,
        outlineWidth: 3,
      },
    });
    state.entities.polygon = entity;
    return entity;
  }

  function addMeasurementGraphics(measurement) {
    if (!measurement) {
      return;
    }

    if (measurement.area > 1e-6) {
      addPolygonEntity(state.points);
    }

    measurement.edges.forEach(function (edge, index) {
      addLabelEntity(
        edge.center,
        `边 ${index + 1}\n${formatDistance(edge.length)}`,
        PLANE_LINE_COLOR,
      );
    });

    addLabelEntity(
      measurement.center,
      `面积\n${formatArea(measurement.area)}`,
      PLANE_AREA_COLOR,
    );
  }

  function pickPosition(windowPosition) {
    if (!windowPosition) {
      return undefined;
    }

    const scenePosition = viewer.scene.pickPosition(windowPosition);
    if (isDefined(scenePosition)) {
      return scenePosition;
    }

    const ray = viewer.camera.getPickRay(windowPosition);
    if (!ray) {
      return undefined;
    }

    const globePosition = viewer.scene.globe.pick(ray, viewer.scene);
    if (isDefined(globePosition)) {
      return globePosition;
    }

    return undefined;
  }

  function updatePreview(windowPosition) {
    if (!state.active || state.points.length === 0 || state.points.length >= 4) {
      return;
    }

    const cursorPosition = pickPosition(windowPosition);
    if (!isDefined(cursorPosition)) {
      return;
    }

    const startPosition = state.points[state.points.length - 1];
    if (!state.entities.previewLine) {
      state.entities.previewLine = viewer.entities.add({
        polyline: {
          positions: [startPosition, cursorPosition],
          width: 2,
          material: PLANE_PREVIEW_COLOR,
          arcType: Cesium.ArcType.NONE,
        },
      });
    } else {
      state.entities.previewLine.polyline.positions = [startPosition, cursorPosition];
    }

    if (!state.entities.previewPoint) {
      state.entities.previewPoint = viewer.entities.add({
        position: cursorPosition,
        point: {
          pixelSize: 5,
          color: PLANE_PREVIEW_COLOR,
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 1,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      });
    } else {
      state.entities.previewPoint.position = cursorPosition;
    }

    viewer.scene.requestRender();
  }

  function schedulePreview(windowPosition) {
    previewWindowPosition = windowPosition;
    if (previewFrame !== null) {
      return;
    }

    previewFrame = window.requestAnimationFrame(function () {
      previewFrame = null;
      updatePreview(previewWindowPosition);
    });
  }

  function onLeftClick(movement) {
    if (!state.active) {
      return;
    }

    const position = pickPosition(movement.position);
    if (!isDefined(position)) {
      const hint = document.getElementById("planeMeasureHint");
      if (hint) {
        hint.textContent = "未拾取到模型或地形表面，请点击有效位置。";
      }
      viewer.scene.requestRender();
      return;
    }

    addPoint(position, movement.position);
  }

  function onMouseMove(movement) {
    if (!state.active || state.points.length === 0 || state.points.length >= 4) {
      return;
    }
    schedulePreview(movement.endPosition);
  }

  function addPoint(position, windowPosition) {
    if (!state.active || state.points.length >= 4) {
      return;
    }

    state.points.push(Cesium.Cartesian3.clone(position));
    addPointEntity(state.points[state.points.length - 1]);

    if (state.points.length > 1) {
      addLineEntity(
        [state.points[state.points.length - 2], state.points[state.points.length - 1]],
        PLANE_LINE_COLOR,
        3,
      );
    }

    if (state.points.length === 4) {
      addLineEntity([state.points[3], state.points[0]], PLANE_LINE_COLOR, 3);
      removePreviewEntities();
      state.active = false;
      window.setTimeout(function () {
        if (!state.active) {
          removeHandler();
        }
      }, 0);
      state.measurement = calculateMeasurement(state.points);
      addMeasurementGraphics(state.measurement);
      updateUI();
      return;
    }

    removePreviewEntities();
    if (windowPosition) {
      updatePreview(windowPosition);
    }
    updateUI();
  }

  function removeHandler() {
    if (handler) {
      if (!handler.isDestroyed()) {
        handler.destroy();
      }
      handler = null;
    }
  }

  function ensureHandler() {
    if (handler) {
      return;
    }

    handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction(onLeftClick, Cesium.ScreenSpaceEventType.LEFT_CLICK);
    handler.setInputAction(onMouseMove, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
  }

  function start() {
    clearAll();
    state.active = true;
    ensureHandler();
    updateUI();
  }

  function stop() {
    clearAll();
  }

  function clearAll() {
    state.active = false;
    state.points = [];
    state.measurement = null;
    removeHandler();
    clearGraphics();
    updateUI();
  }

  function updateUI() {
    const toggle = document.getElementById("planeMeasureToggle");
    const clearButton = document.getElementById("planeMeasureClear");
    const hint = document.getElementById("planeMeasureHint");

    if (toggle) {
      toggle.textContent = state.active ? "结束选择" : "开始选择平面";
      toggle.classList.toggle("active", state.active);
    }

    if (clearButton) {
      clearButton.disabled = state.points.length === 0 && !state.measurement;
    }

    if (hint) {
      if (state.active) {
        hint.textContent = `请点击第 ${state.points.length + 1} 个点（共 4 个）。`;
      } else if (state.measurement) {
        hint.textContent = "已完成平面选择，可在三维场景中查看边长与面积。";
      } else {
        hint.textContent = "依次点击四个点，围成一个闭合四边形。";
      }
    }

    renderResult();
    viewer.scene.requestRender();
  }

  function renderResult() {
    const container = document.getElementById("planeMeasureResult");
    if (!container) {
      return;
    }

    if (!state.measurement) {
      container.hidden = true;
      container.replaceChildren();
      return;
    }

    container.hidden = false;
    container.replaceChildren();

    const title = document.createElement("div");
    title.className = "plane-result-title";
    title.textContent = "测量结果";
    container.appendChild(title);

    const list = document.createElement("ul");
    list.className = "plane-result-list";
    state.measurement.edges.forEach(function (edge, index) {
      const item = document.createElement("li");
      item.textContent = `边 ${index + 1}：${formatDistance(edge.length)}`;
      list.appendChild(item);
    });
    container.appendChild(list);

    const area = document.createElement("p");
    area.className = "plane-result-area";
    area.textContent = `面积：${formatArea(state.measurement.area)}`;
    container.appendChild(area);
  }

  function bindUI() {
    const toggle = document.getElementById("planeMeasureToggle");
    const clearButton = document.getElementById("planeMeasureClear");

    if (toggle) {
      toggle.addEventListener("click", function () {
        if (state.active) {
          stop();
        } else {
          start();
        }
      });
    }

    if (clearButton) {
      clearButton.addEventListener("click", clearAll);
    }

    window.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && state.active) {
        stop();
      }
    });
  }

  bindUI();
  updateUI();

  return {
    start,
    stop,
    clear: clearAll,
    isActive: function () {
      return state.active;
    },
    getMeasurement: function () {
      return state.measurement;
    },
  };
}
