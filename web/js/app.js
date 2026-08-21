import { CESIUM_BASE_URL, models, detections, pointCloudDisplayDefaults } from "./config.js";
import { createViewer } from "./viewer.js";
import { createModelManager } from "./models.js";
import { createPointCloudAppearance } from "./pointCloud.js";
import { createDetectionManager, wgs84ToCgcs123E } from "./detections.js";
import { createPlaneMeasureTool } from "./planeMeasure.js";

let activeFeature = null;
const featureCache = new Map();

function getCoordinateSystem() {
  const select = document.getElementById("coordinateSystem");
  return select ? select.value : "wgs84";
}

function setStatusFactory(statusEl) {
  return function setStatus(message, isError = false) {
    const textEl = statusEl.querySelector(".status-text") || statusEl;
    textEl.textContent = message;
    statusEl.classList.toggle("error", isError);
    statusEl.classList.toggle(
      "loading",
      !isError && /正在|加载|初始化/.test(message),
    );
  };
}

function initSidebarAccordion() {
  const panels = Array.from(document.querySelectorAll(".accordion"));

  function setPanelOpen(panel, isOpen) {
    const toggle = panel.querySelector(".accordion-toggle");
    const body = panel.querySelector(".panel-body");
    if (!toggle || !body) {
      return;
    }

    panel.classList.toggle("open", isOpen);
    toggle.setAttribute("aria-expanded", String(isOpen));
    body.setAttribute("aria-hidden", String(!isOpen));
  }

  panels.forEach(function (panel) {
    const toggle = panel.querySelector(".accordion-toggle");
    const body = panel.querySelector(".panel-body");

    if (!toggle || !body) {
      return;
    }

    toggle.addEventListener("click", function () {
      const willOpen = !panel.classList.contains("open");

      panels.forEach(function (otherPanel) {
        setPanelOpen(otherPanel, false);
      });
      if (willOpen) {
        setPanelOpen(panel, true);
      }
    });
  });

  panels.forEach(function (panel) {
    setPanelOpen(panel, false);
  });
}

function buildToggle(container, item, inputClass) {
  const label = document.createElement("label");
  label.className = "detection-toggle";

  const input = document.createElement("input");
  input.type = "checkbox";
  input.className = inputClass;
  input.dataset.key = item.key;
  input.checked = item.defaultVisible;

  const span = document.createElement("span");
  span.textContent = item.label;

  const switchEl = document.createElement("span");
  switchEl.className = "toggle-switch";
  switchEl.setAttribute("aria-hidden", "true");

  label.append(input, span, switchEl);
  container.appendChild(label);
  return input;
}

function buildModelToggle(container, item) {
  const label = document.createElement("label");
  label.className = "model-toggle";

  const input = document.createElement("input");
  input.type = "checkbox";
  input.className = "model-item";
  input.dataset.key = item.key;
  input.checked = item.defaultVisible;

  const span = document.createElement("span");
  span.textContent = item.label;

  label.append(input, span);
  label.classList.toggle("checked", input.checked);
  container.appendChild(label);
  return input;
}

function buildDetectionItem(container, item) {
  const wrapper = document.createElement("div");
  wrapper.className = "detection-item";

  const input = buildToggle(wrapper, item, "detection-item");

  const select = document.createElement("select");
  select.className = "detection-select";
  select.dataset.key = item.key;
  select.disabled = true;
  select.setAttribute("aria-label", `${item.label} 检测框下拉列表`);

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "请选择检测框";
  select.appendChild(placeholder);

  wrapper.appendChild(select);

  const filter = document.createElement("div");
  filter.className = "detection-filter";

  const filterLabel = document.createElement("span");
  filterLabel.className = "detection-filter-label";
  filterLabel.textContent = "筛选条件";

  const metricSelect = document.createElement("select");
  metricSelect.className = "detection-filter-metric";
  metricSelect.dataset.key = item.key;
  metricSelect.setAttribute("aria-label", `${item.label} 筛选指标`);

  [
    ["areaSquareMeters", "面积"],
    ["lengthMeters", "长度"],
    ["widthMeters", "宽度"],
  ].forEach(function ([value, label]) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    metricSelect.appendChild(option);
  });

  const operator = document.createElement("span");
  operator.className = "detection-filter-operator";
  operator.textContent = ">";

  const thresholdInput = document.createElement("input");
  thresholdInput.className = "detection-filter-threshold";
  thresholdInput.type = "number";
  thresholdInput.min = "0";
  thresholdInput.step = "0.01";
  thresholdInput.placeholder = "阈值";
  thresholdInput.dataset.key = item.key;
  thresholdInput.setAttribute("aria-label", `${item.label} 筛选阈值`);

  filter.append(filterLabel, metricSelect, operator, thresholdInput);
  wrapper.appendChild(filter);
  container.appendChild(wrapper);
  return { input, select, metricSelect, thresholdInput };
}

