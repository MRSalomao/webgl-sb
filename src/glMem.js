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

function spyGetContext(getContext) {
  return function() {
    var gl = getContext.apply(this, arguments);
    if (arguments[0].indexOf("webgl") !== -1 && !glContextsWM.has(gl)) {
      glContexts.push(gl);
      glContextsWM.set(gl, {
        canvas: {
          el: gl.canvas,
          bpp:
            (gl.getParameter(gl.RED_BITS) +
              gl.getParameter(gl.GREEN_BITS) +
              gl.getParameter(gl.BLUE_BITS) +
              gl.getParameter(gl.ALPHA_BITS)) /
            8,
          sampleCoverage: Math.pow(gl.getParameter(gl.SAMPLES), 2) || 1,
          bpd: gl.getParameter(gl.DEPTH_BITS) / 8
        }
      });

      gl.canvas.gl = gl;

      console.log(
        "New GL context created with args: " + JSON.stringify(arguments)
      );
      // console.log(new Error().stack);
      getTotalGPUMemory();
    }
    return gl;
  };
}

function spyTexImage2D(texImage2D) {
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
}

function spyDeleteTexture(deleteTexture) {
  return function() {
    var gl = this;
    var attachment = gl.getParameter(gl.ACTIVE_TEXTURE) - gl.TEXTURE0;
    delete glContextsWM.get(this)[attachment];

    console.log("A texture has been deleted.");
    console.log("> Attachment: " + attachment);

    getTotalGPUMemory();
  };
}

HTMLCanvasElement.prototype.getContext = spyGetContext(
  HTMLCanvasElement.prototype.getContext
);
WebGLRenderingContext.prototype.texImage2D = spyTexImage2D(
  WebGLRenderingContext.prototype.texImage2D
);
WebGL2RenderingContext.prototype.texImage2D = spyTexImage2D(
  WebGL2RenderingContext.prototype.texImage2D
);
WebGLRenderingContext.prototype.deleteTexture = spyDeleteTexture(
  WebGLRenderingContext.prototype.deleteTexture
);
WebGL2RenderingContext.prototype.deleteTexture = spyDeleteTexture(
  WebGL2RenderingContext.prototype.deleteTexture
);

function getTotalGPUMemory() {
  var total = 0;
  glContexts.forEach(function(gl) {
    var glInfo = glContextsWM.get(gl);
    var c = glInfo.canvas;
    var area = c.el.width * c.el.height;
    total += c.bpp * area * (1 + c.sampleCoverage);
    total += c.bpd * area * c.sampleCoverage;
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

function deleteCtx(gl) {
  var index = glContexts.indexOf(gl);
  if (index === -1) return;
  glContexts.splice(index, 1);
  glContextsWM.delete(gl);

  console.log("A canvas has been deleted.");

  getTotalGPUMemory();
}
