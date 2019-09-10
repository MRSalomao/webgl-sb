import "./styles.css";
import drawToCanvas from "./draw";
import * as PIXI from "pixi.js";
import { Hmac } from "crypto";

const loadImg = src =>
  new Promise(r => {
    const img = new Image();
    img.onload = () => r(img);
    img.crossOrigin = "anonymous";
    img.src = src;
  });

let canvasList = [];

document.body.appendChild(document.createElement("br"));

const logsDiv = document.getElementById("logs");

const s = document.createElement("input");
s.type = "range";
s.min = 2;
s.max = 64;
s.step = 1;
s.value = 64;
document.body.appendChild(s);
s.innerHTML = "No canvases created yet";

document.body.appendChild(document.createElement("br"));
document.body.appendChild(document.createElement("br"));

const size = document.createElement("div");
document.body.appendChild(size);
size.innerHTML = `WebGL Canvases will be created with size 
${s.value ** 2}x${s.value ** 2}`;

s.addEventListener(
  "input",
  _ =>
    (size.innerHTML = `WebGL Canvases will be created with size 
  ${s.value ** 2}x${s.value ** 2}`)
);

document.body.appendChild(document.createElement("br"));

const btn = document.createElement("button");
btn.innerHTML = "create a new canvas";
document.body.appendChild(btn);

document.body.appendChild(document.createElement("br"));
document.body.appendChild(document.createElement("br"));

const d = document.createElement("div");
document.body.appendChild(d);
d.innerHTML = "No canvases created yet";

btn.addEventListener("click", async () => {
  let engineType = document.querySelectorAll(
    "input[name=enginetype]:checked"
  )[0].value;
  let canvasType = document.querySelectorAll(
    "input[name=canvastype]:checked"
  )[0].value;
  let canvas, ctx;
  if (engineType === "pure") {
    canvas = document.createElement("canvas");
    ctx = canvas.getContext(canvasType);
  } else if (engineType === "pixi") {
    const pixiCanvas = new PIXI.WebGLRenderer(s.value ** 2, s.value ** 2);
    canvas = pixiCanvas.view;
    canvas.p = pixiCanvas;
    ctx = pixiCanvas.gl;
  }
  canvas.engine = engineType;
  canvas.type = canvasType;
  canvas.width = canvas.height = s.value ** 2;
  canvas.drawn = document.getElementById("draw").checked;
  canvas.addEventListener("webglcontextlost", event => {
    console.log(event);
    logsDiv.innerHTML += `webglcontextlost on canvas 
    #${canvasList.indexOf(ctx)}<br>`;
  });
  canvas.style.display = "block";
  canvas.style.width = "200px";
  document.body.appendChild(canvas);
  if (canvas.drawn) {
    if (canvas.engine === "pure") {
      await drawToCanvas(ctx);
    } else if (canvas.engine === "pixi") {
      const img = await loadImg("4000x4000.png");
      const sprite = PIXI.Sprite.from(img);
      sprite.width = canvas.width;
      sprite.height = canvas.height;
      canvas.p.render(sprite);
      canvas.sprite = sprite;
    }
  }
  canvasList.push(ctx);

  d.innerHTML = canvasList
    .map(gl => {
      return `created a ${gl.canvas.width}x${gl.canvas.height} 
      ${gl.canvas.type.toUpperCase()} canvas using 
      ${
        {
          pixi: "PIXI",
          pure: "Pure WebGL",
          threejs: "Three.js"
        }[gl.canvas.engine]
      } 
      ${gl.canvas.drawn ? "with an image" : "that is empty"}`;
    })
    .join("<br>");
});

document.getElementById("drawToFirst").onclick = async () => {
  if (!canvasList.length) return;
  const ctx = canvasList[0];
  if (ctx.canvas.engine === "pure") {
    await drawToCanvas(ctx);
  } else if (ctx.canvas.engine === "pixi") {
    ctx.canvas.p.render(ctx.canvas.sprite);
  }
};

// https://books.google.com.mx/books?id=6crECQAAQBAJ&pg=PA28&lpg=PA28&dq=%22webgl%22+memory+depth&source=bl&ots=Jral6YQ8Qy&sig=ACfU3U107QK1Az5Q5vhjVtGz5YoIQ6L-xA&hl=en&sa=X&ved=2ahUKEwjBpIatiMfkAhUHna0KHdgKBrMQ6AEwDHoECAcQAQ#v=onepage&q=memory%20overhead&f=false
//
// https://mynameismjp.wordpress.com/2012/10/24/msaa-overview/
//
// override webgl context creation and save context to a WeakMap so that it does not catch repeated contexts
// remove dereferenced canvases from the dictionary
// override texImage2d to keep track of uploaded images - use gl.getParameter(gl.ACTIVE_TEXTURE) to know what's the active texture slot
// override deleteTexture to keep track of deleted textures - use gl.getParameter(gl.ACTIVE_TEXTURE) to know what's the active texture slot
// create getTotalGPUMemory function that for:
//     each texture returns bytesPerPixel * width * height
//     each canvas return bytesPerColorPixel * width * height *
//         (1 + gl.getParameter(gl.SAMPLE_COVERAGE_VALUE) + gl.getParameter(gl.DEPTH_BITS) / 24)
// report calculated total GPU memory on every spied operation that changes the calculated total

