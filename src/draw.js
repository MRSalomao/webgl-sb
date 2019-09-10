const loadImg = src =>
  new Promise(r => {
    const img = new Image();
    img.onload = () => r(img);
    img.crossOrigin = "anonymous";
    img.src = src;
  });

const _initShaderProgram = function _initShaderProgram(gl, vsSource, fsSource) {
  var vertexShader = _loadShader(gl, gl.VERTEX_SHADER, vsSource),
    fragmentShader = _loadShader(gl, gl.FRAGMENT_SHADER, fsSource),
    shaderProgram = gl.createProgram();

  gl.attachShader(shaderProgram, vertexShader);
  gl.attachShader(shaderProgram, fragmentShader);
  gl.linkProgram(shaderProgram);

  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    throw new Error(
      "Unable to initialize the shader program:\n" +
        gl.getProgramInfoLog(shaderProgram)
    );
  }

  return shaderProgram;
};

const _loadShader = function _loadShader(gl, type, source) {
  var shader = gl.createShader(type);

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(
      "An error occurred compiling the shaders:\n" +
        gl.getShaderInfoLog(shader) +
        source
    );
  }

  return shader;
};

export default async function(gl) {
  // const img = await loadImg("img.jpg");
  const img = await loadImg("4000x4000.png");
  const tex = gl.createTexture();
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);

  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([1.0, 1.0, -1.0, 1.0, 1.0, -1.0, -1.0, -1.0]),
    gl.STATIC_DRAW
  );

  const program = _initShaderProgram(
    gl,
    "precision mediump float;\n" +
      "attribute vec4 pos;\n" +
      "void main(void) {\n" +
      "    gl_Position = pos;\n" +
      "}",
    "precision mediump float;\n" +
      "uniform vec2 texSize;\n" +
      "uniform sampler2D tex;\n" +
      "void main() {\n" +
      "    gl_FragColor = texture2D(tex, gl_FragCoord.xy / texSize);" +
      "}"
  );

  const aPos = gl.getAttribLocation(program, "pos");
  const uTex = gl.getUniformLocation(program, "tex");
  const uTexSize = gl.getUniformLocation(program, "texSize");
  gl.useProgram(program);
  gl.uniform1i(uTex, 0);
  gl.uniform2f(uTexSize, gl.canvas.width, gl.canvas.height);
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
  gl.clearColor(0.0, 0.0, 0.0, 0.0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}
