#version 300 es
precision highp float;

uniform float u_particleBrightness;
out vec4 outColor;

void main() {
    outColor = vec4(0.8, 0.8, 1.0, u_particleBrightness);
}