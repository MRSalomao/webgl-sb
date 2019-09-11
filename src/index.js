import "./styles.css";
import "./glMem";
import drawToCanvas from "./draw";
import * as PIXI from "pixi.js";

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