function populateFeatureSelect(select, features, hasFilter = false) {
  select.replaceChildren();

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = hasFilter ? "无符合条件的检测框" : "请选择检测框";
  select.appendChild(placeholder);

  features.forEach(function (feature) {
    const option = document.createElement("option");
    option.value = feature.id;
    option.textContent =
      feature.sequenceNumber === null ? feature.name : String(feature.sequenceNumber);
    option.title = feature.name;
    select.appendChild(option);
  });

  select.disabled = features.length === 0;
}

function updateFilterMetricOptions(control, features) {
  const availability = {
    areaSquareMeters: features.some(function (feature) {
      return feature.areaSquareMeters !== null;
    }),
    lengthMeters: features.some(function (feature) {
      return feature.lengthMeters !== null;
    }),
    widthMeters: features.some(function (feature) {
      return feature.widthMeters !== null;
    }),
  };

  Array.from(control.metricSelect.options).forEach(function (option) {
    option.disabled = !availability[option.value];
  });

  if (!availability[control.metricSelect.value]) {
    const firstAvailable = Array.from(control.metricSelect.options).find(function (option) {
      return availability[option.value];
    });
    control.metricSelect.value = firstAvailable ? firstAvailable.value : "areaSquareMeters";
  }
}

function applyDetectionFilter(control, detectionManager) {
  const key = control.select.dataset.key;
  const allFeatures = featureCache.get(key) || [];
  const metric = control.metricSelect.value;
  const threshold = parseFloat(control.thresholdInput.value);
  const hasFilter = Number.isFinite(threshold);
  const previousValue = control.select.value;
  const filtered = hasFilter
    ? allFeatures.filter(function (feature) {
        const value = feature[metric];
        return typeof value === "number" && Number.isFinite(value) && value > threshold;
      })
    : allFeatures;

  populateFeatureSelect(control.select, filtered, hasFilter);

  if (
    previousValue &&
    filtered.some(function (feature) {
      return feature.id === previousValue;
    })
  ) {
    control.select.value = previousValue;
  }

  if (
    activeFeature &&
    activeFeature.key === key &&
    !filtered.some(function (feature) {
      return feature.id === activeFeature.id;
    })
  ) {
    activeFeature = null;
    detectionManager.clearSelection();
    control.select.value = "";
    renderFeatureInfo(null);
  }
}

function addFeatureInfoRow(table, label, value) {
  const row = document.createElement("tr");
  const header = document.createElement("th");
  const cell = document.createElement("td");
  header.textContent = label;
  cell.textContent = value;
  if (label.includes("坐标") || label.includes("角点")) {
    cell.classList.add("feature-coordinate");
  }
  row.append(header, cell);
  table.appendChild(row);
}

function addOptionalFeatureMetric(table, label, value, unit) {
  if (value === null || value === undefined) {
    return;
  }
  addFeatureInfoRow(table, label, `${value.toFixed(2)} ${unit}`);
}

function formatCoordinatePoint(point, coordinateSystem) {
  if (coordinateSystem === "cgcs123e") {
    const projected = wgs84ToCgcs123E(point);
    return [
      projected.x.toFixed(3),
      projected.y.toFixed(3),
      `${point.altitude.toFixed(3)} m`,
    ].join("，");
  }

  return [
    point.longitude.toFixed(9),
    point.latitude.toFixed(9),
    `${point.altitude.toFixed(3)} m`,
  ].join("，");
}

function renderFeatureInfo(feature, coordinateSystem = "wgs84") {
  const panel = document.getElementById("featureInfo");
  const title = document.getElementById("featureInfoTitle");
  const body = document.getElementById("featureInfoBody");

  if (!feature) {
    panel.hidden = true;
    body.replaceChildren();
    return;
  }

  panel.hidden = false;
  title.textContent = feature.name;

  const table = document.createElement("table");
  table.className = "feature-table";
  const coordinateLabel =
    coordinateSystem === "cgcs123e" ? "X，Y，H" : "经度，纬度，高程";

  addFeatureInfoRow(
    table,
    "编号",
    feature.sequenceNumber === null ? "—" : String(feature.sequenceNumber),
  );
  addOptionalFeatureMetric(table, "缺陷面积", feature.areaSquareMeters, "m²");
  addOptionalFeatureMetric(table, "缺陷长度", feature.lengthMeters, "m");
  addOptionalFeatureMetric(table, "缺陷平均宽度", feature.widthMeters, "m");
  addFeatureInfoRow(
    table,
    `中心坐标（${coordinateLabel}）`,
    formatCoordinatePoint(feature.center, coordinateSystem),
  );

  feature.points.forEach(function (point, index) {
    addFeatureInfoRow(
      table,
      `角点 ${index + 1}（${coordinateLabel}）`,
      formatCoordinatePoint(point, coordinateSystem),
    );
  });

  body.replaceChildren(table);
}

