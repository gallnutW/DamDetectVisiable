export function createViewer(containerId, cesiumBaseUrl) {
  if (!window.Cesium) {
    throw new Error("Cesium 加载失败，请检查网络连接");
  }

  Cesium.buildModuleUrl.setBaseUrl(cesiumBaseUrl);

  const viewer = new Cesium.Viewer(containerId, {
    animation: false,
    timeline: false,
    baseLayerPicker: false,
    geocoder: false,
    homeButton: false,
    sceneModePicker: false,
    navigationHelpButton: false,
    fullscreenButton: false,
    infoBox: false,
    selectionIndicator: false,
    baseLayer: false,
    terrainProvider: new Cesium.EllipsoidTerrainProvider(),
    requestRenderMode: true,
    maximumRenderTimeChange: Infinity,
  });

  viewer.scene.globe.depthTestAgainstTerrain = false;
  viewer.scene.screenSpaceCameraController.minimumZoomDistance = 1;
  viewer.scene.screenSpaceCameraController.maximumZoomDistance = 100000000;

  return viewer;
}

export function combineBoundingSpheres(spheres) {
  const points = [];
  const offsets = [
    [-1, -1, -1],
    [-1, -1, 1],
    [-1, 1, -1],
    [-1, 1, 1],
    [1, -1, -1],
    [1, -1, 1],
    [1, 1, -1],
    [1, 1, 1],
  ];

  spheres.forEach(function (sphere) {
    const center = sphere.center;
    const radius = sphere.radius;
    offsets.forEach(function (offset) {
      points.push(
        new Cesium.Cartesian3(
          center.x + offset[0] * radius,
          center.y + offset[1] * radius,
          center.z + offset[2] * radius,
        ),
      );
    });
  });

  return Cesium.BoundingSphere.fromPoints(points);
}

export function zoomToTilesets(viewer, tilesets) {
  const visible = tilesets.filter(Boolean);
  if (visible.length === 0) {
    return;
  }

  if (visible.length === 1) {
    viewer.zoomTo(visible[0]).catch(function (error) {
      console.warn("切换视角失败：", error);
    });
  } else {
    const sphere = combineBoundingSpheres(
      visible.map(function (tileset) {
        return tileset.boundingSphere;
      }),
    );
    viewer.camera.flyToBoundingSphere(sphere, {
      duration: 0.5,
      offset: new Cesium.HeadingPitchRange(
        0,
        Cesium.Math.toRadians(-35),
        Math.max(sphere.radius * 1.2, 50),
      ),
    });
  }

  viewer.scene.requestRender();
}
