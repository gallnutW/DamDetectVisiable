import { CESIUM_BASE_URL, models, detections } from "./config.js";
import { createViewer } from "./viewer.js";
import { createModelManager } from "./models.js";
import { createDetectionManager } from "./detections.js";

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

function bindModelControls(modelManager, modelInputs) {
  modelInputs.forEach(function (input) {
    input.addEventListener("change", function () {
      modelManager.setVisible(input.dataset.key, input.checked);
    });
  });
}

function bindDetectionControls(detectionManager, master, detectionInputs) {
  function syncMaster() {
    master.checked = detectionManager.allVisible();
  }

  detectionInputs.forEach(function (input) {
    input.addEventListener("change", function () {
      detectionManager.setVisible(input.dataset.key, input.checked);
      syncMaster();
    });
  });

  master.addEventListener("change", function () {
    detectionManager.setAllVisible(master.checked);
    detectionInputs.forEach(function (input) {
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

  const detectionInputs = detections.map(function (item) {
    return buildToggle(document.getElementById("detectionGroup"), item, "detection-item");
  });
  const detectionMaster = document.getElementById("detectionToggleAll");

  const modelManager = createModelManager(viewer, models, setStatus);
  const detectionManager = createDetectionManager(viewer, detections, setStatus);

  bindModelControls(modelManager, modelInputs);
  bindDetectionControls(detectionManager, detectionMaster, detectionInputs);

  detectionManager.loadAll().catch(function (error) {
    console.error("检测框 KML 加载失败：", error);
  });

  modelManager.loadAll().catch(function (error) {
    console.error(error);
    setStatus("初始化失败：请通过本地 HTTP 服务打开页面", true);
  });
}

main();