function updateRangeProgress(input) {
  const min = parseFloat(input.min);
  const max = parseFloat(input.max);
  const value = parseFloat(input.value);
  const progress =
    max === min ? 0 : ((value - min) / (max - min)) * 100;
  input.style.setProperty("--range-progress", `${progress}%`);
}

function buildPointCloudSlider(container, labelText, id, min, max, step, value) {
  const wrapper = document.createElement("label");
  wrapper.className = "point-cloud-control";

  const title = document.createElement("span");
  title.className = "point-cloud-control-title";
  title.textContent = labelText;

  const input = document.createElement("input");
  input.type = "range";
  input.id = id;
  input.className = "point-cloud-range";
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.value = String(value);
  updateRangeProgress(input);

  const output = document.createElement("span");
  output.className = "point-cloud-value";
  output.textContent = String(value);

  wrapper.append(title, input, output);
  container.appendChild(wrapper);
  return { input, output };
}

function buildPointCloudSelect(container, labelText, id, options, value, hint) {
  const wrapper = document.createElement("label");
  wrapper.className = "point-cloud-control point-cloud-control-select";

  const title = document.createElement("span");
  title.className = "point-cloud-control-title";
  title.textContent = labelText;

  const input = document.createElement("select");
  input.id = id;
  input.className = "point-cloud-select";
  options.forEach(function ([optionValue, optionLabel]) {
    const option = document.createElement("option");
    option.value = optionValue;
    option.textContent = optionLabel;
    input.appendChild(option);
  });
  input.value = value;
  if (hint) {
    input.title = hint;
  }

  wrapper.append(title, input);
  container.appendChild(wrapper);
  return { input };
}

function buildPointCloudControls(container, defaults) {
  const pointSize = buildPointCloudSlider(
    container,
    "点大小",
    "pointCloudPointSize",
    1,
    20,
    1,
    defaults.pointSize,
  );
  const pointShape = buildPointCloudSelect(
    container,
    "点形状",
    "pointCloudShape",
    [
      ["square", "方形"],
      ["circle", "圆形"],
    ],
    defaults.pointShape,
  );
  const colorMode = buildPointCloudSelect(
    container,
    "着色模式",
    "pointCloudColorMode",
    [
      ["rgb", "真彩色"],
      ["intensity", "强度"],
    ],
    defaults.colorMode,
    "当前数据无 INTENSITY 属性，强度模式使用 RGB 亮度近似。",
  );
  const brightness = buildPointCloudSlider(
    container,
    "亮度",
    "pointCloudBrightness",
    0,
    200,
    1,
    defaults.brightness,
  );
  const contrast = buildPointCloudSlider(
    container,
    "对比度",
    "pointCloudContrast",
    0,
    200,
    1,
    defaults.contrast,
  );
  const saturation = buildPointCloudSlider(
    container,
    "饱和度",
    "pointCloudSaturation",
    0,
    200,
    1,
    defaults.saturation,
  );
  const grayscale = buildPointCloudSlider(
    container,
    "灰度",
    "pointCloudGrayscale",
    0,
    100,
    1,
    defaults.grayscale,
  );

  return { pointSize, pointShape, colorMode, brightness, contrast, saturation, grayscale };
}

function bindPointCloudControls(appearance, controls) {
  function bindRange(control, setter) {
    control.input.addEventListener("input", function () {
      control.output.textContent = this.value;
      updateRangeProgress(this);
      setter(parseFloat(this.value));
    });
  }

  bindRange(controls.pointSize, appearance.setPointSize);
  bindRange(controls.brightness, appearance.setBrightness);
  bindRange(controls.contrast, appearance.setContrast);
  bindRange(controls.saturation, appearance.setSaturation);
  bindRange(controls.grayscale, appearance.setGrayscale);

  controls.pointShape.input.addEventListener("change", function () {
    appearance.setShape(this.value);
  });

  controls.colorMode.input.addEventListener("change", function () {
    appearance.setColorMode(this.value);
  });

}