var glContextsWM = new WeakMap();
var glContexts = [];

HTMLCanvasElement.prototype.getContext = (function(create) {
  return function() {
    var gl = create.apply(this, arguments);
    if (arguments[0].indexOf("webgl") !== -1 && !glContextsWM.has(gl)) {
      glContexts.push(gl);
      glContextsWM.set(gl, {
        canvas: {
          w: gl.canvas.width,
          h: gl.canvas.height,
          bpp:
            (gl.getParameter(gl.RED_BITS) +
              gl.getParameter(gl.GREEN_BITS) +
              gl.getParameter(gl.BLUE_BITS) +
              gl.getParameter(gl.ALPHA_BITS)) /
            8,
          sampleCoverage: gl.getParameter(gl.SAMPLE_COVERAGE_VALUE),
          bpd: gl.getParameter(gl.DEPTH_BITS) / 8
        }
      });

      // var handler = {
      //   get: function(obj, prop) {
      //     return obj[prop];
      //   }
      // };

      // var p = new Proxy({}, handler);
      // p.a = 1;
      // p.b = undefined;

      // console.log(p.a, p.b); // 1, undefined
      // console.log("c" in p, p.c); // false, 37

      console.log(
        "New GL context created with args: " + JSON.stringify(arguments)
      );
      // console.log(new Error().stack);
      getTotalGPUMemory();
    }
    return gl;
  };
})(HTMLCanvasElement.prototype.getContext);

WebGLRenderingContext.prototype.texImage2D = (function(texImage2D) {
  return function() {
    var gl = this;
    var w, h;
    var attachment = gl.getParameter(gl.ACTIVE_TEXTURE) - gl.TEXTURE0;
    if (arguments.length === 6) {
      w = arguments[5].width;
      h = arguments[5].height;
    } else {
      w = arguments[3];
      h = arguments[4];
    }
    texImage2D.apply(this, arguments);
    glContextsWM.get(this)[attachment] = {
      w: w,
      h: h,
      bpp: arguments[2] === gl.RGBA ? 4 : 3
    };

    console.log("New texture uploaded args: " + JSON.stringify(arguments));
    console.log("> Size: " + w + " x " + h);
    console.log("> Attachment: " + attachment);
    // console.log(new Error().stack)

    getTotalGPUMemory();
  };
})(WebGLRenderingContext.prototype.texImage2D);

WebGL2RenderingContext.prototype.texImage2D = (function(texImage2D) {
  return function() {
    var gl = this;
    var w, h;
    var attachment = gl.getParameter(gl.ACTIVE_TEXTURE) - gl.TEXTURE0;
    if (arguments.length === 6) {
      w = arguments[5].width;
      h = arguments[5].height;
    } else {
      w = arguments[3];
      h = arguments[4];
    }
    texImage2D.apply(this, arguments);
    glContextsWM.get(this)[attachment] = {
      w: w,
      h: h,
      bpp: arguments[2] === gl.RGBA ? 4 : 3
    };

    console.log("New texture uploaded with args: " + JSON.stringify(arguments));
    console.log("> Size: " + w + " x " + h);
    console.log("> Attachment: " + attachment);
    // console.log(new Error().stack)

    getTotalGPUMemory();
  };
})(WebGL2RenderingContext.prototype.texImage2D);

function getTotalGPUMemory() {
  var total = 0;
  glContexts.forEach(function(gl) {
    var glInfo = glContextsWM.get(gl);
    var c = glInfo.canvas;
    total += c.bpp * c.w * c.h * (1 + c.sampleCoverage);
    total += c.bpd * c.w * c.h * c.sampleCoverage;
    for (var k in glInfo) {
      if (k === "canvas") {
        continue;
      }
      var tex = glInfo[k];
      total += tex.bpp * tex.w * tex.h;
    }
  });
  total /= 1024 * 1024;
  total = total.toFixed(2);
  console.log("Total GPU memory used by the page: " + total + "MB");
}

Object.defineProperty(HTMLCanvasElement.prototype, "width", {
  set: function(value) {
    this._width = value;
    console.log("new width! ", value);
  },
  get: function() {
    return this._width;
  }
});
