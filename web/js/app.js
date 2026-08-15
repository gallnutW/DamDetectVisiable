import { CESIUM_BASE_URL, models, detections } from "./config.js";
import { createViewer } from "./viewer.js";
import { createModelManager } from "./models.js";
import { createDetectionManager, wgs84ToCgcs123E } from "./detections.js";

let activeFeature = null;

function getCoordinateSystem() {
  const select = document.getElementById("coordinateSystem");
  return select ? select.value : "wgs84";
}

function setStatusFactory(statusEl) {
  return function setStatus(message, isError = false) {
    statusEl.textContent = message;
    statusEl.classList.toggle("error", isError);
  };
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

  label.append(input, span);
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
  container.appendChild(wrapper);
  return { input, select };
}

function populateFeatureSelect(select, features) {
  select.replaceChildren();

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "请选择检测框";
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

function addFeatureInfoRow(table, label, value) {
  const row = document.createElement("tr");
  const header = document.createElement("th");
  const cell = document.createElement("td");
  header.textContent = label;
  cell.textContent = value;
  row.append(header, cell);
  table.appendChild(row);
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
  addFeatureInfoRow(table, "长度", `${feature.lengthMeters.toFixed(2)} m`);
  addFeatureInfoRow(table, "宽度", `${feature.widthMeters.toFixed(2)} m`);
  addFeatureInfoRow(table, "面积", `${feature.areaSquareMeters.toFixed(2)} m²`);
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

function bindModelControls(modelManager, modelInputs) {
  modelInputs.forEach(function (input) {
    input.addEventListener("change", function () {
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

  const modelInputs = models.map(function (item) {
    return buildToggle(document.getElementById("modelGroup"), item, "model-item");
  });

  const detectionControls = detections.map(function (item) {
    return buildDetectionItem(document.getElementById("detectionGroup"), item);
  });
  const detectionMaster = document.getElementById("detectionToggleAll");

  const modelManager = createModelManager(viewer, models, setStatus);
  const detectionManager = createDetectionManager(viewer, detections, setStatus);

  bindModelControls(modelManager, modelInputs);
  bindDetectionControls(detectionManager, detectionMaster, detectionControls);

  detectionManager.loadAll().then(function () {
    detectionControls.forEach(function (control) {
      populateFeatureSelect(
        control.select,
        detectionManager.getFeatures(control.select.dataset.key),
      );
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

  modelManager.loadAll().catch(function (error) {
    console.error(error);
    setStatus("初始化失败：请通过本地 HTTP 服务打开页面", true);
  });
}

main();
