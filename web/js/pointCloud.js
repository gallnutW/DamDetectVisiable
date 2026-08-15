const VERTEX_SHADER = `
void vertexMain(VertexInput vsInput, inout czm_modelVertexOutput vsOutput) {
  vsOutput.pointSize = u_pointSize;
}
`;

const FRAGMENT_SHADER = `
void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material) {
  vec3 color = material.diffuse.rgb;

  // 当前 LiDAR 数据没有 INTENSITY 属性，强度模式使用 RGB 亮度近似。
  if (u_colorMode > 0.5) {
    color = vec3(czm_luminance(color));
  }

  color *= u_brightness;
  color = (color - vec3(0.5)) * u_contrast + vec3(0.5);

  float luma = czm_luminance(color);
  color = mix(vec3(luma), color, u_saturation);

  float gray = czm_luminance(color);
  color = mix(color, vec3(gray), u_grayscale);

  material.diffuse.rgb = clamp(color, 0.0, 1.0);

  if (u_pointShape > 0.5) {
    vec2 pointCoord = gl_PointCoord - vec2(0.5);
    if (dot(pointCoord, pointCoord) > 0.25) {
      discard;
    }
  }
}
`;

export function createPointCloudAppearance(viewer, tileset, options) {
  const shader = new Cesium.CustomShader({
    uniforms: {
      u_pointSize: { type: Cesium.UniformType.FLOAT, value: options.pointSize },
      u_pointShape: { type: Cesium.UniformType.FLOAT, value: options.pointShape === "circle" ? 1 : 0 },
      u_colorMode: { type: Cesium.UniformType.FLOAT, value: options.colorMode === "intensity" ? 1 : 0 },
      u_brightness: { type: Cesium.UniformType.FLOAT, value: options.brightness / 100 },
      u_contrast: { type: Cesium.UniformType.FLOAT, value: options.contrast / 100 },
      u_saturation: { type: Cesium.UniformType.FLOAT, value: options.saturation / 100 },
      u_grayscale: { type: Cesium.UniformType.FLOAT, value: options.grayscale ? 1 : 0 },
    },
    vertexShaderText: VERTEX_SHADER,
    fragmentShaderText: FRAGMENT_SHADER,
  });

  tileset.customShader = shader;

  function setUniform(name, value) {
    shader.setUniform(name, value);
    viewer.scene.requestRender();
  }

  return {
    shader,
    setPointSize: function (value) {
      setUniform("u_pointSize", value);
    },
    setShape: function (value) {
      setUniform("u_pointShape", value === "circle" ? 1 : 0);
    },
    setColorMode: function (value) {
      setUniform("u_colorMode", value === "intensity" ? 1 : 0);
    },
    setBrightness: function (value) {
      setUniform("u_brightness", value / 100);
    },
    setContrast: function (value) {
      setUniform("u_contrast", value / 100);
    },
    setSaturation: function (value) {
      setUniform("u_saturation", value / 100);
    },
    setGrayscale: function (value) {
      setUniform("u_grayscale", value ? 1 : 0);
    },
  };
}
