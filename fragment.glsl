precision highp float;

uniform float u_particleBrightness;

void main() {
    gl_FragColor = vec4(0.8, 0.8, 1.0, u_particleBrightness);
}