function bindModelControls(modelManager, modelInputs) {
  modelInputs.forEach(function (input) {
    input.addEventListener("change", function () {
      const label = input.closest(".model-toggle");
      if (label) {
        label.classList.toggle("checked", input.checked);
      }
      modelManager.setVisible(input.dataset.key, input.checked);
    });
  });
}

function bindDetectionControls(detectionManager, master, detectionControls) {
  function syncMaster() {
    master.checked = detectionManager.allVisible();
  }

  detectionControls.forEach(function (control) {
    const input = control.input;
    const select = control.select;

    input.addEventListener("change", function () {
      detectionManager.setVisible(input.dataset.key, input.checked);
      syncMaster();
    });

    select.addEventListener("change", function () {
      let selectedFeature = null;

      if (select.value) {
        selectedFeature = detectionManager.selectFeature(select.dataset.key, select.value);
        detectionControls.forEach(function (other) {
          if (other.select !== select) {
            other.select.value = "";
          }
        });
      } else {
        detectionManager.clearSelection();
      }

      activeFeature = selectedFeature;
      renderFeatureInfo(activeFeature, getCoordinateSystem());
    });

    control.metricSelect.addEventListener("change", function () {
      applyDetectionFilter(control, detectionManager);
    });

    control.thresholdInput.addEventListener("input", function () {
      applyDetectionFilter(control, detectionManager);
    });

    control.thresholdInput.addEventListener("change", function () {
      applyDetectionFilter(control, detectionManager);
    });
  });

  master.addEventListener("change", function () {
    detectionManager.setAllVisible(master.checked);
    detectionControls.forEach(function (control) {
      const input = control.input;
      input.checked = master.checked;
    });
  });

  syncMaster();
}

function main() {
  const statusEl = document.getElementById("status");
  const setStatus = setStatusFactory(statusEl);

  let viewer;
  try {
    viewer = createViewer("cesiumContainer", window.CESIUM_BASE_URL || CESIUM_BASE_URL);
  } catch (error) {
    console.error(error);
    setStatus(error.message, true);
    return;
  }

  createPlaneMeasureTool(viewer);

  const modelInputs = models.map(function (item) {
    return buildModelToggle(document.getElementById("modelGroup"), item);
  });

  const detectionControls = detections.map(function (item) {
    return buildDetectionItem(document.getElementById("detectionGroup"), item);
  });
  const detectionMaster = document.getElementById("detectionToggleAll");

  const modelManager = createModelManager(viewer, models, setStatus);
  const detectionManager = createDetectionManager(viewer, detections, setStatus);

  bindModelControls(modelManager, modelInputs);
  bindDetectionControls(detectionManager, detectionMaster, detectionControls);

  const pointCloudControls = buildPointCloudControls(
    document.getElementById("pointCloudGroup"),
    pointCloudDisplayDefaults,
  );

  detectionManager.loadAll().then(function () {
    detectionControls.forEach(function (control) {
      const key = control.select.dataset.key;
      const features = detectionManager.getFeatures(key);
      featureCache.set(key, features);
      updateFilterMetricOptions(control, features);
      applyDetectionFilter(control, detectionManager);
    });
  }).catch(function (error) {
    console.error("检测框 KML 加载失败：", error);
  });

  const featureInfoClose = document.getElementById("featureInfoClose");
  featureInfoClose.addEventListener("click", function () {
    activeFeature = null;
    detectionManager.clearSelection();
    detectionControls.forEach(function (control) {
      control.select.value = "";
    });
    renderFeatureInfo(null);
  });

  const coordinateSystemSelect = document.getElementById("coordinateSystem");
  coordinateSystemSelect.addEventListener("change", function () {
    renderFeatureInfo(activeFeature, getCoordinateSystem());
  });

  modelManager.loadAll()
    .then(function () {
      const definition = models.find(function (item) {
        return item.type === "pointCloud";
      });
      const pointCloudTileset = definition ? modelManager.getTileset(definition.key) : null;
      if (!pointCloudTileset) {
        return;
      }

      const appearance = createPointCloudAppearance(
        viewer,
        pointCloudTileset,
        pointCloudDisplayDefaults,
      );
      bindPointCloudControls(appearance, pointCloudControls);
    })
    .catch(function (error) {
      console.error(error);
      setStatus("初始化失败：请通过本地 HTTP 服务打开页面", true);
    });
}

initSidebarAccordion();
main();
