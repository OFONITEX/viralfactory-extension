import React, { useEffect, useRef } from "react";

const WarpingImage = ({ src, alt, className }) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const hoverRef = useRef(0);
  const animationFrameRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const gl = canvas.getContext("webgl");
    if (!gl) return;

    // Vertex shader code
    const vsSource = `
      attribute vec2 position;
      varying vec2 v_texCoord;
      void main() {
        v_texCoord = position * 0.5 + 0.5;
        // Flip Y for WebGL texture coordinate system
        v_texCoord.y = 1.0 - v_texCoord.y;
        gl_Position = vec4(position, 0.0, 1.0);
      }
    `;

    // Fragment shader code
    const fsSource = `
      precision mediump float;
      varying vec2 v_texCoord;
      uniform sampler2D u_image;
      uniform float u_time;
      uniform float u_hover;

      void main() {
        vec2 uv = v_texCoord;
        
        // 1. Liquid wave distortion
        float waveX = sin(uv.y * 8.0 + u_time * 1.5) * 0.035 * u_hover;
        float waveY = cos(uv.x * 8.0 + u_time * 1.5) * 0.035 * u_hover;
        vec2 distortedUv = uv + vec2(waveX, waveY);
        
        // 2. Center pinch distortion on hover
        vec2 center = vec2(0.5, 0.5);
        vec2 toCenter = distortedUv - center;
        float dist = length(toCenter);
        distortedUv += normalize(toCenter) * sin(dist * 10.0 - u_time * 2.0) * 0.025 * u_hover;

        // Keep coordinates clamped inside the texture bounds to prevent repeating artifacts
        distortedUv = clamp(distortedUv, 0.001, 0.999);
        
        // 3. Chromatic aberration (color channel split) on hover
        float r = texture2D(u_image, distortedUv + vec2(0.007 * u_hover, 0.003 * u_hover)).r;
        float g = texture2D(u_image, distortedUv).g;
        float b = texture2D(u_image, distortedUv - vec2(0.007 * u_hover, 0.003 * u_hover)).b;
        
        // Combine channels with slight futuristic vignette
        float vignette = smoothstep(0.8, 0.4, dist);
        vec3 finalColor = mix(vec3(r, g, b), vec3(r, g, b) * 0.85, 1.0 - vignette);
        
        gl_FragColor = vec4(finalColor, 1.0);
      }
    `;

    // Helper: Compile shader
    const compileShader = (source, type) => {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error("Shader compile error:", gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const vs = compileShader(vsSource, gl.VERTEX_SHADER);
    const fs = compileShader(fsSource, gl.FRAGMENT_SHADER);
    if (!vs || !fs) return;

    // Create shader program
    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error("Program link error:", gl.getProgramInfoLog(program));
      return;
    }

    // Set up geometry (a full-screen quad)
    const vertices = new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
      -1,  1,
       1, -1,
       1,  1,
    ]);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    const positionLoc = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(positionLoc);
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

    // Create texture
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    // Load image
    const img = new Image();
    img.src = src;
    img.crossOrigin = "anonymous";
    img.onload = () => {
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      triggerResize();
    };

    // Uniform locations
    const timeLoc = gl.getUniformLocation(program, "u_time");
    const hoverLoc = gl.getUniformLocation(program, "u_hover");

    let startTime = Date.now();
    let currentHover = 0;

    const render = () => {
      const elapsed = (Date.now() - startTime) / 1000.0;
      
      // Smoothly interpolate hover state
      currentHover += (hoverRef.current - currentHover) * 0.12;

      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(program);

      gl.uniform1f(timeLoc, elapsed);
      gl.uniform1f(hoverLoc, currentHover);

      gl.drawArrays(gl.TRIANGLES, 0, 6);

      animationFrameRef.current = requestAnimationFrame(render);
    };

    // Handle canvas resizing based on container dimensions
    const triggerResize = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      // Use physical pixel resolution (dpr) for sharp rendering
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      gl.viewport(0, 0, canvas.width, canvas.height);
    };

    const resizeObserver = new ResizeObserver(() => triggerResize());
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    render();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      resizeObserver.disconnect();
      gl.deleteTexture(texture);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
    };
  }, [src]);

  // Event handlers to update ref
  const handleMouseEnter = () => {
    hoverRef.current = 1.0;
  };

  const handleMouseLeave = () => {
    hoverRef.current = 0.0;
  };

  return (
    <div
      ref={containerRef}
      className={`warping-image-container ${className}`}
      style={{
        position: "relative",
        overflow: "hidden",
        width: "100%",
        height: "100%",
        display: "block",
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <canvas
        ref={canvasRef}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          display: "block",
          pointerEvents: "none",
        }}
      />
      {/* Fallback image for SEO / Accessibility */}
      <img
        src={src}
        alt={alt}
        className={className}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          visibility: "hidden", // hidden but present for layout & accessibility
        }}
      />
    </div>
  );
};

export default WarpingImage;
